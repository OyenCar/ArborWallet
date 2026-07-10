import { ProviderDefinition, ProviderKey, ProviderRole, providerDefinitionSchema } from "./schema";

const raw: ProviderDefinition[] = [
  {
    key: "magic",
    role: "wallet",
    families: ["evm", "solana", "bitcoin"],
    environments: ["main", "test", "local"],
    adapter: "MagicWalletAdapter",
    config: { secretKey: "MAGIC_SECRET_KEY", oidcProviderId: "OIDC_PROVIDER_ID" },
    status: "active",
  },
  {
    key: "zerodev",
    role: "account",
    families: ["evm"],
    environments: ["main", "test"],
    adapter: "ZeroDev7702Adapter",
    config: { projectId: "ZERODEV_PROJECT_ID" },
    status: "active",
  },
  {
    key: "eoa",
    role: "account",
    families: ["evm", "solana", "bitcoin"],
    environments: ["main", "test", "local"],
    adapter: "EoaPassthroughAdapter",
    config: {},
    status: "active",
  },
  {
    key: "particle",
    role: "execution",
    families: ["evm"],
    environments: ["main"],
    adapter: "ParticleExecutionAdapter",
    config: { projectId: "PARTICLE_PROJECT_ID" },
    status: "active",
  },
  {
    key: "evm-rpc",
    role: "execution",
    families: ["evm"],
    environments: ["main", "test", "local"],
    adapter: "EvmRpcExecutionAdapter",
    config: {},
    status: "active",
  },
  {
    key: "solana-rpc",
    role: "execution",
    families: ["solana"],
    environments: ["main", "test", "local"],
    adapter: "SolanaExecutionAdapter",
    config: {},
    status: "active",
  },
  {
    key: "bitcoin-rpc",
    role: "execution",
    families: ["bitcoin"],
    environments: ["main", "test", "local"],
    adapter: "BitcoinExecutionAdapter",
    config: {},
    status: "active",
  },
  {
    key: "indexer",
    role: "portfolio",
    families: ["evm", "solana"],
    environments: ["main", "test"],
    adapter: "IndexerPortfolioAdapter",
    config: { apiKey: "INDEXER_API_KEY" },
    status: "active",
  },
  {
    key: "rpc",
    role: "portfolio",
    families: ["evm", "solana", "bitcoin"],
    environments: ["main", "test", "local"],
    adapter: "RpcPortfolioAdapter",
    config: {},
    status: "active",
  },
];

export const providerDefinitions: ProviderDefinition[] = raw.map((p, i) => {
  const parsed = providerDefinitionSchema.safeParse(p);
  if (!parsed.success) {
    throw new Error(`Invalid ProviderDefinition at index ${i} (${p.key}): ${parsed.error.message}`);
  }
  return parsed.data;
});

const byKey = new Map<ProviderKey, ProviderDefinition>(providerDefinitions.map((p) => [p.key, p]));

export function getProvider(key: ProviderKey): ProviderDefinition {
  const p = byKey.get(key);
  if (!p) throw new Error(`Unknown provider key: ${key}`);
  return p;
}

export function getProvidersByRole(role: ProviderRole): ProviderDefinition[] {
  return providerDefinitions.filter((p) => p.role === role);
}
