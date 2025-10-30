"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function ProfileIndexPage() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();

  useEffect(() => {
    if (connected && publicKey) {
      // Redirect to user's profile
      router.push(`/profile/${publicKey.toString()}`);
    }
  }, [connected, publicKey, router]);

  return (
    <div className="min-h-screen flex items-center justify-center pb-20 md:pb-8">
      <div className="max-w-md w-full mx-4">
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--brand)] to-purple-500 flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          
          <div>
            <h1 className="text-2xl font-bold mb-2">View Your Profile</h1>
            <p className="text-zinc-400">
              Connect your wallet to view your portfolio, created themes, and voting history
            </p>
          </div>

          <div className="pt-4">
            <WalletMultiButton className="!bg-[var(--brand)] hover:!bg-[var(--brand-hover)] !rounded-lg !h-12" />
          </div>

          <div className="pt-4 border-t border-zinc-800">
            <p className="text-sm text-zinc-500">
              Or enter a wallet address to view any user's profile
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
