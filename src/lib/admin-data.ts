import { formatCurrency } from './helpers';

// ========== TYPES ==========
export interface FixedCost {
  id: string;
  name: string;
  category: 'personale' | 'struttura' | 'utenze' | 'tasse' | 'marketing';
  subcategory: string;
  amount: number;
  frequency: 'mensile' | 'trimestrale' | 'annuale' | 'una_tantum';
  paymentDate: number; // day of month
  paymentMethod: 'bonifico' | 'rid' | 'carta' | 'contanti' | 'assegno';
  notes?: string;
  isActive: boolean;
}

export interface VariableCost {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
  receipt?: string;
}

export interface Investment {
  id: string;
  name: string;
  category: 'macchinari' | 'ristrutturazioni' | 'arredamento' | 'formazione' | 'marketing_strategico' | 'software' | 'branding';
  totalCost: number;
  date: string;
  supplier: string;
  paymentMethod: string;
  installments?: number;
  installmentsPaid?: number;
  estimatedROI: number;
  actualROI?: number;
  status: 'pianificato' | 'in_corso' | 'completato' | 'annullato';
  amortizationYears: number;
}

export interface CashFlowEntry {
  id: string;
  type: 'entrata' | 'uscita';
  category: string;
  description: string;
  amount: number;
  date: string;
  status: 'completato' | 'previsto' | 'in_ritardo';
}

export interface EconomicGoal {
  id: string;
  name: string;
  type: 'fatturato' | 'utile' | 'clienti' | 'ticket_medio' | 'marginalita' | 'vendita_prodotti';
  target: number;
  current: number;
  unit: '€' | '%' | 'n';
  period: 'mensile' | 'trimestrale' | 'annuale';
}

export interface MonthlyFinancials {
  month: string;
  monthShort: string;
  revenue: number;
  fixedCosts: number;
  variableCosts: number;
  netProfit: number;
  clients: number;
  treatments: number;
  avgTicket: number;
}

// ========== MOCK DATA ==========

