"use client";

import { X } from 'lucide-react';
import { useState } from 'react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HowItWorksModal({ isOpen, onClose }: HowItWorksModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[var(--surface)] rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-zinc-800 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--surface)] border-b border-zinc-800 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">🎯 How Taste & Earn Works</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Visual Flow */}
          <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-lg p-6 border border-purple-500/20">
            <h3 className="text-lg font-semibold text-white mb-4">The Game Loop</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--brand)] flex items-center justify-center text-black font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-white">Submit a Spark</h4>
                  <p className="text-sm text-zinc-400 mt-1">
                    Anyone can create an AI image generation prompt. Pay 0.005 SOL fee.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--brand)] flex items-center justify-center text-black font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-white">AI Generates 4 Images</h4>
                  <p className="text-sm text-zinc-400 mt-1">
                    DePIN network automatically creates 4 different images from your prompt (24h).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--brand)] flex items-center justify-center text-black font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-white">Community Votes (Stake Required)</h4>
                  <p className="text-sm text-zinc-400 mt-1">
                    Reviewers stake min 0.01 SOL to vote for their favorite image. Voting uses quadratic weighting (√stake).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--brand)] flex items-center justify-center text-black font-bold">
                  4
                </div>
                <div>
                  <h4 className="font-semibold text-white">Winners Split the Prize</h4>
                  <p className="text-sm text-zinc-400 mt-1">
                    The majority gets their stake back + 50% of losers' stakes. Early voters get 20% bonus!
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--brand)] flex items-center justify-center text-black font-bold">
                  5
                </div>
                <div>
                  <h4 className="font-semibold text-white">Creator Gets Curator Fee + NFT</h4>
                  <p className="text-sm text-zinc-400 mt-1">
                    Original spark creator receives 1% of all stakes + owns the winning image as NFT.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Economic Model */}
          <div className="bg-zinc-900/50 rounded-lg p-6 border border-zinc-800">
            <h3 className="text-lg font-semibold text-white mb-4">💰 Economic Model</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Curator Fee (to creator):</span>
                <span className="text-white font-medium">1%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Platform Fee:</span>
                <span className="text-white font-medium">2%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Penalty (losers):</span>
                <span className="text-white font-medium">50% of stake</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Early Bird Bonus (Day 1):</span>
                <span className="text-[var(--brand)] font-medium">+20%</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800 pt-2">
                <span className="text-zinc-400">Winner Share:</span>
                <span className="text-[var(--brand)] font-bold">Original stake + share of penalty pool</span>
              </div>
            </div>
          </div>

          {/* Example */}
          <div className="bg-green-500/10 rounded-lg p-6 border border-green-500/20">
            <h3 className="text-lg font-semibold text-white mb-4">📊 Example Scenario</h3>
            <p className="text-sm text-zinc-300 mb-4">
              50 people vote on a contest. Image A gets 30 votes (winners), Image B gets 20 votes (losers).
            </p>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>• <strong>Total Pool:</strong> 0.5 SOL (50 × 0.01)</li>
              <li>• <strong>Curator Fee:</strong> 0.005 SOL (1%) → Creator</li>
              <li>• <strong>Platform Fee:</strong> 0.01 SOL (2%) → Protocol</li>
              <li>• <strong>Remaining:</strong> 0.485 SOL</li>
              <li>• <strong>Penalty Pool:</strong> 0.1 SOL (50% of 20 losers' stakes)</li>
              <li>• <strong>Each Winner Gets:</strong> 0.01 (original) + 0.0033 (share) = <strong className="text-[var(--brand)]">~0.0133 SOL (+33%)</strong></li>
              <li>• <strong>Each Loser Gets:</strong> 0.005 SOL (50% refund)</li>
            </ul>
          </div>

          {/* Anti-Manipulation */}
          <div className="bg-amber-500/10 rounded-lg p-6 border border-amber-500/20">
            <h3 className="text-lg font-semibold text-white mb-4">🛡️ Anti-Manipulation Features</h3>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>• <strong>Quadratic Voting:</strong> √stake prevents whales from dominating (doubling stake only increases vote by √2)</li>
              <li>• <strong>Early Bird Bonus:</strong> Encourages genuine early participation</li>
              <li>• <strong>Anonymous Voting:</strong> Real-time vote counts are hidden until contest ends</li>
              <li>• <strong>RejectAll Option:</strong> If 2/3+ vote "Reject All", everyone gets refunded</li>
            </ul>
          </div>

          {/* CTA */}
          <div className="text-center pt-4">
            <button
              onClick={onClose}
              className="btn px-8 py-3"
            >
              Got It! Let's Vote 🚀
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
