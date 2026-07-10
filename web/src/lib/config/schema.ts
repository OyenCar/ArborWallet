import { z } from "zod";

export const chainFamilySchema = z.enum(["evm", "solana", "bitcoin"]);
export const networkClassSchema = z.enum(["main", "test", "local"]);

export const chainCapabilitySchema = z.object({
  smartWallet: z.boolean(),
  accountAbstraction: z.boolean(),
  paymaster: z.boolean(),
  vault: z.boolean(),
  portfolio: z.boolean(),
  bridge: z.boolean(),
  swap: z.boolean(),
  nft: z.boolean(),
  gasSponsorship: z.boolean(),
});

export const tokenDefinitionSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  decimals: z.number().int().nonnegative(),
  address: z.string().optional(), // undefined = native
  kind: z.enum(["native", "erc20", "spl"]),
});

export const rpcEndpointSchema = z.object({
  url: z.string().url(),
  weight: z.number().int().positive(),
});

export const providerKeySchema = z.enum([
  "magic", "privy", "dynamic",
  "zerodev", "eoa",
  "particle", "evm-rpc", "solana-rpc", "bitcoin-rpc",
  "indexer", "rpc",
]);

export const providerRoleSchema = z.enum(["wallet", "account", "execution", "portfolio"]);

export const chainProvidersSchema = z.object({
  wallet: providerKeySchema,
  account: providerKeySchema,
  execution: z.array(providerKeySchema).min(1),
  portfolio: z.array(providerKeySchema).min(1),
});

export const chainDefinitionSchema = z
  .object({
    key: z.string().min(1),
    name: z.string().min(1),
    family: chainFamilySchema,
    environment: networkClassSchema,
    caip2: z.string().min(1),
    chainId: z.number().int().positive().optional(),
    rpc: z.array(rpcEndpointSchema).min(1),
    explorer: z.object({
      base: z.string().url(),
      tx: z.string().min(1),
      address: z.string().min(1),
    }),
    nativeCurrency: z.object({
      symbol: z.string().min(1),
      name: z.string().min(1),
      decimals: z.number().int().nonnegative(),
    }),
    tokens: z.array(tokenDefinitionSchema),
    providers: chainProvidersSchema,
    capabilities: chainCapabilitySchema,
    faucet: z.object({ url: z.string().url(), note: z.string().optional() }).optional(),
    featureFlags: z.record(z.string(), z.boolean()),
    defaultWalletEligible: z.boolean(),
    vaultCompatible: z.boolean(),
  })
  .refine((d) => d.family !== "evm" || d.chainId !== undefined, {
    message: "EVM chains must define chainId",
    path: ["chainId"],
  });

export const providerDefinitionSchema = z.object({
  key: providerKeySchema,
  role: providerRoleSchema,
  families: z.array(chainFamilySchema),
  environments: z.array(networkClassSchema),
  adapter: z.string().min(1),
  config: z.record(z.string(), z.string()),
  status: z.enum(["active", "degraded", "disabled"]),
});

export const environmentProfileSchema = z.object({
  name: z.enum(["local", "development", "staging", "testnet", "mainnet"]),
  networkClass: networkClassSchema,
  activeChainKeys: z.array(z.string().min(1)).min(1),
  featureFlags: z.record(z.string(), z.boolean()),
  faucetsEnabled: z.boolean(),
  paymasterTier: z.enum(["none", "capped", "full"]),
  bannerStyle: z.enum(["none", "testnet", "local"]),
});

export type ChainFamily = z.infer<typeof chainFamilySchema>;
export type NetworkClass = z.infer<typeof networkClassSchema>;
export type ChainCapability = z.infer<typeof chainCapabilitySchema>;
export type TokenDefinition = z.infer<typeof tokenDefinitionSchema>;
export type RpcEndpoint = z.infer<typeof rpcEndpointSchema>;
export type ProviderKey = z.infer<typeof providerKeySchema>;
export type ProviderRole = z.infer<typeof providerRoleSchema>;
export type ChainProviders = z.infer<typeof chainProvidersSchema>;
export type ChainDefinition = z.infer<typeof chainDefinitionSchema>;
export type ProviderDefinition = z.infer<typeof providerDefinitionSchema>;
export type EnvironmentProfile = z.infer<typeof environmentProfileSchema>;
export type ChainKey = string;
