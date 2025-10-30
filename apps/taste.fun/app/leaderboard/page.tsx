"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Sparkles, Users, Award, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

type TimeFilter = 'all' | 'month' | 'week';
type ThemeSortBy = 'votes' | 'price';
type IdeaSortBy = 'voting' | 'completed';

interface ThemeWithStats {
  id: string;
  name: string;
  description: string;
  creator: string;
  totalVotes: number;
  marketCap: number;
  totalIdeas: number;
  currentPrice: number;
}

interface IdeaWithStats {
  id: string;
  prompt: string;
  theme: string;
  totalStaked: number;
  totalVoters: number;
  status: string;
}

interface VoterStats {
  address: string;
  totalWinnings: number;
  wins: number;
  totalVotes: number;
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'themes' | 'ideas' | 'voters'>('themes');
  const [themeTimeFilter, setThemeTimeFilter] = useState<TimeFilter>('all');
  const [themeSortBy, setThemeSortBy] = useState<ThemeSortBy>('votes');
  const [ideaSortBy, setIdeaSortBy] = useState<IdeaSortBy>('voting');
  
  const [themes, setThemes] = useState<ThemeWithStats[]>([]);
  const [ideas, setIdeas] = useState<IdeaWithStats[]>([]);
  const [voters, setVoters] = useState<VoterStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch leaderboard data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (activeTab === 'themes') {
          const response = await apiClient.getThemeLeaderboard(themeSortBy);
          setThemes(response.data);
        } else if (activeTab === 'ideas') {
          const response = await apiClient.getIdeaLeaderboard(ideaSortBy === 'voting' ? 'Voting' : 'Completed');
          setIdeas(response.data);
        } else if (activeTab === 'voters') {
          const response = await apiClient.getVoterLeaderboard();
          setVoters(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [activeTab, themeSortBy, ideaSortBy]);

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const formatAddress = (address: string) => {
    if (address === 'You') return address;
    return `${address.slice(0, 4)}...${address.slice(-3)}`;
  };

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-[var(--brand)]" />
            <h1 className="text-3xl md:text-4xl font-bold">Leaderboard</h1>
          </div>
          <p className="text-zinc-400">Top performers across TasteFun</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('themes')}
            className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'themes'
                ? 'bg-[var(--brand)] text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <Sparkles className="w-4 h-4 inline mr-2" />
            Top Themes
          </button>
          <button
            onClick={() => setActiveTab('ideas')}
            className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'ideas'
                ? 'bg-[var(--brand)] text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Top Ideas
          </button>
          <button
            onClick={() => setActiveTab('voters')}
            className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'voters'
                ? 'bg-[var(--brand)] text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Top Voters
          </button>
        </div>

        {/* Theme Leaderboard */}
        {activeTab === 'themes' && (
          <div>
            {/* Filters */}
            <div className="flex gap-4 mb-6 flex-wrap">
              <select
                value={themeSortBy}
                onChange={(e) => setThemeSortBy(e.target.value as ThemeSortBy)}
                className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
              >
                <option value="votes">Sort by Votes</option>
                <option value="price">Sort by Market Cap</option>
              </select>
            </div>

            {/* Table */}
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Rank</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Theme</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Creator</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Total Votes</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Ideas</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Market Cap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                          Loading...
                        </td>
                      </tr>
                    ) : themes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                          No themes found
                        </td>
                      </tr>
                    ) : (
                      themes.map((theme, index) => (
                        <tr key={theme.id} className="border-t border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-4">
                            <span className="text-2xl">{getMedalEmoji(index + 1)}</span>
                          </td>
                          <td className="px-4 py-4">
                            <Link href={`/theme/${theme.id}`} className="hover:text-[var(--brand)] transition-colors">
                              <div className="font-semibold">{theme.name}</div>
                              <div className="text-sm text-zinc-400 line-clamp-1">{theme.description}</div>
                            </Link>
                          </td>
                          <td className="px-4 py-4">
                            <code className="text-sm text-zinc-400">{formatAddress(theme.creator)}</code>
                          </td>
                          <td className="px-4 py-4 text-right font-semibold">{theme.totalVotes}</td>
                          <td className="px-4 py-4 text-right text-zinc-400">{theme.totalIdeas}</td>
                          <td className="px-4 py-4 text-right font-semibold text-[var(--brand)]">
                            {theme.marketCap.toFixed(2)} SOL
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Idea Leaderboard */}
        {activeTab === 'ideas' && (
          <div>
            {/* Filters */}
            <div className="flex gap-4 mb-6 flex-wrap">
              <select
                value={ideaSortBy}
                onChange={(e) => setIdeaSortBy(e.target.value as IdeaSortBy)}
                className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
              >
                <option value="voting">Active Voting</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Table */}
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Rank</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Idea</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Prize Pool</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Voters</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                          Loading...
                        </td>
                      </tr>
                    ) : ideas.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                          No ideas found
                        </td>
                      </tr>
                    ) : (
                      ideas.map((idea, index) => (
                        <tr key={idea.id} className="border-t border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-4">
                            <span className="text-2xl">{getMedalEmoji(index + 1)}</span>
                          </td>
                          <td className="px-4 py-4">
                            <Link href={`/idea/${idea.id}`} className="hover:text-[var(--brand)] transition-colors">
                              <div className="font-medium line-clamp-2">{idea.prompt}</div>
                            </Link>
                          </td>
                          <td className="px-4 py-4 text-right font-semibold text-amber-400">
                            {idea.totalStaked.toFixed(2)} SOL
                          </td>
                          <td className="px-4 py-4 text-right font-semibold">{idea.totalVoters}</td>
                          <td className="px-4 py-4 text-right">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              idea.status === 'Voting' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {idea.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Voter Leaderboard */}
        {activeTab === 'voters' && (
          <div>
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Rank</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Address</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Total Winnings</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Wins</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Total Votes</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                          Loading...
                        </td>
                      </tr>
                    ) : voters.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                          No voters found
                        </td>
                      </tr>
                    ) : (
                      voters.map((voter, index) => (
                        <tr key={voter.address} className="border-t border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-4">
                            <span className="text-2xl">{getMedalEmoji(index + 1)}</span>
                          </td>
                          <td className="px-4 py-4">
                            <Link href={`/profile/${voter.address}`} className="hover:text-[var(--brand)] transition-colors">
                              <code className="text-sm">{formatAddress(voter.address)}</code>
                            </Link>
                          </td>
                          <td className="px-4 py-4 text-right font-semibold text-[var(--brand)]">
                            {voter.totalWinnings.toFixed(3)} SOL
                          </td>
                          <td className="px-4 py-4 text-right font-semibold text-green-400">{voter.wins}</td>
                          <td className="px-4 py-4 text-right text-zinc-400">{voter.totalVotes}</td>
                          <td className="px-4 py-4 text-right font-semibold">
                            {voter.totalVotes > 0 ? ((voter.wins / voter.totalVotes) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
