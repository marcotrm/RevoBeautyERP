import { prisma } from '@/lib/prisma';

export interface C95Config {
  enabled: boolean;
  apiUsername: string;
  apiPassword: string;
  idMittente: string;
  partitaIva: string; // P.IVA del centro, usata solo per risolvere idMittente automaticamente dopo il login
  baseUrl: string; // https://app.c95.it/webservice/RestAPI.asmx (prod) oppure https://testdomain.c95.it/webservice/RestAPI.asmx (test)
  deviceId: string;
  deviceName: string;
  vatRate: number; // aliquota IVA di default applicata allo scontrino (es. 22)
  // token di sessione, cache per evitare un login ad ogni scontrino
  token?: string;
  tokenExpiresAt?: string; // ISO
}

const ROW_ID = 'integration:c95';
const DEFAULT_BASE_URL = 'https://testdomain.c95.it/webservice/RestAPI.asmx';

const defaults: C95Config = {
  enabled: false,
  apiUsername: '',
  apiPassword: '',
  idMittente: '',
  partitaIva: '',
  baseUrl: DEFAULT_BASE_URL,
  deviceId: '',
  deviceName: '',
  vatRate: 22,
};

export async function getC95Config(): Promise<C95Config> {
  try {
    const row = await prisma.adminEntry.findUnique({ where: { rowId: ROW_ID } });
    const d = (row?.data as Partial<C95Config>) || {};
    return { ...defaults, ...d };
  } catch {
    return { ...defaults };
  }
}

async function saveC95ConfigInternal(cfg: C95Config) {
  await prisma.adminEntry.upsert({
    where: { rowId: ROW_ID },
    create: { rowId: ROW_ID, kind: 'integration', entityId: 'c95', data: JSON.parse(JSON.stringify(cfg)), createdAt: new Date().toISOString() },
    update: { data: JSON.parse(JSON.stringify(cfg)) },
  });
}

export async function saveC95Config(cfg: Omit<C95Config, 'token' | 'tokenExpiresAt'>) {
  const current = await getC95Config();
  await saveC95ConfigInternal({ ...current, ...cfg });
}

// ============================================================
// Client HTTP verso l'endpoint REST (ASP.NET .asmx) di C95.
// Alcune risposte arrivano incapsulate in { d: ... } (comportamento classico ASMX).
// ============================================================

function unwrapD(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object' && 'd' in (body as Record<string, unknown>)) {
    const d = (body as Record<string, unknown>).d;
    if (typeof d === 'string') {
      try { return JSON.parse(d); } catch { return {}; }
    }
    if (d && typeof d === 'object') return d as Record<string, unknown>;
  }
  return (body as Record<string, unknown>) || {};
}

async function c95Post(baseUrl: string, endpoint: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  let body: unknown = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
  return unwrapD(body);
}

function isErrorResponse(body: Record<string, unknown>): string | null {
  if (Array.isArray(body.errori) && body.errori.length) {
    const first = body.errori[0] as { codice?: string; descrizione?: string };
    const codice = String(first?.codice ?? '');
    if (codice && codice !== '0') return first?.descrizione || `Errore C95 (codice ${codice})`;
  }
  if ('errCode' in body) {
    const code = String(body.errCode ?? '');
    if (code && code !== '0') return String(body.errMsg || `Errore C95 (codice ${code})`);
  }
  return null;
}

// Login: ottiene/rinnova il token di sessione (valido ~20h) e lo mette in cache su AdminEntry.
async function getToken(cfg: C95Config): Promise<{ token: string; cfg: C95Config }> {
  const now = Date.now();
  if (cfg.token && cfg.tokenExpiresAt && new Date(cfg.tokenExpiresAt).getTime() > now) {
    return { token: cfg.token, cfg };
  }
  const body = await c95Post(cfg.baseUrl, 'login', {
    username: cfg.apiUsername,
    password: cfg.apiPassword,
    source: 'API',
  });
  const err = isErrorResponse(body);
  if (err) throw new Error(`C95 login: ${err} (verifica di usare le credenziali API, non quelle del portale)`);
  const token = String(body.token || '');
  if (!token) throw new Error('C95 login: token non ricevuto');
  const expiresAt = new Date(now + 20 * 60 * 60 * 1000).toISOString();
  const updated: C95Config = { ...cfg, token, tokenExpiresAt: expiresAt };
  await saveC95ConfigInternal(updated);
  return { token, cfg: updated };
}

