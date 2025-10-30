"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet as WalletIcon } from 'lucide-react';

export default function WalletIndexPage() {
  const router = useRouter();

  // For demo, use a fixed demo wallet address
  const demoWallet = process.env.NEXT_PUBLIC_DEMO_WALLET_ADDRESS || 'Demo1234567890abcdefghijk';

  useEffect(() => {
    // TODO: When wallet adapter is integrated, check if user is connected
    // and redirect to their wallet page
    // For now, redirect to demo wallet
    router.push(`/wallet/${demoWallet}`);
  }, [router, demoWallet]);

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
              Connect your wallet to view your portfolio
            </p>
          </div>

          <div className="animate-pulse">
            <p className="text-sm text-zinc-500">Redirecting to wallet...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
