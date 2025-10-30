/**
 * Taste & Earn - Jury Page (V3)
 * 显示用户的投票历史和收益统计
 */

"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Clock, TrendingUp, CheckCircle, XCircle, Wallet } from 'lucide-react';
import {
  IdeaStatus,
  lamportsToSol,
  formatTimeRemaining,
  getImageChoiceLabel,
  ImageChoice,
} from '@/lib/types/consensus-v3';

interface VoteHistoryItem {
  id: string;
  ideaId: string;
  ideaTitle: string;
  imageChoice: ImageChoice;
  stakeAmount: number; // in SOL
  votedAt: number; // timestamp
  ideaStatus: IdeaStatus;
  isWinner: boolean | null; // null = voting not ended
  winnings: number; // in SOL
  canWithdraw: boolean;
  votingDeadline?: number;
  totalVoters?: number;
  winningImageIndex?: number | null;
}

// Mock data for development
const mockVoteHistory: VoteHistoryItem[] = [
  {
    id: 'vote1',
    ideaId: '1',
    ideaTitle: 'A cyberpunk cityscape at night with neon signs',
    imageChoice: ImageChoice.ImageB,
    stakeAmount: 0.05,
    votedAt: Date.now() / 1000 - 3600, // 1 hour ago
    ideaStatus: IdeaStatus.Voting,
    isWinner: null,
    winnings: 0,
    canWithdraw: false,
    votingDeadline: Date.now() / 1000 + 48 * 3600,
    totalVoters: 42,
  },
  {
    id: 'vote2',
    ideaId: '2',
    ideaTitle: 'Fantasy landscape with floating islands and waterfalls',
    imageChoice: ImageChoice.ImageA,
    stakeAmount: 0.1,
    votedAt: Date.now() / 1000 - 24 * 3600, // 1 day ago
    ideaStatus: IdeaStatus.Completed,
    isWinner: true,
    winnings: 0.15,
    canWithdraw: true,
    winningImageIndex: 0,
    totalVoters: 38,
  },
  {
    id: 'vote3',
    ideaId: '3',
    ideaTitle: 'Minimalist logo design for tech startup',
    imageChoice: ImageChoice.ImageC,
    stakeAmount: 0.05,
    votedAt: Date.now() / 1000 - 72 * 3600, // 3 days ago
    ideaStatus: IdeaStatus.Completed,
    isWinner: false,
    winnings: 0,
    canWithdraw: false,
    winningImageIndex: 1,
    totalVoters: 25,
  },
];

