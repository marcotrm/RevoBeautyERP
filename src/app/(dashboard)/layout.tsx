'use client';

import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { useUIStore } from '@/stores/useUIStore';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUIStore();

  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar />
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]'
        }`}
      >
        <Topbar />
        <main className="p-4 lg:p-6 page-enter">
          {children}
        </main>
      </div>
    </div>
  );
}
