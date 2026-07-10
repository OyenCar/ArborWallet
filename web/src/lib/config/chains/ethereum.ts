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

export const ethereumChains: ChainDefinition[] = [
  {
    key: "ethereum-mainnet",
    name: "Ethereum",
    family: "evm",
    environment: "main",
    caip2: "eip155:1",
    chainId: 1,
    rpc: [{ url: "https://ethereum-rpc.publicnode.com", weight: 1 }],
    explorer: {
      base: "https://etherscan.io",
      tx: "https://etherscan.io/tx/{hash}",
      address: "https://etherscan.io/address/{addr}",
    },
    nativeCurrency: { symbol: "ETH", name: "Ether", decimals: 18 },
    tokens: [],
    providers: { ...evmProviders, execution: [...evmProviders.execution], portfolio: [...evmProviders.portfolio] },
    capabilities: { ...evmCaps },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: false,
  },
  {
    key: "ethereum-sepolia",
    name: "Ethereum Sepolia",
    family: "evm",
    environment: "test",
    caip2: "eip155:11155111",
    chainId: 11155111,
    rpc: [{ url: "https://ethereum-sepolia-rpc.publicnode.com", weight: 1 }],
    explorer: {
      base: "https://sepolia.etherscan.io",
      tx: "https://sepolia.etherscan.io/tx/{hash}",
      address: "https://sepolia.etherscan.io/address/{addr}",
    },
    nativeCurrency: { symbol: "ETH", name: "Sepolia Ether", decimals: 18 },
    tokens: [],
    providers: { ...evmProviders, execution: [...evmProviders.execution], portfolio: [...evmProviders.portfolio] },
    capabilities: { ...evmCaps },
    faucet: { url: "https://www.alchemy.com/faucets/ethereum-sepolia" },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: false,
  },
];
