import { ChainDefinition } from "../schema";

const evmCaps = {
  smartWallet: true,
  accountAbstraction: true,
  paymaster: true,
  vault: false,
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

export const bnbChains: ChainDefinition[] = [
  {
    key: "bnb-mainnet",
    name: "BNB Chain",
    family: "evm",
    environment: "main",
    caip2: "eip155:56",
    chainId: 56,
    rpc: [{ url: "https://bsc-dataseed.binance.org", weight: 1 }],
    explorer: {
      base: "https://bscscan.com",
      tx: "https://bscscan.com/tx/{hash}",
      address: "https://bscscan.com/address/{addr}",
    },
    nativeCurrency: { symbol: "BNB", name: "BNB", decimals: 18 },
    tokens: [],
    providers: { ...evmProviders, execution: [...evmProviders.execution], portfolio: [...evmProviders.portfolio] },
    capabilities: { ...evmCaps },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: false,
  },
  {
    key: "bnb-testnet",
    name: "BNB Testnet",
    family: "evm",
    environment: "test",
    caip2: "eip155:97",
    chainId: 97,
    rpc: [{ url: "https://data-seed-prebsc-1-s1.binance.org:8545", weight: 1 }],
    explorer: {
      base: "https://testnet.bscscan.com",
      tx: "https://testnet.bscscan.com/tx/{hash}",
      address: "https://testnet.bscscan.com/address/{addr}",
    },
    nativeCurrency: { symbol: "tBNB", name: "Test BNB", decimals: 18 },
    tokens: [],
    providers: { ...evmProviders, execution: [...evmProviders.execution], portfolio: [...evmProviders.portfolio] },
    capabilities: { ...evmCaps },
    faucet: { url: "https://testnet.bnbchain.org/faucet-smart" },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: false,
  },
];