// Login "grezzo": posta a /login e torna l'intero corpo della risposta (token, userId,
// qrCode.anag.piva, appTemplate, ...) — serve per risolvere id_mittente automaticamente.
async function rawLogin(cfg: C95Config): Promise<Record<string, unknown>> {
  const body = await c95Post(cfg.baseUrl, 'login', {
    username: cfg.apiUsername,
    password: cfg.apiPassword,
    source: 'API',
  });
  const err = isErrorResponse(body);
  if (err) throw new Error(`C95 login: ${err} (verifica di usare le credenziali API, non quelle del portale)`);
  if (!body.token) throw new Error('C95 login: token non ricevuto');
  return body;
}

function normalizePiva(piva: string | null | undefined): string {
  return String(piva ?? '').replace(/\D/g, '');
}

interface DomainUser {
  userId: string;
  email?: string | null;
  denominazione?: string | null;
  piva?: string | null;
}

function normalizeUserRecord(row: Record<string, unknown>): DomainUser {
  const anag = (row.anag as Record<string, unknown>) || (row.qrCode as Record<string, unknown> | undefined)?.anag as Record<string, unknown> | undefined;
  const piva = (row.partitaIVA ?? row.partitaIva ?? row.piva ?? row.Piva ?? anag?.piva) as string | undefined;
  return {
    userId: String(row.userId ?? row.UserId ?? row.id ?? ''),
    email: (row.email ?? row.Email) as string | undefined,
    denominazione: (row.denominazione ?? row.denom ?? row.Denominazione) as string | undefined,
    piva: piva ? String(piva) : null,
  };
}

// Estrae ricorsivamente eventuali sotto-account da una risposta getUsersDomain (forma non documentata/variabile).
function extractDomainUsers(response: unknown, seen = new Set<unknown>()): DomainUser[] {
  if (!response || typeof response !== 'object' || seen.has(response)) return [];
  seen.add(response);
  const row = response as Record<string, unknown>;
  const users: DomainUser[] = [];
  const topId = row.userId ?? row.UserId ?? row.id;
  if (typeof topId === 'string' && /^[0-9a-f-]{36}$/i.test(topId)) {
    users.push(normalizeUserRecord(row));
  }
  for (const [key, value] of Object.entries(row)) {
    if (!value || typeof value !== 'object') continue;
    const childId = (value as Record<string, unknown>).userId ?? (value as Record<string, unknown>).UserId ?? (value as Record<string, unknown>).id;
    const looksLikeUser = childId && (!Number.isNaN(Number(key)) || 'email' in (value as object) || 'Email' in (value as object) || 'partitaIVA' in (value as object) || 'partitaIva' in (value as object));
    if (childId && looksLikeUser) {
      users.push(normalizeUserRecord(value as Record<string, unknown>));
    } else {
      users.push(...extractDomainUsers(value, seen));
    }
  }
  const byId = new Map<string, DomainUser>();
  for (const u of users) if (u.userId) byId.set(u.userId, u);
  return [...byId.values()];
}

export interface ResolveIdMittenteResult {
  idMittente: string | null;
  source: 'login_piva_match' | 'domain_piva' | 'login_esercente' | 'domain_single' | 'login_with_candidates' | 'login_fallback' | 'ambiguous' | 'not_found';
  message: string;
  candidates?: DomainUser[];
}

