import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface ShelfProps {
  title: string;
  children: ReactNode;
  viewAllHref?: string;
}

export function Shelf({ title, children, viewAllHref }: ShelfProps) {
  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
          {title}
        </h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors group"
          >
            <span>View all</span>
            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        )}
      </div>

      {/* Horizontal Scroll Container */}
      <div className="overflow-x-auto overflow-y-visible -mx-4 px-4 pb-2 scrollbar-hide">
        <div className="flex gap-4 min-w-min">
          {children}
        </div>
      </div>
    </section>
  );
}
