"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { apiClient, ThemeResponse } from '@/lib/api/client';
import { Sparkles, TrendingUp, Users, Coins, Loader2, Plus } from 'lucide-react';

export default function ThemesPage() {
  const { publicKey } = useWallet();
  const [themes, setThemes] = useState<ThemeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'migrated' | 'my'>('all');

  useEffect(() => {
    loadThemes();
  }, [filter, publicKey]);

  const loadThemes = async () => {
    setLoading(true);
    try {
      if (filter === 'my') {
        if (!publicKey) {
          setThemes([]);
          return;
        }
        const result = await apiClient.getUserThemes(publicKey.toString());
        setThemes(result.data);
      } else {
        const params: any = { limit: 100, offset: 0 };
        if (filter !== 'all') {
          params.status = filter.charAt(0).toUpperCase() + filter.slice(1);
        }
        const result = await apiClient.getThemes(params);
        setThemes(result.data);
      }
    } catch (error) {
      console.error('Failed to load themes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVotingModeLabel = (mode: string) => {
    switch (mode) {
      case 'Classic':
        return '🎯 Classic (Most Votes Win)';
      case 'Reverse':
        return '🔄 Reverse (Least Votes Win)';
      case 'MiddleWay':
        return '⚖️ Middle Way (Both Ends Win)';
      default:
        return mode;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Active</span>;
      case 'Migrated':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">Migrated to DEX</span>;
      case 'Paused':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">Paused</span>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Theme Marketplace</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Explore themes, trade tokens, and join creative communities
          </p>
        </div>
        <Link
          href="/theme/create"
          className="btn flex items-center gap-2"
        >
          <Plus size={16} />
          Create Theme
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-[var(--brand)] text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          All Themes
        </button>
        <button
          onClick={() => setFilter('my')}
          disabled={!publicKey}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            filter === 'my'
              ? 'bg-[var(--brand)] text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          My Themes
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'active'
              ? 'bg-[var(--brand)] text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setFilter('migrated')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'migrated'
              ? 'bg-[var(--brand)] text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          Migrated to DEX
        </button>
      </div>

      {/* Stats Overview */}
      {!loading && themes.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <Card.Content className="p-4">
              <div className="text-zinc-400 text-sm mb-1">Total Themes</div>
              <div className="text-2xl font-bold text-white">{themes.length}</div>
            </Card.Content>
          </Card>
          <Card>
            <Card.Content className="p-4">
              <div className="text-zinc-400 text-sm mb-1">Active Themes</div>
              <div className="text-2xl font-bold text-white">
                {themes.filter(t => t.status === 'Active').length}
              </div>
            </Card.Content>
          </Card>
          <Card>
            <Card.Content className="p-4">
              <div className="text-zinc-400 text-sm mb-1">Total Volume</div>
              <div className="text-2xl font-bold text-white">
                {themes.reduce((sum, t) => sum + (t.totalVolume || 0), 0).toFixed(2)} SOL
              </div>
            </Card.Content>
          </Card>
          <Card>
            <Card.Content className="p-4">
              <div className="text-zinc-400 text-sm mb-1">Total Buyback Pool</div>
              <div className="text-2xl font-bold text-white">
                {themes.reduce((sum, t) => sum + t.buybackPool, 0).toFixed(2)} SOL
              </div>
            </Card.Content>
          </Card>
        </div>
      )}

      {/* Themes Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-[var(--brand)]" size={32} />
        </div>
      ) : themes.length === 0 ? (
        <Card>
          <Card.Content className="p-12 text-center">
            <Sparkles className="mx-auto mb-4 text-zinc-600" size={48} />
            <h3 className="text-xl font-semibold text-white mb-2">No Themes Found</h3>
            <p className="text-zinc-400 mb-6">
              {filter === 'all' 
                ? 'Be the first to create a theme and start a creative community!'
                : `No ${filter} themes available yet.`}
            </p>
            <Link href="/theme/create" className="btn">
              Create First Theme
            </Link>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {themes.map((theme) => (
            <Link
              key={theme.id}
              href={`/theme/${theme.id}`}
            >
              <Card className="hover:border-[var(--brand)] transition-all duration-300 h-full">
                <Card.Content className="p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1 line-clamp-1">
                        {theme.name}
                      </h3>
                      <p className="text-xs text-zinc-500 line-clamp-2">
                        {theme.description}
                      </p>
                    </div>
                    {getStatusBadge(theme.status)}
                  </div>

                  {/* Voting Mode */}
                  <div className="text-sm">
                    <span className="text-zinc-400">Mode: </span>
                    <span className="text-white">{getVotingModeLabel(theme.votingMode)}</span>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-800">
                    <div>
                      <div className="flex items-center gap-1 text-zinc-400 text-xs mb-1">
                        <Coins size={12} />
                        Token Price
                      </div>
                      <div className="text-white font-medium text-sm">
                        {theme.currentPrice.toFixed(9)} SOL
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-zinc-400 text-xs mb-1">
                        <Sparkles size={12} />
                        Buyback Pool
                      </div>
                      <div className="text-white font-semibold text-sm">
                        {theme.buybackPool.toFixed(2)} SOL
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-zinc-400 text-xs mb-1">
                        <Users size={12} />
                        Supply
                      </div>
                      <div className="text-white font-semibold text-sm">
                        {(theme.circulatingSupply / 1e6).toFixed(0)}M
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-zinc-400 text-xs mb-1">
                        <TrendingUp size={12} />
                        Reserves
                      </div>
                      <div className="text-white font-semibold text-sm">
                        {theme.solReserves.toFixed(2)} SOL
                      </div>
                    </div>
                  </div>

                  {/* Action Hint */}
                  <div className="pt-2 text-xs text-[var(--brand)] font-medium">
                    View Details →
                  </div>
                </Card.Content>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
