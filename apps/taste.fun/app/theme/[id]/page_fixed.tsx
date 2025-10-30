"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { apiClient, type ThemeResponse, type TokenSwapResponse } from '@/lib/api/client';
import { 
  getUserTokenBalance, 
  buyThemeTokens, 
  sellThemeTokens, 
  calculateBuyTokens, 
  calculateSellSol
} from '@/lib/api/token';
import { 
  ArrowLeft, 
  TrendingUp, 
  Coins, 
  Users, 
  Sparkles, 
  Loader2, 
  ArrowUpRight, 
  ArrowDownRight,
  ExternalLink,
  Activity
} from 'lucide-react';

export default function ThemeDetailPage() {
  const params = useParams();
  const { connection } = useConnection();
  const wallet = useWallet();
  
  const [theme, setTheme] = useState<ThemeResponse | null>(null);
  const [userBalance, setUserBalance] = useState<BN>(new BN(0));
  const [recentSwaps, setRecentSwaps] = useState<TokenSwapResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Trading state
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [tradeAmount, setTradeAmount] = useState('');
  const [estimatedOutput, setEstimatedOutput] = useState('0');
  const [slippage, setSlippage] = useState(1); // 1%
  const [trading, setTrading] = useState(false);
  const [tradeError, setTradeError] = useState('');

  const themeId = params.id as string;

  // Load theme data
  useEffect(() => {
    const loadTheme = async () => {
      try {
        setLoading(true);
        const themeData = await apiClient.getThemeById(themeId);
        setTheme(themeData);
        
        // Load recent swaps
        const swaps = await apiClient.getThemeSwaps(themeId);
        setRecentSwaps(swaps.data);
      } catch (error) {
        console.error('Failed to load theme:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTheme();
  }, [themeId]);

  // Load user token balance
  useEffect(() => {
    const loadBalance = async () => {
      if (!wallet.publicKey || !theme) return;
      
      try {
        const balance = await getUserTokenBalance(
          connection,
          wallet.publicKey,
          new PublicKey(theme.tokenMint)
        );
        setUserBalance(balance);
      } catch (error) {
        console.error('Failed to load balance:', error);
      }
    };

    loadBalance();
  }, [wallet.publicKey, theme, connection]);

  // Calculate estimated output when trade amount changes
  useEffect(() => {
    if (!theme || !tradeAmount || parseFloat(tradeAmount) <= 0) {
      setEstimatedOutput('0');
      return;
    }

    try {
      if (tradeMode === 'buy') {
        // Calculate tokens received for SOL input
        const solAmount = new BN(parseFloat(tradeAmount) * LAMPORTS_PER_SOL);
        const tokensOut = calculateBuyTokens(
          solAmount,
          new BN(theme.tokenReserves * 1e6),
          new BN(theme.solReserves * LAMPORTS_PER_SOL),
          100 // 1% fee
        );
        setEstimatedOutput((tokensOut.toNumber() / 1e6).toFixed(2));
      } else {
        // Calculate SOL received for token input
        const tokenAmount = new BN(parseFloat(tradeAmount) * 1e6);
        const solOut = calculateSellSol(
          tokenAmount,
          new BN(theme.tokenReserves * 1e6),
          new BN(theme.solReserves * LAMPORTS_PER_SOL),
          100 // 1% fee
        );
        setEstimatedOutput((solOut.toNumber() / LAMPORTS_PER_SOL).toFixed(6));
      }
    } catch (error) {
      console.error('Failed to calculate output:', error);
      setEstimatedOutput('0');
    }
  }, [tradeAmount, tradeMode, theme]);

  const handleTrade = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !theme) {
      setTradeError('Please connect your wallet');
      return;
    }

    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      setTradeError('Please enter a valid amount');
      return;
    }

    setTrading(true);
    setTradeError('');

    try {
      const themePubkey = new PublicKey(theme.id);
      
      if (tradeMode === 'buy') {
        const solAmount = new BN(parseFloat(tradeAmount) * LAMPORTS_PER_SOL);
        const minTokensOut = calculateBuyTokens(
          solAmount,
          new BN(theme.tokenReserves * 1e6),
          new BN(theme.solReserves * LAMPORTS_PER_SOL),
          100
        ).muln(100 - slippage).divn(100); // Apply slippage tolerance

        await buyThemeTokens(
          connection,
          wallet,
          themePubkey,
          solAmount,
          minTokensOut,
          slippage * 100
        );

        alert(`Successfully bought ${estimatedOutput} tokens!`);
      } else {
        const tokenAmount = new BN(parseFloat(tradeAmount) * 1e6);
        const minSolOut = calculateSellSol(
          tokenAmount,
          new BN(theme.tokenReserves * 1e6),
          new BN(theme.solReserves * LAMPORTS_PER_SOL),
          100
        ).muln(100 - slippage).divn(100); // Apply slippage tolerance

        await sellThemeTokens(
          connection,
          wallet,
          themePubkey,
          tokenAmount,
          minSolOut,
          slippage * 100
        );

        alert(`Successfully sold tokens for ${estimatedOutput} SOL!`);
      }

      // Refresh data
      setRefreshing(true);
      const updatedTheme = await apiClient.getThemeById(themeId);
      setTheme(updatedTheme);
      
      const updatedBalance = await getUserTokenBalance(
        connection,
        wallet.publicKey,
        new PublicKey(theme.tokenMint)
      );
      setUserBalance(updatedBalance);
      
      // Reload swaps
      const swaps = await apiClient.getThemeSwaps(themeId);
      setRecentSwaps(swaps.data);
      setRefreshing(false);

      setTradeAmount('');
    } catch (error: any) {
      console.error('Trade failed:', error);
      setTradeError(error.message || 'Transaction failed. Please try again.');
    } finally {
      setTrading(false);
    }
  };

  const getVotingModeDescription = (mode: string) => {
    switch (mode) {
      case 'Classic':
        return 'The image with the most votes wins. Winners split losers\' stakes.';
      case 'Reverse':
        return 'The image with the LEAST votes wins. Minority takes all!';
      case 'MiddleWay':
        return 'Both extreme ends (most & least votes) win. Middle options lose.';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-[var(--brand)]" size={48} />
      </div>
    );
  }

  if (!theme) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-2xl font-bold text-white mb-4">Theme Not Found</h2>
        <p className="text-zinc-400 mb-6">The theme you're looking for doesn't exist.</p>
        <Link href="/theme" className="btn">
          Browse Themes
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/theme"
          className="p-2 rounded-lg hover:bg-[var(--surface)] transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-white">{theme.name}</h1>
          <p className="text-zinc-400 text-sm mt-1">{theme.description}</p>
        </div>
        <Link
          href={`https://solscan.io/account/${theme.tokenMint}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg hover:bg-[var(--surface)] transition-colors text-zinc-400 hover:text-white"
        >
          <ExternalLink size={20} />
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <Card.Content className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <Coins size={16} />
              Token Price
            </div>
            <div className="text-2xl font-bold text-white">
              {theme.currentPrice.toFixed(9)} SOL
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <TrendingUp size={16} />
              Total Volume
            </div>
            <div className="text-2xl font-bold text-white">
              {(theme.totalVolume || 0).toFixed(2)} SOL
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <Sparkles size={16} />
              Ideas Created
            </div>
            <div className="text-2xl font-bold text-white">
              {theme.totalIdeas || 0}
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <Users size={16} />
              Circulating Supply
            </div>
            <div className="text-2xl font-bold text-white">
              {(theme.circulatingSupply / 1e6).toFixed(0)}M
            </div>
          </Card.Content>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Column - Theme Info */}
        <div className="md:col-span-1 space-y-4">
          {/* Voting Mode */}
          <Card>
            <Card.Content className="p-5 space-y-3">
              <h3 className="text-lg font-semibold text-white">Voting Mode</h3>
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--brand)]">
                  {theme.votingMode === 'Classic' && '🎯 Classic Mode'}
                  {theme.votingMode === 'Reverse' && '🔄 Reverse Mode'}
                  {theme.votingMode === 'MiddleWay' && '⚖️ Middle Way Mode'}
                </div>
                <p className="text-xs text-zinc-400">
                  {getVotingModeDescription(theme.votingMode)}
                </p>
              </div>
            </Card.Content>
          </Card>

          {/* Token Economics */}
          <Card>
            <Card.Content className="p-5 space-y-3">
              <h3 className="text-lg font-semibold text-white">Token Economics</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Supply:</span>
                  <span className="text-white font-medium">
                    {(theme.totalSupply / 1e6).toFixed(0)}M
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Circulating:</span>
                  <span className="text-white font-medium">
                    {(theme.circulatingSupply / 1e6).toFixed(0)}M
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Creator Reserve:</span>
                  <span className="text-white font-medium">
                    {(theme.creatorReserve / 1e6).toFixed(0)}M
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">SOL Reserves:</span>
                  <span className="text-white font-medium">
                    {theme.solReserves.toFixed(3)} SOL
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Token Reserves:</span>
                  <span className="text-white font-medium">
                    {(theme.tokenReserves / 1e6).toFixed(0)}M
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Buyback Pool:</span>
                  <span className="text-white font-medium">
                    {theme.buybackPool.toFixed(3)} SOL
                  </span>
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* Your Balance */}
          {wallet.connected && (
            <Card>
              <Card.Content className="p-5 space-y-3">
                <h3 className="text-lg font-semibold text-white">Your Balance</h3>
                <div className="text-2xl font-bold text-[var(--brand)]">
                  {(userBalance.toNumber() / 1e6).toFixed(2)} Tokens
                </div>
                <div className="text-xs text-zinc-400">
                  ≈ {(userBalance.toNumber() / 1e6 * theme.currentPrice).toFixed(6)} SOL
                </div>
              </Card.Content>
            </Card>
          )}

          {/* Recent Swaps */}
          <Card>
            <Card.Content className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-zinc-400" />
                <h3 className="text-lg font-semibold text-white">Recent Trades</h3>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {recentSwaps.length === 0 ? (
                  <p className="text-xs text-zinc-500">No trades yet</p>
                ) : (
                  recentSwaps.map((swap, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-2 border-b border-zinc-800 last:border-0">
                      <div className="flex items-center gap-2">
                        {swap.isBuy ? (
                          <ArrowUpRight size={12} className="text-green-400" />
                        ) : (
                          <ArrowDownRight size={12} className="text-red-400" />
                        )}
                        <span className="text-zinc-400">
                          {swap.isBuy ? 'Buy' : 'Sell'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-medium">
                          {swap.isBuy 
                            ? `${swap.tokenAmount.toFixed(0)} tokens`
                            : `${swap.solAmount.toFixed(4)} SOL`
                          }
                        </div>
                        <div className="text-zinc-500">
                          {new Date(swap.timestamp * 1000).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card.Content>
          </Card>
        </div>

        {/* Right Column - Trading Interface */}
        <div className="md:col-span-2">
          <Card>
            <Card.Content className="p-6 space-y-6">
              <h3 className="text-xl font-semibold text-white">Trade Tokens</h3>

              {/* Trade Mode Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setTradeMode('buy')}
                  className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    tradeMode === 'buy'
                      ? 'bg-green-500 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  <ArrowUpRight size={16} />
                  Buy Tokens
                </button>
                <button
                  onClick={() => setTradeMode('sell')}
                  className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    tradeMode === 'sell'
                      ? 'bg-red-500 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  <ArrowDownRight size={16} />
                  Sell Tokens
                </button>
              </div>

              {/* Trade Input */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  {tradeMode === 'buy' ? 'You Pay (SOL)' : 'You Sell (Tokens)'}
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  placeholder={tradeMode === 'buy' ? '0.1' : '1000'}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-lg placeholder:text-zinc-600 focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
                />
              </div>

              {/* Output Display */}
              <div className="bg-zinc-900/50 rounded-lg p-4">
                <div className="text-sm text-zinc-400 mb-1">
                  {tradeMode === 'buy' ? 'You Receive (Tokens)' : 'You Receive (SOL)'}
                </div>
                <div className="text-2xl font-bold text-white">
                  {estimatedOutput} {tradeMode === 'buy' ? 'Tokens' : 'SOL'}
                </div>
                {parseFloat(estimatedOutput) > 0 && (
                  <div className="text-xs text-zinc-500 mt-1">
                    Price: {tradeMode === 'buy' 
                      ? (parseFloat(tradeAmount) / parseFloat(estimatedOutput)).toFixed(9) 
                      : (parseFloat(estimatedOutput) / parseFloat(tradeAmount)).toFixed(9)} SOL/Token
                  </div>
                )}
              </div>

              {/* Slippage Control */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Slippage Tolerance: {slippage}%
                </label>
                <div className="flex gap-2">
                  {[0.5, 1, 2, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => setSlippage(value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        slippage === value
                          ? 'bg-[var(--brand)] text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {value}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Trade Button */}
              {!wallet.connected ? (
                <button
                  disabled
                  className="w-full py-4 rounded-lg bg-zinc-800 text-zinc-500 font-semibold"
                >
                  Connect Wallet to Trade
                </button>
              ) : (
                <button
                  onClick={handleTrade}
                  disabled={trading || !tradeAmount || parseFloat(tradeAmount) <= 0}
                  className="w-full btn py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {trading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Processing...
                    </>
                  ) : (
                    <>
                      {tradeMode === 'buy' ? 'Buy Tokens' : 'Sell Tokens'}
                    </>
                  )}
                </button>
              )}

              {/* Error Message */}
              {tradeError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <p className="text-sm text-red-200">{tradeError}</p>
                </div>
              )}

              {/* Info */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-xs text-blue-200/80 space-y-1">
                <p>• 1% trading fee applies to all transactions</p>
                <p>• Fees are split: 50% buyback, 30% platform, 20% creator</p>
                <p>• Buyback tokens are burned, reducing supply</p>
                <p>• Price updates automatically based on bonding curve</p>
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>

      {/* Actions */}
      <Card>
        <Card.Content className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">What's Next?</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              href={`/spark?theme=${themeId}`}
              className="p-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-colors border border-zinc-800 hover:border-[var(--brand)]"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--brand)]/20">
                  <Sparkles className="text-[var(--brand)]" size={20} />
                </div>
                <div>
                  <div className="font-medium text-white">Create an Idea</div>
                  <div className="text-xs text-zinc-400">Submit a prompt for this theme</div>
                </div>
              </div>
            </Link>

            <Link
              href={`/explore?theme=${themeId}`}
              className="p-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-colors border border-zinc-800 hover:border-[var(--brand)]"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--brand)]/20">
                  <TrendingUp className="text-[var(--brand)]" size={20} />
                </div>
                <div>
                  <div className="font-medium text-white">Browse Ideas</div>
                  <div className="text-xs text-zinc-400">Vote on ideas in this theme</div>
                </div>
              </div>
            </Link>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