// Risolve id_mittente a partire da userId/token del login, replicando la stessa strategia
// usata in SvaPro (C95AccountResolver): login diretto vs admin di dominio con sotto-account.
async function resolveIdMittente(cfg: C95Config, token: string, loginBody: Record<string, unknown>): Promise<ResolveIdMittenteResult> {
  const loginUserId = String(loginBody.userId ?? '');
  const targetPiva = normalizePiva(cfg.partitaIva);
  const qrCode = loginBody.qrCode as Record<string, unknown> | undefined;
  const anag = qrCode?.anag as Record<string, unknown> | undefined;
  const loginPiva = anag?.piva as string | undefined;

  if (targetPiva && loginPiva && normalizePiva(loginPiva) === targetPiva) {
    return { idMittente: loginUserId, source: 'login_piva_match', message: 'Account API corrisponde alla P.IVA configurata' };
  }

  let users: DomainUser[] = [];
  try {
    const domain = await c95Post(cfg.baseUrl, 'getUsersDomain', { token, idMittente: loginUserId });
    users = extractDomainUsers(domain);
  } catch {
    // getUsersDomain non sempre disponibile — si prosegue con il fallback sul login
  }

  if (targetPiva && users.length) {
    const matches = users.filter((u) => normalizePiva(u.piva) === targetPiva);
    if (matches.length === 1) {
      const m = matches[0];
      return { idMittente: m.userId, source: 'domain_piva', message: `Trovato account dominio per P.IVA: ${m.denominazione || m.email || m.userId}` };
    }
    if (matches.length > 1) {
      return { idMittente: null, source: 'ambiguous', message: 'Più account con la stessa P.IVA — seleziona id_mittente manualmente', candidates: matches };
    }
    return { idMittente: null, source: 'not_found', message: `Nessun sotto-account dominio con P.IVA ${cfg.partitaIva}. Verifica la P.IVA o chiedi id_mittente a C95.`, candidates: users };
  }

  const appTemplate = String(loginBody.appTemplate ?? '');
  if (/ESERCENTE/i.test(appTemplate) && !users.length) {
    return { idMittente: loginUserId, source: 'login_esercente', message: 'Account esercente (login diretto, non admin dominio)' };
  }

  const others = users.filter((u) => u.userId !== loginUserId);
  if (others.length === 1) {
    const m = others[0];
    return { idMittente: m.userId, source: 'domain_single', message: `Unico sotto-account dominio: ${m.denominazione || m.email || m.userId}` };
  }

  if (users.length) {
    return { idMittente: loginUserId, source: 'login_with_candidates', message: 'ATTENZIONE: id_mittente dal login potrebbe essere admin dominio. Imposta la P.IVA e ripeti, oppure scegli un account tra i candidati.', candidates: users };
  }

  return { idMittente: loginUserId, source: 'login_fallback', message: 'id_mittente ricavato dal login API. Se l\'emissione fallisce, verifica che non sia l\'admin dominio.' };
}

// CLOUD mode: le credenziali AdE restano su C95, non ne serve una copia qui.
function adeFields() {
  const cloud = Buffer.from('CLOUD').toString('base64');
  return {
    AdE_CodiceFiscale: cloud,
    AdE_PIN: cloud,
    AdE_Password: cloud,
    AdE_TipoIncarico: 'CLOUD',
  };
}

export interface C95Line {
  descrizione: string;
  prezzoUnitario: number;
  quantita: number;
  aliquotaIVA?: number;
}

export interface EmitReceiptResult {
  ok: boolean;
  status: 'emitted' | 'failed' | 'uncertain';
  idScontrino?: string;
  gid?: string;
  idtrx?: string;
  progressivo?: string;
  error?: string;
}

// Emette lo scontrino fiscale elettronico per un incasso. Non lancia mai: torna sempre un esito
// con status 'emitted' | 'failed' (sicuro da ritentare) | 'uncertain' (chiamata partita, esito ignoto:
// NON ritentare automaticamente, va verificato a mano prima di riemettere).
export async function emitC95Receipt(params: {
  amount: number;
  paymentMethod: string; // 'cash' | 'card' | ... usato solo per scegliere PC (contanti) o altro
  lines: C95Line[];
}): Promise<EmitReceiptResult> {
  const cfg = await getC95Config();
  if (!cfg.enabled) return { ok: false, status: 'failed', error: 'Integrazione C95 non attiva' };

  let token: string;
  let liveCfg: C95Config;
  try {
    const t = await getToken(cfg);
    token = t.token;
    liveCfg = t.cfg;
  } catch (e) {
    return { ok: false, status: 'failed', error: e instanceof Error ? e.message : 'Login C95 fallito' };
  }

  const isCashOnly = /contant|cash/i.test(params.paymentMethod);
  const prodList = {
    list: params.lines.map((l) => ({
      aliquotaIVA: l.aliquotaIVA ?? cfg.vatRate,
      descrizioneProdotto: l.descrizione,
      natura: '',
      prezzoUnitario: Math.round(l.prezzoUnitario * 100) / 100,
      quantita: Math.round(l.quantita * 1000) / 1000,
      riferimentoNormativo: '',
    })),
  };

  const deviceId = cfg.deviceId || 'API_STORE_1';
  const deviceName = cfg.deviceName || 'Cassa Revobeauty';

  const payload = {
    token,
    idMittente: cfg.idMittente,
    ...adeFields(),
    deviceId,
    deviceName,
    codiceLotteriaCliente: '',
    idScontrino: '',
    isRetry: 0,
    modalitaPagamento: isCashOnly ? 'PC' : 'PE',
    prodList,
  };

  let body: Record<string, unknown>;
  try {
    body = await c95Post(liveCfg.baseUrl, 'creaDocumentoCommerciale', payload);
  } catch (e) {
    // La chiamata HTTP è fallita dopo l'invio: non sappiamo se AdE ha comunque emesso il documento.
    return { ok: false, status: 'uncertain', error: e instanceof Error ? e.message : 'Errore di rete verso C95' };
  }

  const idScontrino = String(body.idScontrino ?? body.IdScontrino ?? '') || undefined;
  const emitted = !!body.esito || !!idScontrino;
  if (!emitted) {
    const err = isErrorResponse(body);
    return { ok: false, status: 'failed', error: err || 'C95 ha rifiutato lo scontrino' };
  }

  return {
    ok: true,
    status: 'emitted',
    idScontrino,
    gid: (body.gid as string) || undefined,
    idtrx: (body.idtrx ?? body.idTrx ?? body.Idtrx) as string | undefined,
    progressivo: (body.progressivo as string) || idScontrino,
  };
}