export const mockFixedCosts: FixedCost[] = [
  // Personale
  { id: 'fc1', name: 'Stipendio Sara Rossi', category: 'personale', subcategory: 'Stipendi', amount: 1800, frequency: 'mensile', paymentDate: 27, paymentMethod: 'bonifico', isActive: true },
  { id: 'fc2', name: 'Stipendio Valentina Bianchi', category: 'personale', subcategory: 'Stipendi', amount: 1650, frequency: 'mensile', paymentDate: 27, paymentMethod: 'bonifico', isActive: true },
  { id: 'fc3', name: 'Stipendio Chiara Moretti', category: 'personale', subcategory: 'Stipendi', amount: 1500, frequency: 'mensile', paymentDate: 27, paymentMethod: 'bonifico', isActive: true },
  { id: 'fc4', name: 'Stipendio Francesca Romano', category: 'personale', subcategory: 'Stipendi', amount: 1400, frequency: 'mensile', paymentDate: 27, paymentMethod: 'bonifico', isActive: true },
  { id: 'fc5', name: 'Stipendio Alessia Conti', category: 'personale', subcategory: 'Stipendi', amount: 1350, frequency: 'mensile', paymentDate: 27, paymentMethod: 'bonifico', isActive: true },
  { id: 'fc6', name: 'Contributi INPS dipendenti', category: 'personale', subcategory: 'Contributi', amount: 2850, frequency: 'mensile', paymentDate: 16, paymentMethod: 'rid', isActive: true },
  { id: 'fc7', name: 'Consulente del lavoro', category: 'personale', subcategory: 'Consulenti esterni', amount: 350, frequency: 'mensile', paymentDate: 5, paymentMethod: 'bonifico', isActive: true },
  { id: 'fc8', name: 'Tredicesima accantonamento', category: 'personale', subcategory: 'Tredicesime', amount: 645, frequency: 'mensile', paymentDate: 1, paymentMethod: 'bonifico', isActive: true },
  // Struttura
  { id: 'fc9', name: 'Affitto locale', category: 'struttura', subcategory: 'Affitto', amount: 2800, frequency: 'mensile', paymentDate: 1, paymentMethod: 'bonifico', isActive: true },
  { id: 'fc10', name: 'Condominio', category: 'struttura', subcategory: 'Condominio', amount: 180, frequency: 'mensile', paymentDate: 1, paymentMethod: 'rid', isActive: true },
  { id: 'fc11', name: 'Manutenzione ordinaria', category: 'struttura', subcategory: 'Manutenzione', amount: 200, frequency: 'mensile', paymentDate: 15, paymentMethod: 'bonifico', isActive: true },
  { id: 'fc12', name: 'Allarme + videosorveglianza', category: 'struttura', subcategory: 'Allarme', amount: 85, frequency: 'mensile', paymentDate: 5, paymentMethod: 'rid', isActive: true },
  // Utenze
  { id: 'fc13', name: 'Energia elettrica', category: 'utenze', subcategory: 'Corrente', amount: 480, frequency: 'mensile', paymentDate: 10, paymentMethod: 'rid', isActive: true },
  { id: 'fc14', name: 'Acqua', category: 'utenze', subcategory: 'Acqua', amount: 95, frequency: 'mensile', paymentDate: 15, paymentMethod: 'rid', isActive: true },
  { id: 'fc15', name: 'Gas', category: 'utenze', subcategory: 'Gas', amount: 120, frequency: 'mensile', paymentDate: 12, paymentMethod: 'rid', isActive: true },
  { id: 'fc16', name: 'Internet fibra', category: 'utenze', subcategory: 'Internet', amount: 39, frequency: 'mensile', paymentDate: 8, paymentMethod: 'rid', isActive: true },
  { id: 'fc17', name: 'Telefono mobile aziendale', category: 'utenze', subcategory: 'Telefono', amount: 25, frequency: 'mensile', paymentDate: 8, paymentMethod: 'rid', isActive: true },
  // Tasse e amministrazione
  { id: 'fc18', name: 'Commercialista', category: 'tasse', subcategory: 'Commercialista', amount: 450, frequency: 'mensile', paymentDate: 5, paymentMethod: 'bonifico', isActive: true },
  { id: 'fc19', name: 'INAIL', category: 'tasse', subcategory: 'INAIL', amount: 280, frequency: 'trimestrale', paymentDate: 16, paymentMethod: 'rid', isActive: true },
  { id: 'fc20', name: 'TARI', category: 'tasse', subcategory: 'Tari', amount: 380, frequency: 'trimestrale', paymentDate: 1, paymentMethod: 'bonifico', isActive: true },
  { id: 'fc21', name: 'POS commissioni bancarie', category: 'tasse', subcategory: 'POS e commissioni bancarie', amount: 320, frequency: 'mensile', paymentDate: 1, paymentMethod: 'rid', isActive: true },
  { id: 'fc22', name: 'Software gestionale', category: 'tasse', subcategory: 'Software gestionali', amount: 89, frequency: 'mensile', paymentDate: 1, paymentMethod: 'carta', isActive: true },
  { id: 'fc23', name: 'Assicurazione RC', category: 'tasse', subcategory: 'Assicurazioni', amount: 1200, frequency: 'annuale', paymentDate: 15, paymentMethod: 'bonifico', isActive: true },
  // Marketing
  { id: 'fc24', name: 'Meta Ads', category: 'marketing', subcategory: 'Meta Ads', amount: 800, frequency: 'mensile', paymentDate: 1, paymentMethod: 'carta', isActive: true },
  { id: 'fc25', name: 'Google Ads', category: 'marketing', subcategory: 'Google Ads', amount: 400, frequency: 'mensile', paymentDate: 1, paymentMethod: 'carta', isActive: true },
  { id: 'fc26', name: 'Content creator', category: 'marketing', subcategory: 'Produzione contenuti', amount: 500, frequency: 'mensile', paymentDate: 10, paymentMethod: 'bonifico', isActive: true },
  { id: 'fc27', name: 'Fotografo/Videomaker', category: 'marketing', subcategory: 'Fotografo/videomaker', amount: 350, frequency: 'mensile', paymentDate: 15, paymentMethod: 'bonifico', isActive: true },
];

