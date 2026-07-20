// Agente Turni — motore locale (a regole) per generare la pianificazione
// settimanale rispettando ore di contratto, copertura minima e le esigenze
// scritte a testo libero. È il "cervello" ibrido: oggi lavora offline con
// regole; domani, con una API key, lo stesso testo può passare a un LLM.

export interface ShiftEntry {
  isWorking: boolean;
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
}

export type WeekShifts = Record<string, Record<number, ShiftEntry>>; // opId -> dayIndex(0=Lun..5=Sab) -> shift

export interface AgentOperator {
  id: string;
  firstName: string;
  lastName: string;
  contractHours?: number;
}

export interface AgentConfig {
  openDays: boolean[]; // len 6, Lun..Sab
  openTime: string; // "09:00"
  closeTime: string; // "19:00"
  minCoverage: number; // operatrici minime in servizio per giorno aperto
  lunchBreak: boolean; // inserisce la pausa pranzo (turno spezzato)
  breakStart: string; // "13:00"
  breakEnd: string; // "14:00"
  defaultHours: number; // ore usate se l'operatrice non ha ore da contratto
  notes: string; // esigenze a testo libero
}

export interface OperatorPlan {
  id: string;
  name: string;
  target: number; // ore obiettivo
  hours: number; // ore assegnate
  restDays: number[]; // indici giorni di riposo
}

export interface GenerationResult {
  shifts: WeekShifts;
  warnings: string[];
  perOperator: OperatorPlan[];
}

interface OpConstraint {
  forceRest: Set<number>;
  maxHours?: number;
  onlyMorning?: boolean;
  onlyAfternoon?: boolean;
}

const DAY_TOKENS: { re: RegExp; day: number }[] = [
  { re: /luned|\blun\b/, day: 0 },
  { re: /marted|\bmar\b/, day: 1 },
  { re: /mercoled|\bmer\b/, day: 2 },
  { re: /gioved|\bgio\b/, day: 3 },
  { re: /venerd|\bven\b/, day: 4 },
  { re: /sabato|\bsab\b/, day: 5 },
];

