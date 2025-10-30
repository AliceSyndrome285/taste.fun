"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Sparkles, Gavel, Layers } from 'lucide-react';
import clsx from 'clsx';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/theme', icon: Layers, label: 'Themes' },
    { href: '/spark', icon: Sparkles, label: 'Spark' },
    { href: '/jury', icon: Gavel, label: 'Jury' },
  ];

  return (
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
  );
}
