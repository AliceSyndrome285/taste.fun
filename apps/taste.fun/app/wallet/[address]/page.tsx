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
  themeTokens: Array<{
    themeId: string;
    themeName: string;
    tokenMint: string;
    amount: number;
    avgBuyPrice: number;
    currentPrice: number;
    value: number;
    profitLoss: number;
  }>;
  createdThemes: Array<{
    id: string;
    name: string;
    description: string;
    tokenMint: string;
    marketCap: number;
    createdAt: number;
  }>;
  voteHistory: Array<{
    ideaId: string;
    ideaPrompt: string;
    themeId: string;
    themeName: string;
    imageChoice: number;
    staked: number;
    winnings: number;
    status: 'Voting' | 'Won' | 'Lost';
    timestamp: number;
    isWinner: boolean;
    withdrawn: boolean;
  }>;
  pendingRewards: number;
  stats: {
    totalCreated: number;
    totalVoted: number;
    totalWon: number;
    winRate: number;
  };
}

export default function WalletPage() {
  const params = useParams();
  const address = params?.address as string;
  
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
        // If API fails, create an empty portfolio for the new wallet
        // This allows new users to see their wallet page even if they have no activity yet
        setPortfolio({
          address: address,
          solBalance: 0,
          themeTokens: [],
          createdThemes: [],
          voteHistory: [],
          pendingRewards: 0,
          stats: {
            totalCreated: 0,
            totalVoted: 0,
            totalWon: 0,
            winRate: 0,
          }
        });
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
          <p className="text-zinc-400">Loading wallet...</p>
        </div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand)] mx-auto"></div>
          <p className="text-zinc-400">Loading wallet data...</p>
        </div>
      </div>
    );
  }

  const totalValue = portfolio.solBalance + portfolio.themeTokens.reduce((sum, t) => sum + t.value, 0);
  const isNewWallet = portfolio.themeTokens.length === 0 && portfolio.createdThemes.length === 0 && portfolio.voteHistory.length === 0;

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <Wallet className="w-6 h-6 text-[var(--brand)]" />
              <h1 className="text-xl font-bold">Wallet</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome Banner for New Wallets */}
        {isNewWallet && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-[var(--brand)]/20 to-purple-500/20 border border-[var(--brand)]/30 rounded-xl p-6"
          >
            <div className="flex items-start gap-4">
              <Sparkles className="w-8 h-8 text-[var(--brand)] flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-bold mb-2">Welcome to Taste.fun! 🎉</h3>
                <p className="text-gray-300 mb-4">
                  Your wallet is connected. Get started by exploring themes, voting on ideas, or creating your own theme!
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/"
                    className="px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] rounded-lg font-semibold transition-colors"
                  >
                    Explore Themes
                  </Link>
                  <Link
                    href="/theme/create"
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-semibold transition-colors"
                  >
                    Create Theme
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Balance Overview */}
        <div className="rounded-2xl p-8 border bg-gradient-to-br from-[var(--brand)]/10 to-zinc-900/50 border-[var(--brand)]/20">
          <div className="flex items-center gap-2 text-gray-300 mb-2">
            <Wallet className="w-4 h-4" />
            <span className="text-sm">Wallet Address</span>
          </div>
          <p className="font-mono text-sm text-gray-400 mb-6">
            {formatAddress(address)}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-400 mb-1">SOL Balance</p>
              <p className="text-4xl font-bold text-amber-400">{portfolio.solBalance.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Total Asset Value</p>
              <p className="text-4xl font-bold">{totalValue.toFixed(2)} SOL</p>
              <div className="flex items-center gap-2 mt-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400 font-semibold">
                  +{portfolio.solBalance > 0 ? ((totalValue / portfolio.solBalance - 1) * 100).toFixed(1) : '0'}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Rewards */}
        {portfolio.pendingRewards > 0 && !rewardClaimed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-400/10 border border-green-400/30 rounded-xl p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5 text-green-400 animate-pulse" />
                  <h3 className="text-lg font-bold text-green-400">Pending Rewards</h3>
                </div>
                <p className="text-3xl font-bold text-green-400 mb-2">
                  {portfolio.pendingRewards.toFixed(2)} SOL
                </p>
                <p className="text-sm text-gray-400">
                  Rewards from winning votes
                </p>
              </div>
              <button
                onClick={handleClaimReward}
                disabled={claimingReward}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors"
              >
                {claimingReward ? 'Claiming...' : 'Claim Rewards'}
              </button>
            </div>
          </motion.div>
        )}

        {rewardClaimed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-400/20 border border-green-400/30 rounded-xl p-4"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <p className="text-green-400 font-medium">
                ✅ Rewards claimed! Balance updated
              </p>
            </div>
          </motion.div>
        )}

        {/* Theme Tokens */}
        <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <Coins className="w-5 h-5 text-[var(--brand)]" />
            <h2 className="text-lg font-bold">Theme Token Holdings</h2>
          </div>
          
          {portfolio.themeTokens.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No theme tokens yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {portfolio.themeTokens.map(token => (
                <Link
                  key={token.themeId}
                  href={`/theme/${token.themeId}`}
                  className="block group"
                >
                  <div className="bg-zinc-800/50 hover:bg-zinc-800 rounded-xl p-4 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold group-hover:text-[var(--brand)] transition-colors">
                          {token.themeName}
                        </h3>
                        <p className="text-sm text-gray-400">{token.amount.toLocaleString()} tokens</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{token.value.toFixed(2)} SOL</p>
                        <p className="text-sm text-gray-400">
                          @ {token.currentPrice.toFixed(6)} SOL
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">P/L</span>
                      <div className="flex items-center gap-1">
                        <TrendingUp className={`w-4 h-4 ${token.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`} />
                        <span className={`text-sm font-semibold ${token.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {token.profitLoss >= 0 ? '+' : ''}{token.profitLoss.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Created Themes */}
        {portfolio.createdThemes.length > 0 && (
          <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-[var(--brand)]" />
              <h2 className="text-lg font-bold">My Created Themes</h2>
            </div>
            
            <div className="space-y-3">
              {portfolio.createdThemes.map(theme => (
                <Link
                  key={theme.id}
                  href={`/theme/${theme.id}`}
                  className="block group"
                >
                  <div className="bg-zinc-800/50 hover:bg-zinc-800 rounded-xl p-4 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold group-hover:text-[var(--brand)] transition-colors">
                          {theme.name}
                        </h3>
                        <p className="text-sm text-gray-400 line-clamp-1">{theme.description}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm text-gray-400">Market Cap</p>
                        <p className="font-semibold">{theme.marketCap.toFixed(0)} SOL</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Vote History */}
        <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold">Vote History</h2>
          </div>
          
          {portfolio.voteHistory.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No votes yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {portfolio.voteHistory.map((vote, index) => (
                <Link
                  key={index}
                  href={`/idea/${vote.ideaId}`}
                  className="block group"
                >
                  <div className="bg-zinc-800/50 hover:bg-zinc-800 rounded-xl p-4 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium group-hover:text-[var(--brand)] transition-colors line-clamp-1">
                          {vote.ideaPrompt}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          {vote.themeName} • {formatTimeAgo(vote.timestamp)}
                        </p>
                      </div>
                      <div className="ml-4">
                        {vote.status === 'Voting' && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-blue-400/20 rounded-full">
                            <Clock className="w-3 h-3 text-blue-400" />
                            <span className="text-xs font-semibold text-blue-400">Voting</span>
                          </div>
                        )}
                        {vote.status === 'Won' && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-green-400/20 rounded-full">
                            <Award className="w-3 h-3 text-green-400" />
                            <span className="text-xs font-semibold text-green-400">Won</span>
                          </div>
                        )}
                        {vote.status === 'Lost' && (
                          <div className="px-2 py-1 bg-red-400/20 rounded-full">
                            <span className="text-xs font-semibold text-red-400">Lost</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">
                        Staked: <span className="text-amber-400 font-semibold">{vote.staked.toFixed(2)} SOL</span>
                      </span>
                      {vote.winnings > 0 && (
                        <span className="text-green-400 font-semibold">
                          +{vote.winnings.toFixed(2)} SOL
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
