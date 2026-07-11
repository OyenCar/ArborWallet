import type { Address, IdentityAttestation, ProviderHealth, Signature, SignPayload, WalletRecord } from "./types";
import type { ChainFamily } from "../config/schema";

export interface WalletPort {
  provision(identity: IdentityAttestation, family: ChainFamily): Promise<WalletRecord>;
  getAddress(identity: IdentityAttestation, family: ChainFamily): Promise<Address | null>;
  sign(identity: IdentityAttestation, family: ChainFamily, payload: SignPayload): Promise<Signature>;
  healthcheck(): Promise<ProviderHealth>;
}
