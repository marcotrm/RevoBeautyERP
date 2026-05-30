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

export const mockFixedCosts: FixedCost[] = [];

export const mockVariableCosts: VariableCost[] = [];

export const mockInvestments: Investment[] = [];

export const mockMonthlyFinancials: MonthlyFinancials[] = [];

export const mockCashFlow: CashFlowEntry[] = [];

export const mockEconomicGoals: EconomicGoal[] = [];

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
