import type { ChainFamily, ProviderKey } from "../config/schema";

export type Address = string;
export type Signature = string;

export interface SignPayload {
  data: string;
}

export interface IdentityAttestation {
  uid: string;
  email: string | null;
  idToken: string;
}

export interface WalletRecord {
  address: Address;
  family: ChainFamily;
  provider: ProviderKey;
  providerRef: string;
}

export interface ProviderHealth {
  provider: ProviderKey;
  status: "healthy" | "degraded" | "down";
  checkedAt: string;
  detail?: string;
}

export interface ChainRef {
  key: string;
  family: ChainFamily;
}
