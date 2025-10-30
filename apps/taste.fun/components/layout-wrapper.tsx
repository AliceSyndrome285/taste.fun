"use client";

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarNav } from './sidebar-nav';

export function LayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDemoMode = pathname.startsWith('/demo');

  // For demo mode, the layout is handled by demo/layout.tsx
  if (isDemoMode) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar Navigation */}
      <SidebarNav 
        isDemoMode={false}
      />

      {/* Main Content */}
      <main className="flex-1 md:ml-48 pb-20 md:pb-8">
        {children}
      </main>
    </div>
  );
}