/* ---------- helpers tempo ---------- */
export function toMin(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
export function toStr(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function shiftHours(s: ShiftEntry): number {
  if (!s.isWorking) return 0;
  let mins = toMin(s.endTime) - toMin(s.startTime);
  if (s.breakStart && s.breakEnd) mins -= toMin(s.breakEnd) - toMin(s.breakStart);
  return Math.max(0, mins) / 60;
}

/* ---------- parsing esigenze (best-effort, italiano) ---------- */
function detectDays(fragment: string): number[] {
  const days: number[] = [];
  for (const { re, day } of DAY_TOKENS) if (re.test(fragment)) days.push(day);
  return days;
}

export function parseConstraints(
  operators: AgentOperator[],
  notes: string,
): { constraints: Map<string, OpConstraint>; closedDays: Set<number>; notes: string[] } {
  const constraints = new Map<string, OpConstraint>();
  operators.forEach((o) => constraints.set(o.id, { forceRest: new Set() }));
  const closedDays = new Set<number>();
  const info: string[] = [];

  const text = (notes || '').toLowerCase();
  // spezza in frammenti per riga / punteggiatura
  const fragments = text.split(/[\n;.]+/).map((f) => f.trim()).filter(Boolean);

  for (const frag of fragments) {
    const days = detectDays(frag);

    const match = matchOperator(operators, frag);
    if (!match.op) {
      // nome ambiguo (più operatrici stesso nome) → chiedi il cognome
      if (match.ambiguous) {
        info.push(`⚠ Più operatrici di nome ${match.name}: aggiungi il cognome per distinguerle`);
        continue;
      }
      // chiusura salone (nessun nome operatrice, parola "chius")
      if (/chius/.test(frag) && days.length) {
        days.forEach((d) => closedDays.add(d));
        info.push(`✓ Chiusura: ${days.map(dayLabel).join(', ')}`);
      }
      continue;
    }

    const namedOp = match.op;
    const label = namedOp.lastName ? `${namedOp.firstName} ${namedOp.lastName}` : namedOp.firstName;
    const c = constraints.get(namedOp.id)!;

    // riposo / indisponibilità
    if (/(ripos|liber|off|non\s+(può|puo|lavora|disponibil)|assente|a\s+casa|ferie|malatt)/.test(frag) && days.length) {
      days.forEach((d) => c.forceRest.add(d));
      info.push(`✓ ${label}: riposo ${days.map(dayLabel).join(', ')}`);
    }

    // ore massime / part-time
    const maxM = frag.match(/(?:max|massimo|part[\s-]?time|fino a)\D{0,6}(\d{1,2})\s*(?:h|ore)?/);
    const oreM = frag.match(/(\d{1,2})\s*ore/);
    const hLimit = maxM ? Number(maxM[1]) : oreM ? Number(oreM[1]) : undefined;
    if (hLimit && hLimit > 0 && hLimit <= 60) {
      c.maxHours = hLimit;
      info.push(`✓ ${label}: max ${hLimit}h`);
    }

    // solo mattina / pomeriggio
    if (/mattin/.test(frag) && !/pomerig/.test(frag)) {
      c.onlyMorning = true;
      info.push(`✓ ${label}: solo mattina`);
    }
    if (/pomerig/.test(frag) && !/mattin/.test(frag)) {
      c.onlyAfternoon = true;
      info.push(`✓ ${label}: solo pomeriggio`);
    }
  }

  return { constraints, closedDays, notes: info };
}

// Trova l'operatrice citata nel frammento, disambiguando col cognome quando
// più operatrici condividono lo stesso nome.
function matchOperator(
  operators: AgentOperator[],
  frag: string,
): { op: AgentOperator | null; ambiguous?: boolean; name?: string } {
  const byFirst = operators.filter((o) => new RegExp(`\\b${escapeRe(o.firstName.toLowerCase())}\\b`).test(frag));
  if (byFirst.length === 0) return { op: null };
  if (byFirst.length === 1) return { op: byFirst[0] };
  const byLast = byFirst.filter((o) => o.lastName && new RegExp(`\\b${escapeRe(o.lastName.toLowerCase())}\\b`).test(frag));
  if (byLast.length === 1) return { op: byLast[0] };
  return { op: null, ambiguous: true, name: byFirst[0].firstName };
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function dayLabel(d: number) {
  return ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][d] || String(d);
}

/* ---------- generazione ---------- */
export function generateShifts(config: AgentConfig, operators: AgentOperator[]): GenerationResult {
  const warnings: string[] = [];
  const { constraints, closedDays, notes } = parseConstraints(operators, config.notes);
  notes.forEach((n) => warnings.push(n));

  const openMin = toMin(config.openTime);
  const closeMin = toMin(config.closeTime);
  const midMin = roundTo30((openMin + closeMin) / 2);
  const breakMin = config.lunchBreak ? Math.max(0, toMin(config.breakEnd) - toMin(config.breakStart)) : 0;
  const dayClockH = (closeMin - openMin) / 60; // ore di apertura (pausa inclusa)
  const fullDayH = Math.max(0, dayClockH - breakMin / 60); // ore lavorate in una giornata piena
  const morningH = (midMin - openMin) / 60;
  const afternoonH = (closeMin - midMin) / 60;

  if (closeMin <= openMin) warnings.push('⚠ Orario di chiusura non valido: turni non generati.');

  const openDayIdx: number[] = [];
  for (let d = 0; d < 6; d++) if (config.openDays[d] && !closedDays.has(d)) openDayIdx.push(d);
  if (openDayIdx.length === 0) warnings.push('⚠ Nessun giorno di apertura selezionato.');

  const rest = (): ShiftEntry => ({ isWorking: false, startTime: '', endTime: '' });
  const shifts: WeekShifts = {};
  const perOperator: OperatorPlan[] = [];

  // inizializza tutti a riposo
  operators.forEach((op) => {
    shifts[op.id] = {};
    for (let d = 0; d < 6; d++) shifts[op.id][d] = rest();
  });

  operators.forEach((op, opIndex) => {
    const c = constraints.get(op.id)!;
    const half = c.onlyMorning || c.onlyAfternoon;
    const perDayH = half ? (c.onlyMorning ? morningH : afternoonH) : fullDayH;

    let target = op.contractHours && op.contractHours > 0 ? op.contractHours : config.defaultHours;
    if (c.maxHours != null) target = Math.min(target, c.maxHours);

    const available = openDayIdx.filter((d) => !c.forceRest.has(d));
    if (available.length === 0 || perDayH <= 0 || closeMin <= openMin) {
      perOperator.push({ id: op.id, name: op.firstName, target, hours: 0, restDays: allRest(config) });
      return;
    }

    let workDays = Math.round(target / perDayH);
    workDays = Math.min(Math.max(workDays, 1), available.length);

    // sceglie i giorni lavorativi sfalsando i riposi tra operatrici diverse
    const rotated = rotate(available, opIndex % available.length);
    const workingSet = rotated.slice(0, workDays).sort((a, b) => a - b);

    // aggiusta l'ultima giornata per avvicinarsi all'obiettivo ore
    const baseHours = (workDays - 1) * perDayH;
    let lastH = target - baseHours;
    if (lastH > perDayH) lastH = perDayH; // non oltre la giornata piena
    if (lastH < 2) lastH = Math.min(perDayH, Math.max(2, lastH)); // minimo turno sensato

    workingSet.forEach((d, i) => {
      const isLast = i === workingSet.length - 1;
      const workedH = isLast ? lastH : perDayH;
      shifts[op.id][d] = buildShift(workedH, {
        openMin,
        closeMin,
        midMin,
        onlyMorning: c.onlyMorning,
        onlyAfternoon: c.onlyAfternoon,
        lunchBreak: config.lunchBreak,
        breakStart: config.breakStart,
        breakEnd: config.breakEnd,
      });
    });

    const assigned = workingSet.reduce((s, d) => s + shiftHours(shifts[op.id][d]), 0);
    const restDays: number[] = [];
    for (let d = 0; d < 6; d++) if (!shifts[op.id][d].isWorking) restDays.push(d);
    perOperator.push({ id: op.id, name: op.firstName, target, hours: round1(assigned), restDays });
  });

  // --- passata di copertura minima ---
  const minCov = Math.max(0, Math.min(config.minCoverage, operators.length));
  for (const d of openDayIdx) {
    let working = operators.filter((op) => shifts[op.id][d].isWorking);
    let guard = 0;
    while (working.length < minCov && guard++ < operators.length) {
      // scegli chi è a riposo quel giorno, disponibile, più sotto obiettivo
      const candidate = operators
        .filter((op) => !shifts[op.id][d].isWorking && !constraints.get(op.id)!.forceRest.has(d))
        .map((op) => ({ op, plan: perOperator.find((p) => p.id === op.id)! }))
        .filter((x) => x.plan)
        .sort((a, b) => a.plan.hours - a.plan.target - (b.plan.hours - b.plan.target))[0];
      if (!candidate) break;
      const c = constraints.get(candidate.op.id)!;
      shifts[candidate.op.id][d] = buildShift(c.onlyMorning ? morningH : c.onlyAfternoon ? afternoonH : fullDayH, {
        openMin,
        closeMin,
        midMin,
        onlyMorning: c.onlyMorning,
        onlyAfternoon: c.onlyAfternoon,
        lunchBreak: config.lunchBreak,
        breakStart: config.breakStart,
        breakEnd: config.breakEnd,
      });
      // ricalcola ore/riposi del piano di questa operatrice
      recalcPlan(candidate.plan, shifts[candidate.op.id]);
      working = operators.filter((op) => shifts[op.id][d].isWorking);
    }
    if (working.length < minCov) {
      warnings.push(`⚠ ${dayLabel(d)}: solo ${working.length}/${minCov} operatrici disponibili per la copertura minima.`);
    }
  }

  return { shifts, warnings, perOperator };
}

function recalcPlan(plan: OperatorPlan, days: Record<number, ShiftEntry>) {
  let h = 0;
  const rest: number[] = [];
  for (let d = 0; d < 6; d++) {
    h += shiftHours(days[d]);
    if (!days[d].isWorking) rest.push(d);
  }
  plan.hours = round1(h);
  plan.restDays = rest;
}

function buildShift(
  workedH: number,
  o: {
    openMin: number; closeMin: number; midMin: number;
    onlyMorning?: boolean; onlyAfternoon?: boolean;
    lunchBreak: boolean; breakStart: string; breakEnd: string;
  },
): ShiftEntry {
  if (o.onlyMorning) {
    const end = Math.min(o.closeMin, o.openMin + Math.round(workedH * 60));
    return { isWorking: true, startTime: toStr(o.openMin), endTime: toStr(end) };
  }
  if (o.onlyAfternoon) {
    const start = Math.max(o.openMin, o.closeMin - Math.round(workedH * 60));
    return { isWorking: true, startTime: toStr(start), endTime: toStr(o.closeMin) };
  }

  const useBreak = o.lunchBreak && workedH >= 5;
  const breakMin = useBreak ? toMin(o.breakEnd) - toMin(o.breakStart) : 0;
  const span = Math.round((workedH + breakMin / 60) * 60);
  const start = o.openMin;
  let end = start + span;
  if (end > o.closeMin) end = o.closeMin;

  const bs = toMin(o.breakStart);
  const be = toMin(o.breakEnd);
  if (useBreak && bs > start && be < end) {
    return { isWorking: true, startTime: toStr(start), endTime: toStr(end), breakStart: o.breakStart, breakEnd: o.breakEnd };
  }
  return { isWorking: true, startTime: toStr(start), endTime: toStr(end) };
}

function rotate<T>(arr: T[], n: number): T[] {
  if (arr.length === 0) return arr;
  const k = ((n % arr.length) + arr.length) % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
}
function roundTo30(min: number): number {
  return Math.round(min / 30) * 30;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function allRest(config: AgentConfig): number[] {
  void config;
  return [0, 1, 2, 3, 4, 5];
}
