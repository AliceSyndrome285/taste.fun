"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, Trophy, User, Bell } from 'lucide-react';
import clsx from 'clsx';
import { HowItWorksModal } from './ui/how-it-works-modal';
import { useState } from 'react';

interface SidebarNavProps {
  isDemoMode?: boolean;
  notificationButton?: React.ReactNode;
  activityFeed?: React.ReactNode;
}

export function SidebarNav({ isDemoMode = false, notificationButton, activityFeed }: SidebarNavProps) {
  const pathname = usePathname();
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const navItems = isDemoMode
    ? [
        { href: '/demo', icon: Home, label: 'Home' },
        { href: '/demo/leaderboard', icon: Trophy, label: 'Leaderboard' },
        { href: '/demo/wallet', icon: User, label: 'Wallet' },
      ]
    : [
        { href: '/', icon: Home, label: 'Home' },
        { href: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
        { href: '/wallet', icon: User, label: 'Wallet' },
      ];

  return (
    <>
      <aside className="hidden md:flex flex-col w-48 border-r border-zinc-800 bg-[var(--surface)] fixed h-full overflow-y-auto z-50">
        <div className="p-4">
          <Link href={isDemoMode ? '/demo' : '/'} className="flex items-center gap-2 mb-6">
            <Image 
              src="/logo.png" 
              alt="Taste.fun Logo" 
              width={24} 
              height={24} 
              className="rounded-sm"
            />
            <span className="text-white font-semibold tracking-wide text-sm">Taste.fun</span>
            {isDemoMode && (
              <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-amber-400/20 text-amber-400 rounded-full border border-amber-400/30">
                DEMO
              </span>
            )}
          </Link>
          
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm',
                    isActive 
                      ? 'bg-[var(--brand)] text-[var(--brand-foreground)]' 
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  )}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Activity Feed for Demo Mode */}
        {isDemoMode && activityFeed && (
          <div className="px-3 pb-3 flex-1 overflow-hidden">
            {activityFeed}
          </div>
        )}

        <div className="mt-auto p-4 border-t border-zinc-800">
          {notificationButton && (
            <div className="mb-2">
              {notificationButton}
            </div>
          )}
          
          <button
            onClick={() => setShowHowItWorks(true)}
            className="w-full px-3 py-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-foreground)] rounded-lg font-medium transition-colors text-sm"
          >
            How It Works
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-[var(--surface)]/95 backdrop-blur-lg">
        <div className="flex items-center justify-around px-2 py-2 safe-bottom">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex flex-col items-center justify-center gap-1 py-2 px-4 rounded-lg transition-all',
                  isActive 
                    ? 'text-[var(--brand)]' 
                    : 'text-zinc-400 hover:text-white active:scale-95'
                )}
              >
                <Icon 
                  size={24} 
                  strokeWidth={isActive ? 2.5 : 2}
                  className="transition-all"
                />
                <span className={clsx(
                  'text-xs font-medium transition-all',
                  isActive ? 'opacity-100' : 'opacity-70'
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <HowItWorksModal 
        isOpen={showHowItWorks} 
        onClose={() => setShowHowItWorks(false)} 
      />
    </>
  );
}
