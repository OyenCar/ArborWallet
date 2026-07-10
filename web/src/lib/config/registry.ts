import {
  ChainCapability,
  ChainDefinition,
  ChainKey,
  EnvironmentProfile,
  ProviderDefinition,
  ProviderKey,
  ProviderRole,
} from "./schema";
import { getProvider } from "./providers";
import { getChainDefinition } from "./chains";
import { environmentProfiles, assertProfileIsolation, resolveProfileChains } from "./environments";

const DEFAULT_PROFILE: EnvironmentProfile["name"] = "testnet";

export function getActiveProfile(): EnvironmentProfile {
  const name = (process.env.APP_ENV_PROFILE ?? DEFAULT_PROFILE) as EnvironmentProfile["name"];
  const profile = environmentProfiles[name];
  if (!profile) {
    throw new Error(`Unknown environment profile: ${name}`);
  }
  return profile;
}

export function getChain(key: ChainKey): ChainDefinition {
  return getChainDefinition(key);
}

export function activeChains(): ChainDefinition[] {
  return resolveProfileChains(getActiveProfile());
}

export function getChainCapability(key: ChainKey): ChainCapability {
  return getChain(key).capabilities;
}

export function hasCapability(key: ChainKey, cap: keyof ChainCapability): boolean {
  return getChain(key).capabilities[cap];
}

function pickProvider(candidates: ProviderKey[], networkClass: EnvironmentProfile["networkClass"]): ProviderDefinition {
  for (const key of candidates) {
    const p = getProvider(key);
    if (p.status === "active" && p.environments.includes(networkClass)) {
      return p;
    }
  }
  throw new Error(
    `No active provider among [${candidates.join(", ")}] for network class "${networkClass}"`,
  );
}

export function resolveProvider(key: ChainKey, role: ProviderRole): ProviderDefinition {
  const chain = getChain(key);
  const networkClass = getActiveProfile().networkClass;
  switch (role) {
    case "wallet":
      return pickProvider([chain.providers.wallet], networkClass);
    case "account":
      return pickProvider([chain.providers.account], networkClass);
    case "execution":
      return pickProvider(chain.providers.execution, networkClass);
    case "portfolio":
      return pickProvider(chain.providers.portfolio, networkClass);
  }
}

export function validateRegistry(): void {
  // chainMap + providerDefinitions + environmentProfiles self-validate on import.
  // Re-assert isolation for every profile so a bad config fails loudly at boot.
  for (const profile of Object.values(environmentProfiles)) {
    assertProfileIsolation(profile);
  }
}