export const mockVariableCosts: VariableCost[] = [
  { id: 'vc1', name: 'Carta lettino (pacco 6 rotoli)', category: 'Carta lettino', amount: 28, date: '2025-05-26' },
  { id: 'vc2', name: 'Guanti nitrile (box 100)', category: 'Guanti', amount: 12, date: '2025-05-26' },
  { id: 'vc3', name: 'Crema viso professionale', category: 'Creme', amount: 45, date: '2025-05-25' },
  { id: 'vc4', name: 'Siero acido ialuronico', category: 'Sieri', amount: 68, date: '2025-05-25' },
  { id: 'vc5', name: 'Mascherine chirurgiche (50pz)', category: 'Mascherine', amount: 8, date: '2025-05-24' },
  { id: 'vc6', name: 'Detergente professionale', category: 'Detergenti', amount: 22, date: '2025-05-24' },
  { id: 'vc7', name: 'Caffè capsule (100pz)', category: 'Caffè', amount: 35, date: '2025-05-23' },
  { id: 'vc8', name: 'Acqua minerale (cartone 24)', category: 'Acqua clienti', amount: 6, date: '2025-05-23' },
  { id: 'vc9', name: 'Lavanderia asciugamani', category: 'Lavanderia', amount: 85, date: '2025-05-22' },
  { id: 'vc10', name: 'Prodotti pulizia pavimenti', category: 'Prodotti pulizia', amount: 18, date: '2025-05-22' },
  { id: 'vc11', name: 'Monouso spatole ceretta', category: 'Monouso', amount: 15, date: '2025-05-21' },
  { id: 'vc12', name: 'Gel ultrasuoni', category: 'Prodotti cabina', amount: 32, date: '2025-05-21' },
  { id: 'vc13', name: 'Rotoloni carta', category: 'Rotoloni', amount: 14, date: '2025-05-20' },
  { id: 'vc14', name: 'Cancelleria varia', category: 'Cancelleria', amount: 22, date: '2025-05-20' },
  { id: 'vc15', name: 'Snack e biscotti clienti', category: 'Snack', amount: 18, date: '2025-05-19' },
  { id: 'vc16', name: 'Manutenzione laser diodo', category: 'Manutenzione macchinari', amount: 150, date: '2025-05-18' },
];

export const mockInvestments: Investment[] = [
  { id: 'inv1', name: 'Laser a diodo 808nm', category: 'macchinari', totalCost: 18000, date: '2024-03-15', supplier: 'MedTech Italia', paymentMethod: 'Finanziamento', installments: 24, installmentsPaid: 14, estimatedROI: 280, actualROI: 320, status: 'in_corso', amortizationYears: 5 },
  { id: 'inv2', name: 'Criolipolisi professionale', category: 'macchinari', totalCost: 12000, date: '2024-06-20', supplier: 'BeautyPro Devices', paymentMethod: 'Leasing', installments: 36, installmentsPaid: 11, estimatedROI: 220, actualROI: 195, status: 'in_corso', amortizationYears: 5 },
  { id: 'inv3', name: 'Ristrutturazione cabina 3', category: 'ristrutturazioni', totalCost: 8500, date: '2024-09-01', supplier: 'EdilDesign Srl', paymentMethod: 'Bonifico', estimatedROI: 150, actualROI: 140, status: 'completato', amortizationYears: 10 },
  { id: 'inv4', name: 'Arredo reception premium', category: 'arredamento', totalCost: 5200, date: '2025-01-10', supplier: 'Mobili Elegance', paymentMethod: 'Bonifico', estimatedROI: 80, actualROI: 65, status: 'completato', amortizationYears: 7 },
  { id: 'inv5', name: 'Corso laser avanzato (3 estetiste)', category: 'formazione', totalCost: 2400, date: '2025-02-15', supplier: 'Accademia Beauty Pro', paymentMethod: 'Carta', estimatedROI: 350, actualROI: 290, status: 'completato', amortizationYears: 1 },
  { id: 'inv6', name: 'Rebranding completo', category: 'branding', totalCost: 4500, date: '2025-03-01', supplier: 'Studio Creativo Srl', paymentMethod: 'Bonifico', installments: 3, installmentsPaid: 2, estimatedROI: 120, status: 'in_corso', amortizationYears: 3 },
  { id: 'inv7', name: 'Radiofrequenza viso 4.0', category: 'macchinari', totalCost: 9500, date: '2025-06-01', supplier: 'MedTech Italia', paymentMethod: 'Finanziamento', installments: 18, installmentsPaid: 0, estimatedROI: 250, status: 'pianificato', amortizationYears: 5 },
];

