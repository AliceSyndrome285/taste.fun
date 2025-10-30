"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { useAnchor } from '@/lib/anchor/provider';

export default function WalletPage() {
  const { publicKey, connected, connecting, connect, disconnect, wallets, select } = useWallet();
  const { provider } = useAnchor();

  const walletName = useMemo(() => wallets.find((w) => w.readyState !== 'Unsupported')?.adapter.name, [wallets]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <Card.Header>Wallet</Card.Header>
        <Card.Content>
          <div className="space-y-3">
            {connected ? (
              <>
                <p className="text-sm text-zinc-400">Connected as</p>
                <p className="font-mono">{publicKey?.toBase58()}</p>
                <div className="flex gap-3 pt-2">
                  <button className="btn" onClick={() => disconnect()}>Disconnect</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-zinc-400">No wallet connected</p>
                <div className="flex gap-3 pt-2">
                  <button
                    className="btn"
                    disabled={connecting}
                    onClick={async () => {
                      const first = wallets.find((w) => w.readyState !== 'Unsupported');
                      if (first) select(first.adapter.name);
                      try {
                        await connect();
                      } catch (e) {
                        // swallow
                      }
                    }}
                  >
                    {connecting ? 'Connecting...' : `Connect${walletName ? ` ${walletName}` : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>Anchor Provider</Card.Header>
        <Card.Content>
          {provider ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-400">Provider ready</p>
              <p className="text-xs text-zinc-400">Commitment: confirmed</p>
            </div>
          ) : (
            <p className="text-zinc-400">Connect a wallet to initialize the Anchor provider.</p>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
