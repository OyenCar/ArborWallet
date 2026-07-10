import { ChainDefinition } from "../schema";

const btcCaps = {
  smartWallet: false,
  accountAbstraction: false,
  paymaster: false,
  vault: false,
  portfolio: true,
  bridge: false, // receive + balance only at launch (Planning.md §22.7)
  swap: false,
  nft: false,
  gasSponsorship: false,
};

const btcProviders = {
  wallet: "magic" as const,
  account: "eoa" as const,
  execution: ["bitcoin-rpc"] as const,
  portfolio: ["rpc"] as const,
};

export const bitcoinChains: ChainDefinition[] = [
  {
    key: "bitcoin-mainnet",
    name: "Bitcoin",
    family: "bitcoin",
    environment: "main",
    caip2: "bip122:000000000019d6689c085ae165831e93",
    rpc: [{ url: "https://blockstream.info/api", weight: 1 }],
    explorer: {
      base: "https://blockstream.info",
      tx: "https://blockstream.info/tx/{hash}",
      address: "https://blockstream.info/address/{addr}",
    },
    nativeCurrency: { symbol: "BTC", name: "Bitcoin", decimals: 8 },
    tokens: [],
    providers: { ...btcProviders, execution: [...btcProviders.execution], portfolio: [...btcProviders.portfolio] },
    capabilities: { ...btcCaps },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: false,
  },
  {
    key: "bitcoin-testnet",
    name: "Bitcoin Testnet",
    family: "bitcoin",
    environment: "test",
    caip2: "bip122:000000000933ea01ad0ee984209779ba",
    rpc: [{ url: "https://blockstream.info/testnet/api", weight: 1 }],
    explorer: {
      base: "https://blockstream.info/testnet",
      tx: "https://blockstream.info/testnet/tx/{hash}",
      address: "https://blockstream.info/testnet/address/{addr}",
    },
    nativeCurrency: { symbol: "tBTC", name: "Test Bitcoin", decimals: 8 },
    tokens: [],
    providers: { ...btcProviders, execution: [...btcProviders.execution], portfolio: [...btcProviders.portfolio] },
    capabilities: { ...btcCaps },
    faucet: { url: "https://coinfaucet.eu/en/btc-testnet" },
    featureFlags: {},
    defaultWalletEligible: true,
    vaultCompatible: false,
  },
];
