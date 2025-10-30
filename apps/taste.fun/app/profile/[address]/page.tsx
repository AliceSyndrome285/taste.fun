"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Wallet,
  TrendingUp, 
  Sparkles, 
  History,
  Award,
  CheckCircle,
  Coins,
  Clock,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface PortfolioData {
  address: string;
  solBalance: number;
  themeTokens: any[];
  createdThemes: any[];
  voteHistory: any[];
  pendingRewards: number;
  stats: {
    totalCreated: number;
    totalVoted: number;
    totalWon: number;
    winRate: number;
  };
}

export default function ProfilePage() {
  const params = useParams();
  const address = params?.address as string;
  
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tokens' | 'themes' | 'votes'>('tokens');
  const [claimingReward, setClaimingReward] = useState(false);
  const [rewardClaimed, setRewardClaimed] = useState(false);

  useEffect(() => {
    const fetchPortfolio = async () => {
      if (!address) return;
      
      try {
        setIsLoading(true);
        const data = await apiClient.getUserPortfolio(address);
        setPortfolio(data);
      } catch (error) {
        console.error('Failed to fetch user portfolio:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPortfolio();
  }, [address]);

  const handleClaimReward = async () => {
    setClaimingReward(true);
    // TODO: Implement actual claim logic with smart contract
    await new Promise(resolve => setTimeout(resolve, 1500));
    setClaimingReward(false);
    setRewardClaimed(true);
    
    setTimeout(() => setRewardClaimed(false), 3000);
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() / 1000) - timestamp);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand)] mx-auto"></div>
          <p className="text-zinc-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <p className="text-zinc-400">Profile not found</p>
          <Link href="/" className="text-[var(--brand)] hover:underline">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--brand)] to-purple-500 flex items-center justify-center">
                  <User className="w-10 h-10 text-white" />
                </div>
                
                {/* Info */}
                <div>
                  <h1 className="text-2xl font-bold mb-1">{formatAddress(address)}</h1>
                  <p className="text-zinc-400 text-sm">Member since {new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-[var(--brand)] mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-medium">Ideas Created</span>
                </div>
                <p className="text-2xl font-bold">{activity.totalCreated}</p>
              </div>
              
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-400 mb-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Votes Cast</span>
                </div>
                <p className="text-2xl font-bold">{activity.totalVoted}</p>
              </div>
              
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-amber-400 mb-2">
                  <Coins className="w-4 h-4" />
                  <span className="text-sm font-medium">Total Earned</span>
                </div>
                <p className="text-2xl font-bold">{activity.totalEarned.toFixed(3)} SOL</p>
              </div>
              
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <Award className="w-4 h-4" />
                  <span className="text-sm font-medium">Win Rate</span>
                </div>
                <p className="text-2xl font-bold">
                  {activity.totalVoted > 0 
                    ? ((activity.votes.filter(v => v.isWinner).length / activity.totalVoted) * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ideas')}
            className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'ideas'
                ? 'bg-[var(--brand)] text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <Sparkles className="w-4 h-4 inline mr-2" />
            Ideas ({activity.ideas.length})
          </button>
          <button
            onClick={() => setActiveTab('votes')}
            className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'votes'
                ? 'bg-[var(--brand)] text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <CheckCircle className="w-4 h-4 inline mr-2" />
            Votes ({activity.votes.length})
          </button>
        </div>

        {/* Ideas Tab */}
        {activeTab === 'ideas' && (
          <div className="space-y-4">
            {activity.ideas.length === 0 ? (
              <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-8 text-center">
                <Sparkles className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">No ideas created yet</p>
              </div>
            ) : (
              activity.ideas.map((idea) => (
                <Link
                  key={idea.id}
                  href={`/idea/${idea.id}`}
                  className="block bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 hover:border-[var(--brand)] transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium mb-2 line-clamp-2">{idea.prompt}</p>
                      <div className="flex items-center gap-4 text-sm text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Coins className="w-4 h-4" />
                          {idea.totalStaked.toFixed(2)} SOL
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          {idea.totalVoters} voters
                        </span>
                        <span>{formatTimeAgo(idea.createdAt)}</span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      idea.status === 'Voting' ? 'bg-green-500/20 text-green-400' :
                      idea.status === 'Completed' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-zinc-500/20 text-zinc-400'
                    }`}>
                      {idea.status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Votes Tab */}
        {activeTab === 'votes' && (
          <div className="space-y-4">
            {activity.votes.length === 0 ? (
              <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-8 text-center">
                <CheckCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">No votes cast yet</p>
              </div>
            ) : (
              activity.votes.map((vote) => (
                <Link
                  key={`${vote.idea}-${vote.voter}`}
                  href={`/idea/${vote.idea}`}
                  className="block bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 hover:border-[var(--brand)] transition-all"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm text-zinc-400">Choice #{vote.imageChoice + 1}</span>
                        {vote.isWinner && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            Winner
                          </span>
                        )}
                        {vote.isWinner && !vote.winningsWithdrawn && (
                          <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
                            Claimable
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Coins className="w-4 h-4" />
                          Staked: {vote.stakeAmount.toFixed(3)} SOL
                        </span>
                        <span>Weight: {vote.voteWeight}</span>
                        <span>{formatTimeAgo(vote.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
