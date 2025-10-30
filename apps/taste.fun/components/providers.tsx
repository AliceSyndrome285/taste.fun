"use client";

import { ReactNode, useMemo, useEffect } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { AnchorProviderContext } from '@/lib/anchor/provider';
import { SOLANA_RPC_URL } from '@/lib/solana/config';

export function Providers({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  useEffect(() => {
    try {
      // Log registered adapters and whether the browser injected a Solana provider (Phantom)
      // This helps debug why WalletMultiButton may open the Phantom website (fallback) instead of the extension.
      // Check DevTools console for these messages when the app loads.
      // eslint-disable-next-line no-console
      console.log('Solana wallet adapters:', wallets.map((w: any) => w.name || w?.adapterName || 'unknown'));
      // eslint-disable-next-line no-console
      console.log('window.solana detected:', (window as any).solana);
      // eslint-disable-next-line no-console
      console.log('window.phantom detected:', (window as any).phantom);

      if (typeof (window as any).solana === 'undefined') {
        // eslint-disable-next-line no-console
        console.warn(
          'No injected Solana provider detected (window.solana is undefined). Make sure a browser wallet extension (e.g., Phantom) is installed and enabled for this site (localhost or HTTPS).'
        );
      }
    } catch (e) {
      // ignore
    }
  }, [wallets]);

  return (
    <ConnectionProvider endpoint={SOLANA_RPC_URL} config={{ commitment: 'confirmed' }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AnchorProviderContext>{children}</AnchorProviderContext>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
