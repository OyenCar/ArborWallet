// src/app/context/MagicProvider.tsx
"use client";

// Magic + Web3 provider — structure from the official Magic EVM + Next.js guide
// (magic.link/posts/magic-evm-nextjs-guide), retargeted to Arbitrum Sepolia
// (the Vault chain, SPEC) instead of the guide's Ethereum Sepolia.
// Without an API key the app runs in mock/demo mode (see UserContext).
import { Magic } from "magic-sdk";
import Web3 from "web3";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const KEY = process.env.NEXT_PUBLIC_MAGIC_API_KEY;
export const magicEnabled = Boolean(KEY);

type MagicContextType = {
  magic: Magic | null;
  web3: Web3 | null;
};

const MagicContext = createContext<MagicContextType>({
  magic: null,
  web3: null,
});

export const useMagic = () => useContext(MagicContext);

const MagicProvider = ({ children }: { children: ReactNode }) => {
  const [magic, setMagic] = useState<Magic | null>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);

  useEffect(() => {
    if (!KEY) return;
    const m = new Magic(KEY, {
      network: {
        rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
        chainId: 421614,
      },
    });
    setMagic(m);
    setWeb3(new Web3(m.rpcProvider as never));
  }, []);

  const value = useMemo(() => ({ magic, web3 }), [magic, web3]);

  return (
    <MagicContext.Provider value={value}>{children}</MagicContext.Provider>
  );
};

export default MagicProvider;
