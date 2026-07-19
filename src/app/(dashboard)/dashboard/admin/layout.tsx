'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Receipt, ShoppingCart, TrendingUp,
  Target, FileBarChart, Wallet, Flag,
} from 'lucide-react';
import { useFixedCostStore } from '@/stores/useFixedCostStore';
import { useVariableCostStore } from '@/stores/useVariableCostStore';
import { useInvestmentStore } from '@/stores/useInvestmentStore';
import { useCashFlowStore } from '@/stores/useCashFlowStore';
import { useGoalStore } from '@/stores/useGoalStore';
import { useFinancialStore } from '@/stores/useFinancialStore';

const adminNav = [
  { href: '/dashboard/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/admin/fixed-costs', label: 'Costi Fissi', icon: Receipt },
  { href: '/dashboard/admin/variable-costs', label: 'Costi Variabili', icon: ShoppingCart },
  { href: '/dashboard/admin/investments', label: 'Investimenti', icon: TrendingUp },
  { href: '/dashboard/admin/breakeven', label: 'Punto di Pareggio', icon: Target },
  { href: '/dashboard/admin/cashflow', label: 'Cash Flow', icon: Wallet },
  { href: '/dashboard/admin/goals', label: 'Obiettivi', icon: Flag },
  { href: '/dashboard/admin/partner-expenses', label: 'Spese Soci', icon: Wallet },
  { href: '/dashboard/admin/reports', label: 'Report', icon: FileBarChart },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Carica dal DB condiviso tutti i dati di Amministrazione (una volta per sessione admin)
  const fetchFixedCosts = useFixedCostStore(s => s.fetchFixedCosts);
  const fetchVariableCosts = useVariableCostStore(s => s.fetchVariableCosts);
  const fetchInvestments = useInvestmentStore(s => s.fetchInvestments);
  const fetchCashFlow = useCashFlowStore(s => s.fetchCashFlow);
  const fetchGoals = useGoalStore(s => s.fetchGoals);
  const fetchFinancials = useFinancialStore(s => s.fetchFinancials);

  useEffect(() => {
    fetchFixedCosts();
    fetchVariableCosts();
    fetchInvestments();
    fetchCashFlow();
    fetchGoals();
    fetchFinancials();
  }, [fetchFixedCosts, fetchVariableCosts, fetchInvestments, fetchCashFlow, fetchGoals, fetchFinancials]);

  return (
    <div className="space-y-4">
      {/* Admin Sub-Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {adminNav.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
              {isActive && (
                <motion.div
                  layoutId="admin-tab"
                  className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-accent"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* Content */}
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