export default function JuryPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [isWithdrawing, setIsWithdrawing] = useState<string | null>(null);

  // Calculate statistics
  const totalVotes = mockVoteHistory.length;
  const completedVotes = mockVoteHistory.filter(v => v.ideaStatus === IdeaStatus.Completed);
  const wonVotes = completedVotes.filter(v => v.isWinner === true);
  const lostVotes = completedVotes.filter(v => v.isWinner === false);
  const winRate = completedVotes.length > 0 
    ? ((wonVotes.length / completedVotes.length) * 100).toFixed(1)
    : '0';
  const totalEarned = wonVotes.reduce((sum, v) => sum + v.winnings, 0);
  const withdrawableAmount = mockVoteHistory
    .filter(v => v.canWithdraw)
    .reduce((sum, v) => sum + v.winnings, 0);

  const handleWithdraw = async (voteId: string) => {
    setIsWithdrawing(voteId);
    
    try {
      // TODO: Connect to blockchain
      // await withdrawWinnings(program!, { ideaPublicKey: ... });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert('Winnings withdrawn successfully! 💰');
      
      // Refresh data
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to withdraw:', err);
      alert('Failed to withdraw winnings: ' + err.message);
    } finally {
      setIsWithdrawing(null);
    }
  };

  const pendingVotes = mockVoteHistory.filter(v => v.ideaStatus === IdeaStatus.Voting || v.ideaStatus === IdeaStatus.GeneratingImages);
  const completedVotesList = mockVoteHistory.filter(v => v.ideaStatus === IdeaStatus.Completed || v.ideaStatus === IdeaStatus.Cancelled);
  const displayVotes = activeTab === 'pending' ? pendingVotes : completedVotesList;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Jury Duty</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Review submitted work and earn rewards for quality assessment
        </p>
      </div>

      {/* Stats - V3 Model */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <Card.Content className="p-4">
            <div className="text-2xl font-bold text-white">{totalVotes}</div>
            <div className="text-xs text-zinc-400 mt-1">� Total Votes</div>
          </Card.Content>
        </Card>
        <Card>
          <Card.Content className="p-4">
            <div className="text-2xl font-bold text-[var(--brand)]">{winRate}%</div>
            <div className="text-xs text-zinc-400 mt-1">⚖️ Win Rate</div>
            <div className="text-xs text-zinc-500 mt-1">
              {wonVotes.length}W / {lostVotes.length}L
            </div>
          </Card.Content>
        </Card>
        <Card>
          <Card.Content className="p-4">
            <div className="text-2xl font-bold text-green-400">
              {totalEarned.toFixed(3)} SOL
            </div>
            <div className="text-xs text-zinc-400 mt-1">💰 Total Earned</div>
          </Card.Content>
        </Card>
        <Card>
          <Card.Content className="p-4">
            <div className="text-2xl font-bold text-amber-400">
              {withdrawableAmount.toFixed(3)} SOL
            </div>
            <div className="text-xs text-zinc-400 mt-1">✨ Withdrawable</div>
            {withdrawableAmount > 0 && (
              <button 
                className="mt-2 w-full py-1 text-xs bg-green-600 hover:bg-green-500 rounded transition-colors"
                onClick={() => {
                  const firstWithdrawable = mockVoteHistory.find(v => v.canWithdraw);
                  if (firstWithdrawable) handleWithdraw(firstWithdrawable.id);
                }}
              >
                Withdraw All
              </button>
            )}
          </Card.Content>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'pending'
              ? 'text-white'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Pending Review
          {activeTab === 'pending' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand)]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'completed'
              ? 'text-white'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Completed
          {activeTab === 'completed' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand)]" />
          )}
        </button>
      </div>

      {/* Vote History List */}
      <div className="space-y-4">
        {displayVotes.length === 0 ? (
          <Card>
            <Card.Content className="p-12 text-center">
              <p className="text-zinc-400">
                {activeTab === 'pending'
                  ? 'No pending votes. Start by voting on ideas!'
                  : 'No completed votes yet.'}
              </p>
            </Card.Content>
          </Card>
        ) : (
          displayVotes.map((vote) => (
            <Card key={vote.id}>
              <Card.Content className="p-0">
                <div className="flex flex-col md:flex-row gap-4 p-6">
                  {/* Left: Status Icon */}
                  <div className="flex-shrink-0">
                    {vote.isWinner === null ? (
                      <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Clock className="text-blue-400" size={28} />
                      </div>
                    ) : vote.isWinner ? (
                      <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="text-green-400" size={28} />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                        <XCircle className="text-red-400" size={28} />
                      </div>
                    )}
                  </div>

                  {/* Center: Info */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <Link 
                        href={`/idea/${vote.ideaId}`}
                        className="text-lg font-semibold text-white hover:text-[var(--brand)] transition-colors line-clamp-1"
                      >
                        {vote.ideaTitle}
                      </Link>
                      
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
                        <span className="text-zinc-400">
                          Voted: <span className="text-white font-medium">
                            {getImageChoiceLabel(vote.imageChoice)}
                          </span>
                        </span>
                        <span className="text-zinc-400">
                          Stake: <span className="text-white font-medium">
                            {vote.stakeAmount} SOL
                          </span>
                        </span>
                        {vote.totalVoters && (
                          <span className="text-zinc-400 flex items-center gap-1">
                            <TrendingUp size={14} />
                            {vote.totalVoters} voters
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status Info */}
                    <div className="flex items-center gap-4 text-sm">
                      {vote.ideaStatus === IdeaStatus.Voting && vote.votingDeadline && (
                        <div className="flex items-center gap-1 text-blue-400">
                          <Clock size={14} />
                          <span>{formatTimeRemaining(vote.votingDeadline)} left</span>
                        </div>
                      )}
                      
                      {vote.ideaStatus === IdeaStatus.Completed && vote.isWinner === true && (
                        <div className="flex items-center gap-1 text-green-400">
                          <CheckCircle size={14} />
                          <span>You Won! +{vote.winnings.toFixed(3)} SOL</span>
                        </div>
                      )}
                      
                      {vote.ideaStatus === IdeaStatus.Completed && vote.isWinner === false && (
                        <div className="flex items-center gap-1 text-red-400">
                          <XCircle size={14} />
                          <span>
                            Lost ({getImageChoiceLabel(vote.winningImageIndex ?? 0)} won)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Voted At */}
                    <div className="text-xs text-zinc-500">
                      Voted {new Date(vote.votedAt * 1000).toLocaleString()}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  {vote.canWithdraw && (
                    <div className="flex items-center">
                      <button
                        onClick={() => handleWithdraw(vote.id)}
                        disabled={isWithdrawing === vote.id}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {isWithdrawing === vote.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Wallet size={16} />
                            Withdraw {vote.winnings.toFixed(3)} SOL
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Info Box - V3 Model */}
                {vote.ideaStatus === IdeaStatus.Voting && (
                  <div className="border-t border-zinc-800 p-4 bg-blue-500/5">
                    <p className="text-xs text-zinc-400">
                      💡 <strong>Taste & Earn:</strong> Your stake is locked until voting ends. 
                      If your choice is the majority, you'll earn 50% of the minority stakes as rewards!
                    </p>
                  </div>
                )}
              </Card.Content>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