export const mockMonthlyFinancials: MonthlyFinancials[] = [
  { month: '2025-01', monthShort: 'Gen', revenue: 22800, fixedCosts: 18200, variableCosts: 1850, netProfit: 2750, clients: 128, treatments: 285, avgTicket: 80 },
  { month: '2025-02', monthShort: 'Feb', revenue: 24500, fixedCosts: 18200, variableCosts: 1920, netProfit: 4380, clients: 135, treatments: 302, avgTicket: 81 },
  { month: '2025-03', monthShort: 'Mar', revenue: 27200, fixedCosts: 18200, variableCosts: 2100, netProfit: 6900, clients: 148, treatments: 328, avgTicket: 83 },
  { month: '2025-04', monthShort: 'Apr', revenue: 25800, fixedCosts: 18350, variableCosts: 1980, netProfit: 5470, clients: 142, treatments: 310, avgTicket: 83 },
  { month: '2025-05', monthShort: 'Mag', revenue: 29500, fixedCosts: 18350, variableCosts: 2250, netProfit: 8900, clients: 156, treatments: 342, avgTicket: 86 },
  { month: '2025-06', monthShort: 'Giu', revenue: 31200, fixedCosts: 18350, variableCosts: 2380, netProfit: 10470, clients: 165, treatments: 365, avgTicket: 85 },
  { month: '2025-07', monthShort: 'Lug', revenue: 28900, fixedCosts: 18350, variableCosts: 2150, netProfit: 8400, clients: 152, treatments: 338, avgTicket: 85 },
  { month: '2025-08', monthShort: 'Ago', revenue: 18500, fixedCosts: 18350, variableCosts: 1400, netProfit: -1250, clients: 95, treatments: 210, avgTicket: 88 },
  { month: '2025-09', monthShort: 'Set', revenue: 30800, fixedCosts: 18350, variableCosts: 2300, netProfit: 10150, clients: 162, treatments: 355, avgTicket: 87 },
  { month: '2025-10', monthShort: 'Ott', revenue: 32500, fixedCosts: 18500, variableCosts: 2420, netProfit: 11580, clients: 170, treatments: 372, avgTicket: 87 },
  { month: '2025-11', monthShort: 'Nov', revenue: 33800, fixedCosts: 18500, variableCosts: 2500, netProfit: 12800, clients: 178, treatments: 388, avgTicket: 87 },
  { month: '2025-12', monthShort: 'Dic', revenue: 35200, fixedCosts: 19200, variableCosts: 2600, netProfit: 13400, clients: 185, treatments: 402, avgTicket: 87 },
];

export const mockCashFlow: CashFlowEntry[] = [
  { id: 'cf1', type: 'entrata', category: 'Trattamenti', description: 'Incassi giornalieri trattamenti', amount: 1250, date: '2025-05-28', status: 'completato' },
  { id: 'cf2', type: 'entrata', category: 'Prodotti', description: 'Vendita prodotti retail', amount: 380, date: '2025-05-28', status: 'completato' },
  { id: 'cf3', type: 'uscita', category: 'Stipendi', description: 'Stipendi maggio', amount: 7700, date: '2025-05-27', status: 'completato' },
  { id: 'cf4', type: 'uscita', category: 'Affitto', description: 'Affitto giugno', amount: 2800, date: '2025-06-01', status: 'previsto' },
  { id: 'cf5', type: 'uscita', category: 'Utenze', description: 'Bolletta elettrica maggio', amount: 480, date: '2025-06-10', status: 'previsto' },
  { id: 'cf6', type: 'entrata', category: 'Pacchetti', description: 'Pacchetto Gold - Maria Bianchi', amount: 450, date: '2025-05-27', status: 'completato' },
  { id: 'cf7', type: 'uscita', category: 'Fornitori', description: 'Forniture cabina', amount: 520, date: '2025-05-30', status: 'previsto' },
  { id: 'cf8', type: 'uscita', category: 'Marketing', description: 'Meta Ads giugno', amount: 800, date: '2025-06-01', status: 'previsto' },
  { id: 'cf9', type: 'entrata', category: 'Trattamenti', description: 'Incassi previsti settimana', amount: 6200, date: '2025-06-02', status: 'previsto' },
  { id: 'cf10', type: 'uscita', category: 'INPS', description: 'Contributi INPS Q2', amount: 2850, date: '2025-06-16', status: 'previsto' },
  { id: 'cf11', type: 'uscita', category: 'Leasing', description: 'Rata criolipolisi', amount: 333, date: '2025-06-05', status: 'previsto' },
  { id: 'cf12', type: 'entrata', category: 'Trattamenti', description: 'Previsione incassi giugno', amount: 31200, date: '2025-06-30', status: 'previsto' },
];