export interface VoidReceiptResult {
  ok: boolean;
  error?: string;
}

// Annulla ("reso/annullo totale") uno scontrino già emesso. Va chiamato PRIMA di cancellare
// localmente una transazione che è stata fiscalmente emessa, altrimenti resta un documento
// AdE emesso senza corrispondenza locale.
export async function voidC95Receipt(params: { idScontrino: string; idtrx?: string }): Promise<VoidReceiptResult> {
  const cfg = await getC95Config();
  if (!cfg.enabled) return { ok: false, error: 'Integrazione C95 non attiva' };

  let token: string;
  let liveCfg: C95Config;
  try {
    const t = await getToken(cfg);
    token = t.token;
    liveCfg = t.cfg;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Login C95 fallito' };
  }

  const deviceId = cfg.deviceId || 'API_STORE_1';
  const deviceName = cfg.deviceName || 'Cassa Revobeauty';

  const payload: Record<string, unknown> = {
    token,
    idMittente: cfg.idMittente,
    ...adeFields(),
    IdScontrino: params.idScontrino,
    Tipo: 'A',
    deviceId,
    deviceName,
  };
  if (params.idtrx) payload.Idtrx = params.idtrx;

  let body: Record<string, unknown>;
  try {
    body = await c95Post(liveCfg.baseUrl, 'creaResoAnnulloDocumentoCommerciale', payload);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Errore di rete verso C95' };
  }
  const err = isErrorResponse(body);
  if (err) return { ok: false, error: err };
  return { ok: true };
}

export interface TestConnectionResult {
  ok: boolean;
  error?: string;
  idMittente?: string;
  message?: string;
  candidates?: DomainUser[];
}

// Test di connessione: fa login con username/password API e, se manca, risolve automaticamente
// id_mittente (stessa strategia di SvaPro: match per P.IVA, sotto-account di dominio, o login diretto).
export async function testC95Connection(): Promise<TestConnectionResult> {
  const cfg = await getC95Config();
  if (!cfg.apiUsername || !cfg.apiPassword) {
    return { ok: false, error: 'Compila username e password API' };
  }
  let loginBody: Record<string, unknown>;
  try {
    loginBody = await rawLogin(cfg);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Connessione fallita' };
  }
  const token = String(loginBody.token);
  const expiresAt = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();

  if (cfg.idMittente) {
    await saveC95ConfigInternal({ ...cfg, token, tokenExpiresAt: expiresAt });
    return { ok: true, idMittente: cfg.idMittente, message: 'Connessione riuscita' };
  }

  const resolved = await resolveIdMittente(cfg, token, loginBody);
  const updated: C95Config = { ...cfg, token, tokenExpiresAt: expiresAt, idMittente: resolved.idMittente || '' };
  await saveC95ConfigInternal(updated);

  if (!resolved.idMittente) {
    return { ok: false, error: resolved.message, candidates: resolved.candidates };
  }
  return { ok: true, idMittente: resolved.idMittente, message: resolved.message, candidates: resolved.candidates };
}
