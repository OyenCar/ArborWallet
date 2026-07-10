import { ChainDefinition } from "../schema";

const evmCaps = {
  smartWallet: true,
  accountAbstraction: true,
  paymaster: true,
  vault: true, // Vault.sol deploys on Arbitrum
  portfolio: true,
  bridge: true,
  swap: false,
  nft: false,
  gasSponsorship: true,
};

const evmProviders = {
  wallet: "magic" as const,
  account: "zerodev" as const,
  execution: ["particle", "evm-rpc"] as const,
  portfolio: ["indexer", "rpc"] as const,
};

export const arbitrumChains: ChainDefinition[] = [
  {
    key: "arbitrum-one",
    name: "Arbitrum One",
    family: "evm",
    environment: "main",
    caip2: "eip155:42161",
    chainId: 42161,
    rpc: [{ url: "https://arb1.arbitrum.io/rpc", weight: 1 }],
    explorer: {
      base: "https://arbiscan.io",
      tx: "https://arbiscan.io/tx/{hash}",
      address: "https://arbiscan.io/address/{addr}",
    },
    nativeCurrency: { symbol: "ETH", name: "Ether", decimals: 18 },
    tokens: [],
    providers: { ...evmProviders, execution: [...evmProviders.execution], portfolio: [...evmProviders.portfolio] },
    capabilities: { ...evmCaps },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: true,
  },
  {
    key: "arbitrum-sepolia",
    name: "Arbitrum Sepolia",
    family: "evm",
    environment: "test",
    caip2: "eip155:421614",
    chainId: 421614,
    rpc: [{ url: "https://sepolia-rollup.arbitrum.io/rpc", weight: 1 }],
    explorer: {
      base: "https://sepolia.arbiscan.io",
      tx: "https://sepolia.arbiscan.io/tx/{hash}",
      address: "https://sepolia.arbiscan.io/address/{addr}",
    },
    nativeCurrency: { symbol: "ETH", name: "Sepolia Ether", decimals: 18 },
    tokens: [],
    providers: { ...evmProviders, execution: [...evmProviders.execution], portfolio: [...evmProviders.portfolio] },
    capabilities: { ...evmCaps },
    faucet: { url: "https://www.alchemy.com/faucets/arbitrum-sepolia" },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: true,
  },
];
