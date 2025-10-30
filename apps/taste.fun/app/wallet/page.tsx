"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Wallet as WalletIcon } from 'lucide-react';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

export default function WalletPage() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();

  // For demo fallback
  const demoWallet = process.env.NEXT_PUBLIC_DEMO_WALLET_ADDRESS || 'Demo1234567890abcdefghijk';

  useEffect(() => {
    // If wallet is connected, redirect to user's wallet page
    if (connected && publicKey) {
      router.push(`/wallet/${publicKey.toString()}`);
    }
  }, [connected, publicKey, router]);

  return (
    <div className="min-h-screen flex items-center justify-center pb-20 md:pb-8">
      <div className="max-w-md w-full mx-4">
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--brand)] to-purple-500 flex items-center justify-center mx-auto">
            <WalletIcon className="w-10 h-10 text-white" />
          </div>
          
          <div>
            <h1 className="text-2xl font-bold mb-2">View Your Wallet</h1>
            <p className="text-zinc-400">
              {connected 
                ? 'Redirecting to your wallet...' 
                : 'Connect your wallet to view your portfolio and voting history'
              }
            </p>
          </div>

          {!connected && (
            <div className="pt-4">
              <WalletMultiButton className="!bg-[var(--brand)] hover:!bg-[var(--brand-hover)] !rounded-lg !h-12 !text-white !font-semibold" />
            </div>
          )}

          {connected && (
            <div className="animate-pulse">
              <p className="text-sm text-zinc-500">Loading your wallet data...</p>
            </div>
          )}

          <div className="pt-4 border-t border-zinc-800">
            <p className="text-sm text-zinc-500 mb-3">Or view a demo wallet</p>
            <button
              onClick={() => router.push(`/wallet/${demoWallet}`)}
              className="text-sm text-[var(--brand)] hover:underline"
            >
              View Demo Wallet →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
