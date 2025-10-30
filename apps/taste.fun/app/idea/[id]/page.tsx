/**
 * Taste & Earn - Idea Detail Page
 * 展示 AI 生成的 4 张图片并允许质押投票
 */

"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import {
  ArrowLeft,
  Clock,
  Users,
  Sparkles,
  CheckCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  IdeaStatus,
  ImageChoice,
  CONSTANTS,
  lamportsToSol,
  formatTimeRemaining,
  getStatusBadge,
  getImageChoiceLabel,
} from '@/lib/types/consensus-v3';
import { voteForImage, withdrawWinnings } from '@/lib/anchor/instructions-v3';
// import { useAnchorProvider } from '@/lib/anchor/provider';

// Mock data for development
const mockIdea = {
  id: '1',
  prompt:
    'A cyberpunk cityscape at night with neon signs, flying cars, and holographic billboards. Style: Blade Runner 2049, high detail, cinematic lighting, 4K quality',
  status: IdeaStatus.Voting,
  initiator: 'CyberVis...x7k',
  totalStaked: lamportsToSol(50 * CONSTANTS.MIN_STAKE), // 50 votes
  totalVoters: 50,
  votingDeadline: Math.floor(Date.now() / 1000) + 48 * 3600, // 2 days remaining
  createdAt: Math.floor(Date.now() / 1000) - 24 * 3600, // 1 day ago
  imageUris: [
    'https://images.unsplash.com/photo-1518893063132-36e46dbe2428?w=600&h=400&fit=crop', // 替换为实际 IPFS/Arweave URI
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1534972195531-d756b9bfa9f2?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=600&h=400&fit=crop',
  ],
  votes: [12, 18, 15, 5], // 票数分布
  winningImageIndex: null,
};

const mockMyVote = {
  hasVoted: false,
  imageChoice: null as ImageChoice | null,
  stakeAmount: 0,
};

