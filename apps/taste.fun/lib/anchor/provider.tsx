"use client";

import { createContext, useContext, useMemo } from 'react';
import { AnchorProvider, BN, Idl, Program } from '@coral-xyz/anchor';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';

export type AnchorCtx = {
  provider: AnchorProvider | null;
  getProgram: (idl: Idl, programId: string) => Program | null;
};

const Ctx = createContext<AnchorCtx>({
  provider: null,
  getProgram: () => null,
});

export function AnchorProviderContext({ children }: { children: React.ReactNode }) {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();

  const value = useMemo<AnchorCtx>(() => {
    if (!wallet) {
      return {
        provider: null,
        getProgram: () => null,
      };
    }

    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
    return {
      provider,
      getProgram: (idl: Idl, programId: string) => new Program(idl, programId, provider),
    };
  }, [wallet, connection]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnchor() {
  return useContext(Ctx);
}

export { BN };
