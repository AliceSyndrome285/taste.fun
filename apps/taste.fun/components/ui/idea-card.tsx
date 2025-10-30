/**
 * Taste & Earn - IdeaCard Component (V3)
 * 显示创意卡片，适配投票模型
 */

import Link from 'next/link';
import { Clock, Users, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { IdeaStatus, formatTimeRemaining, getStatusBadge } from '@/lib/types/consensus-v3';

interface IdeaCardProps {
  id: string;
  prompt: string;
  coverImage?: string;
  totalStaked: number; // in SOL
  totalVoters: number;
  initiator: string;
  status: IdeaStatus;
  votingDeadline?: number; // timestamp
  className?: string;
}

export function IdeaCard({
  id,
  prompt,
  coverImage,
  totalStaked,
  totalVoters,
  initiator,
  status,
  votingDeadline,
  className,
}: IdeaCardProps) {
  const statusBadge = getStatusBadge(status);
  const truncatedPrompt = prompt.length > 80 ? prompt.substring(0, 80) + '...' : prompt;

  return (
    <Link
      href={`/idea/${id}`}
      className={clsx(
        'group block rounded-lg overflow-hidden bg-[var(--surface)] hover:bg-zinc-800/80 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]',
        className
      )}
    >
      {/* Cover Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-900">
        {coverImage ? (
          <img
            src={coverImage}
            alt={truncatedPrompt}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
            {status === IdeaStatus.GeneratingImages ? (
              <Loader2 size={48} className="text-zinc-700 animate-spin" />
            ) : (
              <div className="text-zinc-700 text-6xl">🎨</div>
            )}
          </div>
        )}
        
        {/* Status Badge */}
        <div className={`absolute top-2 right-2 px-2 py-1 rounded-md ${statusBadge.color}`}>
          <span className="text-xs font-medium">
            {statusBadge.text}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Prompt */}
        <h3 className="font-semibold text-white line-clamp-2 group-hover:text-[var(--brand)] transition-colors text-sm">
          {truncatedPrompt}
        </h3>

        {/* Stats */}
        <div className="space-y-2">
          {/* Voting Progress (Anonymized during voting) */}
          {status === IdeaStatus.Voting && votingDeadline && (
            <>
              {/* Time-based progress bar instead of vote distribution */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatTimeRemaining(votingDeadline)} remaining
                  </span>
                  <span>{totalVoters} participants</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[var(--brand)] to-purple-500 transition-all duration-500"
                    style={{
                      width: `${Math.min(100, ((Date.now() / 1000 - (votingDeadline - 72 * 3600)) / (72 * 3600)) * 100)}%`
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Completed - Show results */}
          {status === IdeaStatus.Completed && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">
                💰 {totalStaked.toFixed(2)} SOL
              </span>
              <span className="text-zinc-400 flex items-center gap-1">
                <Users size={12} />
                {totalVoters} voters
              </span>
            </div>
          )}

          {/* Generating status info */}
          {status === IdeaStatus.GeneratingImages && (
            <div className="flex items-center gap-1 text-xs text-blue-400">
              <Loader2 size={12} className="animate-spin" />
              <span>AI is creating images...</span>
            </div>
          )}
        </div>

        {/* Initiator */}
        <div className="pt-1 border-t border-zinc-800">
          <div className="text-xs text-zinc-400 truncate">
            by <span className="text-zinc-300">{initiator}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
