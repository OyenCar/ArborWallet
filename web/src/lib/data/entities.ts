import type { ObjectId } from "mongodb";
import type { ChainFamily, ChainKey, NetworkClass, ProviderKey } from "../config/schema";

export interface UserDoc {
  _id?: ObjectId;
  firebaseUid: string;
  username: string;
  email: string;
  preferences: {
    defaultChain: { test: ChainKey; main: ChainKey };
    displayCurrency: string;
  };
  status: "active" | "suspended" | "deleted";
  createdAt: string;
  updatedAt: string;
  environment?: NetworkClass;
}

export interface WalletDelegation {
  chainKey: ChainKey;
  delegated: boolean;
  implementation: string;
  txRef: string;
  at: string;
}

export interface WalletDoc {
  _id?: ObjectId;
  userId: string;
  family: ChainFamily;
  address: string;
  provider: ProviderKey;
  providerRef: string;
  walletType: "eoa" | "smart";
  delegations: WalletDelegation[];
  status: "declared" | "active" | "archived";
  createdAt: string;
  syncedAt?: string;
  environment?: NetworkClass;
}

export interface VaultDoc {
  _id?: ObjectId;
  label: string;
  contractAddress: string;
  chainKey: ChainKey;
  ownerUserId: string;
  workspaceId?: string;
  createdAt: string;
  environment?: NetworkClass;
}

export interface VaultMembershipDoc {
  _id?: ObjectId;
  vaultId: string;
  userId: string;
  partitionOnChainId: number;
  role: "member" | "owner";
  limits: { limitWei: string; spentWeiCached: string; cachedAt: string };
  onChain: { projectedAddress: string; syncState: "pending" | "synced" | "drift"; lastTxRef?: string };
  status: "active" | "revoked";
  createdAt: string;
  environment?: NetworkClass;
}

export interface WorkspaceDoc {
  _id?: ObjectId;
  name: string;
  ownerUserId: string;
  createdAt: string;
  environment?: NetworkClass;
}

export interface WorkspaceMembershipDoc {
  _id?: ObjectId;
  workspaceId: string;
  userId: string;
  role: string;
  createdAt: string;
  environment?: NetworkClass;
}

export interface ContactDoc {
  _id?: ObjectId;
  userId: string;
  alias: string;
  target: { kind: "username" | "address"; value: string; family?: ChainFamily };
  createdAt: string;
  environment?: NetworkClass;
}

export interface NormalizedAssetEntry {
  assetKey: string;
  chainKey: ChainKey;
  kind: "native" | "erc20" | "spl" | "utxo" | "nft";
  symbol: string;
  name: string;
  decimals: number;
  raw: string;
  display: string;
  usdValue?: number;
  priceStale: boolean;
}

export interface PortfolioCacheDoc {
  _id?: ObjectId;
  walletId: string;
  userId: string;
  chainKey: ChainKey;
  assets: NormalizedAssetEntry[];
  syncedAt: string;
  syncStatus: "fresh" | "refreshing" | "stale" | "error";
  source: "indexer" | "rpc";
  environment?: NetworkClass;
}

export interface TransferIntentDoc {
  _id?: ObjectId;
  userId: string;
  idempotencyKey: string;
  kind: "transfer" | "vault_deposit" | "aggregation";
  recipient: {
    kind: "username" | "address" | "vault";
    value: string;
    resolvedUserId?: string;
    resolvedAddress: string;
    chainKey: ChainKey;
  };
  asset: { assetKey: string; amountRaw: string };
  sourceChainKey: ChainKey;
  quote: { fees: string; eta: number; legPlan: string[] };
  status: "draft" | "quoted" | "approved" | "executing" | "settled" | "partially_settled" | "failed";
  createdAt: string;
  updatedAt: string;
  environment?: NetworkClass;
}

export interface TransferLegDoc {
  _id?: ObjectId;
  intentId: string;
  seq: number;
  kind: "same_chain" | "bridge" | "vault_deposit" | "collect";
  fromChainKey: ChainKey;
  toChainKey: ChainKey;
  provider: ProviderKey;
  status: "pending" | "submitted" | "confirmed" | "failed";
  txRef?: string;
  attempts: number;
  deadlineAt: string;
  error?: string;
  updatedAt: string;
  environment?: NetworkClass;
}

export interface PaymasterQuotaDoc {
  _id?: ObjectId;
  userId: string;
  windowStart: string;
  sponsoredOps: number;
  gasSpendWei: string;
  tier: "none" | "capped" | "full";
  environment?: NetworkClass;
}

export interface RegistryOverrideDoc {
  _id?: ObjectId;
  scope: "chain" | "provider";
  key: string;
  patch: Record<string, unknown>;
  reason: string;
  actor: string;
  createdAt: string;
  expiresAt?: string;
}

export interface ProviderRuntimeDoc {
  _id?: ObjectId;
  providerKey: ProviderKey;
  status: "active" | "degraded" | "disabled";
  lastCheckAt: string;
  notes?: string;
}

export interface ActivityDoc {
  _id?: ObjectId;
  userId?: string;
  kind: string;
  refs: { intentId?: string; membershipId?: string; txRef?: string };
  summary: string;
  at: string;
  environment?: NetworkClass;
}
