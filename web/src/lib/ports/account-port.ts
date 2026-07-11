import type { WalletRecord, ChainRef } from "./types";

export type AccountMode = "eoa" | "smart-7702";

export interface UpgradeResult {
  mode: AccountMode;
  txRef?: string;
}

export interface SignerHandle {
  address: string;
  mode: AccountMode;
}

export interface AccountPort {
  getSigner(wallet: WalletRecord, chain: ChainRef): Promise<SignerHandle>;
  upgrade(wallet: WalletRecord, chain: ChainRef): Promise<UpgradeResult>;
  downgrade(wallet: WalletRecord, chain: ChainRef): Promise<void>;
  status(wallet: WalletRecord, chain: ChainRef): Promise<AccountMode>;
}
