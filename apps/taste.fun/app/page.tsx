"use client";

import { useState, useEffect } from 'react';
import { Shelf } from '@/components/ui/shelf';
import { IdeaCard } from '@/components/ui/idea-card';
import { Search, TrendingUp } from 'lucide-react';
import { apiClient, IdeaResponse, StatsResponse } from '@/lib/api/client';
import { useWebSocket, WSMessageType } from '@/lib/hooks/useWebSocket';

import { IdeaStatus, lamportsToSol, CONSTANTS } from '@/lib/types/consensus-v3';

export default function HomePage() {
  const [votingIdeas, setVotingIdeas] = useState<IdeaResponse[]>([]);
  const [generatingIdeas, setGeneratingIdeas] = useState<IdeaResponse[]>([]);
  const [completedIdeas, setCompletedIdeas] = useState<IdeaResponse[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch ideas by status
        const [voting, generating, completed, globalStats] = await Promise.all([
          apiClient.getIdeas({ status: 'Voting', sortBy: 'total_voters', order: 'desc' }),
          apiClient.getIdeas({ status: 'GeneratingImages', limit: 10 }),
          apiClient.getIdeas({ status: 'Completed', sortBy: 'created_at', order: 'desc', limit: 10 }),
          apiClient.getStats(),
        ]);

        setVotingIdeas(voting.data);
        setGeneratingIdeas(generating.data);
        setCompletedIdeas(completed.data);
        setStats(globalStats);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Listen to real-time updates
  useWebSocket((message) => {
    switch (message.type) {
      case WSMessageType.IdeaNew:
        // Refresh data when new idea is created
        apiClient.getIdeas({ status: message.data.status }).then((res) => {
          if (message.data.status === 'Voting') setVotingIdeas(res.data);
          else if (message.data.status === 'GeneratingImages') setGeneratingIdeas(res.data);
        });
        break;
      
      case WSMessageType.IdeaUpdateStatus:
        // Update idea status in local state
        const updateIdea = (ideas: IdeaResponse[]) =>
          ideas.map((idea) =>
            idea.id === message.data.id ? { ...idea, status: message.data.status } : idea
          );
        setVotingIdeas(updateIdea);
        setGeneratingIdeas(updateIdea);
        setCompletedIdeas(updateIdea);
        break;
      
      case WSMessageType.VoteNew:
        // Update vote stats for specific idea
        setVotingIdeas((ideas) =>
          ideas.map((idea) =>
            idea.id === message.data.idea
              ? { ...idea, totalVoters: idea.totalVoters + 1 }
              : idea
          )
        );
        break;
      
      case WSMessageType.StatsGlobal:
        // Update global stats
        setStats(message.data);
        break;
    }
  }, { autoConnect: true });

  // 计算总奖池和总投票数（使用真实数据或默认为0）
  const totalPrizePool = votingIdeas.reduce((sum, idea) => sum + idea.totalStaked, 0);
  const totalVotes = votingIdeas.reduce((sum, idea) => sum + idea.totalVoters, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand)] mx-auto"></div>
          <p className="text-zinc-400">Loading ideas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 md:space-y-10">
      {/* Search Bar */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
        <input
          type="text"
          placeholder="Search for ideas, creators, or tags..."
          className="w-full pl-11 pr-4 py-3 bg-[var(--surface)] border border-zinc-800 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] transition-colors"
        />
      </div>

      {/* Grand Prize Banner */}
      <section className="rounded-xl bg-gradient-to-r from-amber-500/20 via-[var(--brand)]/20 to-purple-500/20 p-8 md:p-12 border border-[var(--brand)]/30 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[var(--brand)]/10 via-transparent to-transparent animate-pulse" />
        
        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[var(--brand)]">
                <TrendingUp size={24} className="animate-bounce" />
                <span className="text-sm font-semibold uppercase tracking-wider">Live Prize Arena</span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
                Your Taste Can Earn You Money.
                <br />
                <span className="text-[var(--brand)]">Cast Your Vote.</span>
              </h1>
            </div>
          </div>

          {/* Real-time Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-white/10">
              <div className="text-2xl md:text-3xl font-bold text-[var(--brand)]">
                💰 {totalPrizePool.toFixed(2)} SOL
              </div>
              <div className="text-sm text-zinc-400 mt-1">Total Prize Pool</div>
            </div>
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-white/10">
              <div className="text-2xl md:text-3xl font-bold text-[var(--brand)]">
                🗳️ {totalVotes}
              </div>
              <div className="text-sm text-zinc-400 mt-1">Total Votes Cast</div>
            </div>
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-white/10">
              <div className="text-2xl md:text-3xl font-bold text-[var(--brand)]">
                🎨 {stats?.activeIdeas || votingIdeas.length}
              </div>
              <div className="text-sm text-zinc-400 mt-1">Active Contests</div>
            </div>
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-white/10">
              <div className="text-2xl md:text-3xl font-bold text-[var(--brand)]">
                ⏰ Live
              </div>
              <div className="text-sm text-zinc-400 mt-1">Vote Now!</div>
            </div>
          </div>

          <p className="text-zinc-300 text-lg">
            <strong>Simple:</strong> Stake → Vote for the best image → Winners split the losers' 50% stake
          </p>
        </div>
      </section>

      {/* Trending Contests - Top 20% by votes */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            🔥 Trending Now
            <span className="text-sm font-normal text-zinc-400">(Top {Math.ceil(votingIdeas.length * 0.2)} by votes)</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {votingIdeas
            .slice(0, Math.ceil(votingIdeas.length * 0.2))
            .map((idea) => (
              <IdeaCard 
                key={idea.id}
                id={idea.id}
                prompt={idea.prompt}
                coverImage={idea.imageUris?.[0]}
                totalStaked={idea.totalStaked}
                totalVoters={idea.totalVoters}
                initiator={idea.initiator}
                status={idea.status as any}
                votingDeadline={idea.votingDeadline}
              />
            ))}
        </div>
      </section>

      {/* All Active Contests - Sorted by total votes */}
      <Shelf title="⚖️ All Active Contests" viewAllHref="/explore?filter=voting">
        {votingIdeas.map((idea) => (
          <div key={idea.id} className="w-[280px] md:w-[300px] flex-shrink-0">
            <IdeaCard
              id={idea.id}
              prompt={idea.prompt}
              coverImage={idea.imageUris?.[0]}
              totalStaked={idea.totalStaked}
              totalVoters={idea.totalVoters}
              initiator={idea.initiator}
              status={idea.status as any}
              votingDeadline={idea.votingDeadline}
            />
          </div>
        ))}
      </Shelf>

      {/* Categories */}
      <section className="space-y-4">
        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
          Browse by Category
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['🎬 Film & Video', '🎵 Music', '🎮 Gaming', '📚 Writing', '🎨 Art', '👗 Fashion', '🏛️ Architecture', '🔬 Science'].map((category) => (
            <button
              key={category}
              className="p-4 rounded-lg bg-[var(--surface)] hover:bg-zinc-800 border border-zinc-800 hover:border-[var(--brand)] transition-all text-left group"
            >
              <span className="text-sm font-medium text-zinc-200 group-hover:text-white">
                {category}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
