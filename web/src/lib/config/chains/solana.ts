import { ChainDefinition } from "../schema";

const solCaps = {
  smartWallet: false,
  accountAbstraction: false,
  paymaster: false,
  vault: false,
  portfolio: true,
  bridge: false,
  swap: false,
  nft: false,
  gasSponsorship: false,
};

const solProviders = {
  wallet: "magic" as const,
  account: "eoa" as const,
  execution: ["solana-rpc"] as const,
  portfolio: ["indexer", "rpc"] as const,
};

export const solanaChains: ChainDefinition[] = [
  {
    key: "solana-mainnet",
    name: "Solana",
    family: "solana",
    environment: "main",
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    rpc: [{ url: "https://api.mainnet-beta.solana.com", weight: 1 }],
    explorer: {
      base: "https://explorer.solana.com",
      tx: "https://explorer.solana.com/tx/{hash}",
      address: "https://explorer.solana.com/address/{addr}",
    },
    nativeCurrency: { symbol: "SOL", name: "Solana", decimals: 9 },
    tokens: [],
    providers: { ...solProviders, execution: [...solProviders.execution], portfolio: [...solProviders.portfolio] },
    capabilities: { ...solCaps },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: false,
  },
  {
    key: "solana-devnet",
    name: "Solana Devnet",
    family: "solana",
    environment: "test",
    caip2: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    rpc: [{ url: "https://api.devnet.solana.com", weight: 1 }],
    explorer: {
      base: "https://explorer.solana.com",
      tx: "https://explorer.solana.com/tx/{hash}?cluster=devnet",
      address: "https://explorer.solana.com/address/{addr}?cluster=devnet",
    },
    nativeCurrency: { symbol: "SOL", name: "Devnet SOL", decimals: 9 },
    tokens: [],
    providers: { ...solProviders, execution: [...solProviders.execution], portfolio: [...solProviders.portfolio] },
    capabilities: { ...solCaps },
    faucet: { url: "https://faucet.solana.com" },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: false,
  },
];