export default function IdeaDetailPageV3() {
  const params = useParams();
  // const { program } = useAnchorProvider();
  
  const [selectedImage, setSelectedImage] = useState<ImageChoice | null>(null);
  const [stakeAmount, setStakeAmount] = useState(0.01);
  const [isVoting, setIsVoting] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState('');

  const statusBadge = getStatusBadge(mockIdea.status);

  const handleVote = async () => {
    if (selectedImage === null) {
      setError('Please select an image to vote for');
      return;
    }

    setError('');
    setIsVoting(true);

    try {
      // TODO: 集成 Anchor
      // await voteForImage(program!, {
      //   ideaPublicKey: new PublicKey(params.id as string),
      //   imageIndex: selectedImage,
      //   stakeAmountSol: stakeAmount,
      // });

      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      alert(
        `Vote submitted! 🎉\n\nYou voted for ${getImageChoiceLabel(selectedImage)}\nStake: ${stakeAmount} SOL\n\nYour stake is now locked. If your choice wins, you'll earn rewards!`
      );
      
      // Refresh page data
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to vote:', err);
      setError(err.message || 'Failed to submit vote');
    } finally {
      setIsVoting(false);
    }
  };

  const handleWithdraw = async () => {
    setError('');
    setIsWithdrawing(true);

    try {
      // TODO: 集成 Anchor
      // await withdrawWinnings(program!, {
      //   ideaPublicKey: new PublicKey(params.id as string),
      // });

      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      alert('Winnings withdrawn successfully! 💰');
      
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to withdraw:', err);
      setError(err.message || 'Failed to withdraw winnings');
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back Button */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={20} />
        <span>Back to Home</span>
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-1 rounded ${statusBadge.color}`}>
              {statusBadge.text}
            </span>
            {mockIdea.status === IdeaStatus.Voting && (
              <span className="text-xs text-zinc-400 flex items-center gap-1">
                <Clock size={12} />
                {formatTimeRemaining(mockIdea.votingDeadline)} remaining
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            AI Image Generation Idea
          </h1>
          <p className="text-zinc-400 text-sm">
            by {mockIdea.initiator} •{' '}
            {new Date(mockIdea.createdAt * 1000).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-zinc-400">Total Staked</div>
            <div className="text-xl font-bold text-[var(--brand)]">
              {mockIdea.totalStaked.toFixed(3)} SOL
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-400">Voters</div>
            <div className="text-xl font-bold text-white flex items-center gap-1">
              <Users size={16} />
              {mockIdea.totalVoters}
            </div>
          </div>
        </div>
      </div>

      {/* Prompt */}
      <Card>
        <Card.Content className="p-6">
          <div className="flex items-start gap-3 mb-3">
            <Sparkles className="text-[var(--brand)] flex-shrink-0 mt-1" size={20} />
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">
                Original Prompt
              </h2>
              <p className="text-zinc-300 leading-relaxed">{mockIdea.prompt}</p>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Images Grid */}
      {mockIdea.status === IdeaStatus.Voting && (
        <>
          <h2 className="text-xl font-bold text-white">
            ⚖️ Vote for the Best Image
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mockIdea.imageUris.map((uri, index) => {
              const voteCount = mockIdea.votes[index];
              const votePercentage =
                mockIdea.totalVoters > 0
                  ? ((voteCount / mockIdea.totalVoters) * 100).toFixed(1)
                  : '0';
              const isSelected = selectedImage === index;

              return (
                <Card key={index} className={isSelected ? 'ring-2 ring-[var(--brand)]' : ''}>
                  <Card.Content className="p-0">
                    {/* Image */}
                    <div className="relative aspect-video bg-zinc-900">
                      <img
                        src={uri}
                        alt={`Image ${String.fromCharCode(65 + index)}`}
                        className="w-full h-full object-cover"
                      />
                      {/* Vote Badge */}
                      <div className="absolute top-3 left-3 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-lg text-sm font-medium text-white">
                        Image {String.fromCharCode(65 + index)}
                      </div>
                      {/* Winner Badge */}
                      {mockIdea.winningImageIndex === index && (
                        <div className="absolute top-3 right-3 px-3 py-1.5 bg-green-600 rounded-lg text-sm font-bold text-white flex items-center gap-1">
                          <CheckCircle size={16} />
                          Winner
                        </div>
                      )}
                    </div>

                    {/* Stats & Actions */}
                    <div className="p-4 space-y-3">
                      {/* Vote Stats */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">Current Votes:</span>
                        <span className="text-white font-medium">
                          {voteCount} ({votePercentage}%)
                        </span>
                      </div>

                      {/* Vote Button */}
                      {mockIdea.status === IdeaStatus.Voting && !mockMyVote.hasVoted && (
                        <button
                          onClick={() => setSelectedImage(index as ImageChoice)}
                          className={`w-full py-2.5 rounded-lg transition-all ${
                            isSelected
                              ? 'bg-[var(--brand)] text-black font-semibold'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                          }`}
                        >
                          {isSelected ? '✓ Selected' : 'Select This'}
                        </button>
                      )}

                      {/* User's Vote */}
                      {mockMyVote.hasVoted && mockMyVote.imageChoice === index && (
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
                          <span className="text-sm text-blue-200">
                            ✓ You voted for this image
                          </span>
                        </div>
                      )}
                    </div>
                  </Card.Content>
                </Card>
              );
            })}
          </div>

          {/* Vote Action Panel */}
          {!mockMyVote.hasVoted && (
            <Card>
              <Card.Content className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white">
                  Submit Your Vote
                </h3>

                {/* Stake Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Stake Amount (SOL) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={lamportsToSol(CONSTANTS.MIN_STAKE)}
                    max="1"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(parseFloat(e.target.value) || 0.01)}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-[var(--brand)]"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Min: {lamportsToSol(CONSTANTS.MIN_STAKE)} SOL, Max: 1 SOL (anti-Sybil protection)
                  </p>
                </div>

                {/* Info */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm text-blue-200">
                  <strong>⚖️ How voting works:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-blue-200/80">
                    <li>Your stake is locked until voting ends</li>
                    <li>If your choice wins, you earn 50% of losers' stakes</li>
                    <li>If your choice loses, you lose 50% of your stake</li>
                    <li>Higher stakes don't change your vote weight</li>
                  </ul>
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex gap-3">
                    <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                    <p className="text-sm text-red-200">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleVote}
                  disabled={selectedImage === null || isVoting}
                  className="w-full btn py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVoting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Submitting Vote...
                    </>
                  ) : (
                    <>
                      Cast Vote ({stakeAmount} SOL)
                    </>
                  )}
                </button>
              </Card.Content>
            </Card>
          )}
        </>
      )}

      {/* Completed State */}
      {mockIdea.status === IdeaStatus.Completed && (
        <Card>
          <Card.Content className="p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              ✅ Voting Complete
            </h2>
            
            {mockIdea.winningImageIndex !== null && (
              <div className="space-y-4">
                <p className="text-zinc-300">
                  The winning image is <strong>Image {String.fromCharCode(65 + mockIdea.winningImageIndex)}</strong>!
                </p>

                <div className="aspect-video max-w-md bg-zinc-900 rounded-lg overflow-hidden">
                  <img
                    src={mockIdea.imageUris[mockIdea.winningImageIndex]}
                    alt="Winning image"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Withdraw Button (if user is a winner) */}
                <button
                  onClick={handleWithdraw}
                  disabled={isWithdrawing}
                  className="btn py-3 px-6 flex items-center gap-2 disabled:opacity-50"
                >
                  {isWithdrawing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Withdrawing...
                    </>
                  ) : (
                    <>
                      💰 Withdraw Winnings
                    </>
                  )}
                </button>
              </div>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Generating Images State */}
      {mockIdea.status === IdeaStatus.GeneratingImages && (
        <Card>
          <Card.Content className="p-12 text-center space-y-4">
            <div className="flex justify-center">
              <Loader2 size={48} className="animate-spin text-[var(--brand)]" />
            </div>
            <h2 className="text-xl font-bold text-white">
              🎨 Generating Images...
            </h2>
            <p className="text-zinc-400 max-w-md mx-auto">
              DePIN is creating 4 unique images based on the prompt. This usually takes 10-30 minutes.
              Voting will open automatically once ready!
            </p>
          </Card.Content>
        </Card>
      )}
    </div>
  );
}