export const mockEconomicGoals: EconomicGoal[] = [
  { id: 'g1', name: 'Fatturato Mensile', type: 'fatturato', target: 35000, current: 29500, unit: '€', period: 'mensile' },
  { id: 'g2', name: 'Utile Netto', type: 'utile', target: 12000, current: 8900, unit: '€', period: 'mensile' },
  { id: 'g3', name: 'Clienti Unici', type: 'clienti', target: 180, current: 156, unit: 'n', period: 'mensile' },
  { id: 'g4', name: 'Ticket Medio', type: 'ticket_medio', target: 95, current: 86, unit: '€', period: 'mensile' },
  { id: 'g5', name: 'Marginalità', type: 'marginalita', target: 38, current: 30.2, unit: '%', period: 'mensile' },
  { id: 'g6', name: 'Vendita Prodotti', type: 'vendita_prodotti', target: 5000, current: 3200, unit: '€', period: 'mensile' },
  { id: 'g7', name: 'Fatturato Annuale', type: 'fatturato', target: 380000, current: 298700, unit: '€', period: 'annuale' },
  { id: 'g8', name: 'Utile Annuale', type: 'utile', target: 120000, current: 93980, unit: '€', period: 'annuale' },
];

// ========== COMPUTED HELPERS ==========

export function getTotalFixedCostsMonthly(costs: FixedCost[]): number {
  return costs.filter(c => c.isActive).reduce((sum, c) => {
    if (c.frequency === 'mensile') return sum + c.amount;
    if (c.frequency === 'trimestrale') return sum + c.amount / 3;
    if (c.frequency === 'annuale') return sum + c.amount / 12;
    return sum + c.amount;
  }, 0);
}

export function getFixedCostsByCategory(costs: FixedCost[]): Record<string, number> {
  const result: Record<string, number> = {};
  costs.filter(c => c.isActive).forEach(c => {
    const monthly = c.frequency === 'mensile' ? c.amount : c.frequency === 'trimestrale' ? c.amount / 3 : c.frequency === 'annuale' ? c.amount / 12 : c.amount;
    result[c.category] = (result[c.category] || 0) + monthly;
  });
  return result;
}

export function getBreakEvenData(fixedCosts: number, variableCostRatio: number, avgTicket: number) {
  const contributionMargin = avgTicket * (1 - variableCostRatio);
  const breakEvenRevenue = fixedCosts / (1 - variableCostRatio);
  const breakEvenClients = Math.ceil(breakEvenRevenue / avgTicket);
  const breakEvenTreatments = breakEvenClients;
  const workingDays = 26;
  const breakEvenDays = Math.ceil((breakEvenRevenue / (avgTicket * (breakEvenClients / workingDays))));
  return { breakEvenRevenue, breakEvenClients, breakEvenTreatments, breakEvenDays, contributionMargin };
}

export const FIXED_COST_CATEGORY_LABELS: Record<string, string> = {
  personale: 'Personale',
  struttura: 'Struttura',
  utenze: 'Utenze',
  tasse: 'Tasse e Amministrazione',
  marketing: 'Marketing',
};

export const FIXED_COST_CATEGORY_COLORS: Record<string, string> = {
  personale: '#A855F7',
  struttura: '#3B82F6',
  utenze: '#F59E0B',
  tasse: '#EF4444',
  marketing: '#EC4899',
};

export const INVESTMENT_CATEGORY_LABELS: Record<string, string> = {
  macchinari: 'Macchinari',
  ristrutturazioni: 'Ristrutturazioni',
  arredamento: 'Arredamento',
  formazione: 'Formazione',
  marketing_strategico: 'Marketing Strategico',
  software: 'Software',
  branding: 'Branding',
};
