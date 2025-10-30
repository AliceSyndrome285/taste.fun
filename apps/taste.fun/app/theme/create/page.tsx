'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { BN } from '@coral-xyz/anchor';
import { initializeTheme, mintInitialThemeTokens, VotingMode } from '@/lib/api/token';
import { Card } from '@/components/ui/card';

export default function CreateThemePage() {
  const router = useRouter();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [votingMode, setVotingMode] = useState<VotingMode>(VotingMode.Classic);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!publicKey || !signTransaction || !signAllTransactions) {
      setError('Please connect your wallet first');
      return;
    }

    if (!name.trim() || !description.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    setLoadingStep('Initializing theme accounts...');

    try {
      const themeId = new BN(Date.now());
      
      const wallet = {
        publicKey,
        signTransaction,
        signAllTransactions,
      };

      // Step 1: Initialize theme (create accounts)
      console.log('Step 1: Initializing theme...');
      const initTx = await initializeTheme(
        connection,
        wallet,
        themeId,
        name.trim(),
        description.trim(),
        votingMode
      );
      console.log('Theme initialized:', initTx);

      setLoadingStep('Waiting for confirmation...');
      // Wait for confirmation before proceeding to step 2
      await connection.confirmTransaction(initTx, 'confirmed');
      console.log('Initialization confirmed');

      setLoadingStep('Minting initial tokens...');
      // Step 2: Mint initial tokens
      console.log('Step 2: Minting initial tokens...');
      const mintTx = await mintInitialThemeTokens(connection, wallet, themeId);
      console.log('Tokens minted:', mintTx);

      setLoadingStep('Finalizing...');
      // Wait for final confirmation
      await connection.confirmTransaction(mintTx, 'confirmed');
      
      console.log('Theme created successfully!');
      
      // Show success message with options
      if (confirm('Theme created successfully! Would you like to create the first Spark (idea) for this theme now?')) {
        // Navigate to spark creation with theme pre-selected
        router.push(`/spark?theme=${themeId.toString()}`);
      } else {
        // Go to themes list
        router.push('/explore?tab=themes');
      }
    } catch (err: any) {
      console.error('Error creating theme:', err);
      setError(err.message || 'Failed to create theme');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Create a New Theme</h1>
        <p className="text-gray-400 mb-8">
          Launch your own creative theme with a unique token economy
        </p>

        <Card className="bg-gray-800/50 border-gray-700 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Theme Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Theme Name *
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={12}
                placeholder="e.g., AI Art Collective"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 transition-colors"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {name.length}/12 characters
              </p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-2">
                Description *
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={48}
                rows={4}
                placeholder="Describe your theme and what kind of ideas you want to see..."
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 transition-colors resize-none"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {description.length}/48 characters
              </p>
            </div>

            {/* Voting Mode */}
            <div>
              <label className="block text-sm font-medium mb-3">
                Voting Mode *
              </label>
              <div className="space-y-3">
                <label className="flex items-start p-4 bg-gray-900 border border-gray-700 rounded-lg cursor-pointer hover:border-purple-500 transition-colors">
                  <input
                    type="radio"
                    name="votingMode"
                    value="classic"
                    checked={votingMode === VotingMode.Classic}
                    onChange={() => setVotingMode(VotingMode.Classic)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium">Classic Mode</div>
                    <div className="text-sm text-gray-400">
                      Most voted option wins. Traditional voting mechanism.
                    </div>
                  </div>
                </label>

                <label className="flex items-start p-4 bg-gray-900 border border-gray-700 rounded-lg cursor-pointer hover:border-purple-500 transition-colors">
                  <input
                    type="radio"
                    name="votingMode"
                    value="reverse"
                    checked={votingMode === VotingMode.Reverse}
                    onChange={() => setVotingMode(VotingMode.Reverse)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium">Reverse Mode</div>
                    <div className="text-sm text-gray-400">
                      Least voted option wins. High risk, high reward for contrarians.
                    </div>
                  </div>
                </label>

                <label className="flex items-start p-4 bg-gray-900 border border-gray-700 rounded-lg cursor-pointer hover:border-purple-500 transition-colors">
                  <input
                    type="radio"
                    name="votingMode"
                    value="middleWay"
                    checked={votingMode === VotingMode.MiddleWay}
                    onChange={() => setVotingMode(VotingMode.MiddleWay)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium">Middle Way Mode</div>
                    <div className="text-sm text-gray-400">
                      Both most and least voted win. Middle options are split.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Token Economics Info */}
            <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-4">
              <h3 className="font-semibold mb-2 flex items-center">
                <span className="mr-2">💎</span>
                Token Economics
              </h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Total Supply: 1,000,000,000 tokens</li>
                <li>• Creator Reserve: 20% (200M tokens)</li>
                <li>• Circulating Supply: 80% (800M tokens)</li>
                <li>• Bonding Curve: Constant Product (like Uniswap)</li>
                <li>• Trading Fee: 1% (50% buyback, 30% platform, 20% you)</li>
              </ul>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-200">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !publicKey}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold text-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {loadingStep || 'Creating Theme...'}
                </span>
              ) : !publicKey ? (
                'Connect Wallet to Create'
              ) : (
                'Create Theme & Launch Token'
              )}
            </button>
          </form>
        </Card>

        {/* How It Works */}
        <div className="mt-8 p-6 bg-gray-800/30 border border-gray-700 rounded-lg">
          <h3 className="font-semibold mb-3">How It Works</h3>
          <ol className="text-sm text-gray-300 space-y-2">
            <li className="flex">
              <span className="mr-2">1.</span>
              <span>You create a theme and automatically receive 20% of the total token supply</span>
            </li>
            <li className="flex">
              <span className="mr-2">2.</span>
              <span>Users buy your theme tokens to participate in voting on ideas under this theme</span>
            </li>
            <li className="flex">
              <span className="mr-2">3.</span>
              <span>Trading fees generate revenue: 50% goes to buyback & burn, 30% to platform, 20% to you</span>
            </li>
            <li className="flex">
              <span className="mr-2">4.</span>
              <span>As your theme grows in popularity, token price increases due to constant product curve</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
