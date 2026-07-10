import { ChainDefinition, EnvironmentProfile, environmentProfileSchema } from "./schema";
import { chainMap } from "./chains";

const testnetChainKeys = [
  "ethereum-sepolia",
  "arbitrum-sepolia",
  "bnb-testnet",
  "solana-devnet",
  "bitcoin-testnet",
];

const mainnetChainKeys = [
  "ethereum-mainnet",
  "arbitrum-one",
  "bnb-mainnet",
  "solana-mainnet",
  "bitcoin-mainnet",
];

const rawProfiles: EnvironmentProfile[] = [
  {
    name: "local",
    networkClass: "test",
    activeChainKeys: [...testnetChainKeys],
    featureFlags: {},
    faucetsEnabled: true,
    paymasterTier: "capped",
    bannerStyle: "local",
  },
  {
    name: "development",
    networkClass: "test",
    activeChainKeys: [...testnetChainKeys],
    featureFlags: {},
    faucetsEnabled: true,
    paymasterTier: "capped",
    bannerStyle: "testnet",
  },
  {
    name: "staging",
    networkClass: "test",
    activeChainKeys: [...testnetChainKeys],
    featureFlags: {},
    faucetsEnabled: true,
    paymasterTier: "capped",
    bannerStyle: "testnet",
  },
  {
    name: "testnet",
    networkClass: "test",
    activeChainKeys: [...testnetChainKeys],
    featureFlags: {},
    faucetsEnabled: true,
    paymasterTier: "capped",
    bannerStyle: "testnet",
  },
  {
    name: "mainnet",
    networkClass: "main",
    activeChainKeys: [...mainnetChainKeys],
    featureFlags: {},
    faucetsEnabled: false,
    paymasterTier: "full",
    bannerStyle: "none",
  },
];

export const environmentProfiles: Record<EnvironmentProfile["name"], EnvironmentProfile> =
  rawProfiles.reduce((acc, p) => {
    const parsed = environmentProfileSchema.safeParse(p);
    if (!parsed.success) {
      throw new Error(`Invalid EnvironmentProfile "${p.name}": ${parsed.error.message}`);
    }
    acc[parsed.data.name] = parsed.data;
    return acc;
  }, {} as Record<EnvironmentProfile["name"], EnvironmentProfile>);

export function assertProfileIsolation(profile: EnvironmentProfile): void {
  for (const key of profile.activeChainKeys) {
    const chain = chainMap.get(key);
    if (!chain) {
      throw new Error(`Profile "${profile.name}" references unknown chain: ${key}`);
    }
    if (chain.environment !== profile.networkClass) {
      throw new Error(
        `Environment isolation violated: profile "${profile.name}" (${profile.networkClass}) ` +
          `activates chain "${key}" (${chain.environment})`,
      );
    }
  }
}

export function resolveProfileChains(profile: EnvironmentProfile): ChainDefinition[] {
  assertProfileIsolation(profile);
  return profile.activeChainKeys.map((k) => chainMap.get(k)!);
}
