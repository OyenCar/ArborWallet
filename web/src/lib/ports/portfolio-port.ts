import type { Address, ChainRef, WalletRecord } from "./types";

export interface RawBalance {
  raw: string;
  chainKey: string;
}

export interface RawAsset {
  kind: "native" | "erc20" | "spl" | "utxo";
  raw: string;
  contractAddress?: string;
}

export interface RawAssetPage {
  items: RawAsset[];
  source: "rpc" | "indexer";
}

export interface PortfolioPort {
  fetchAssets(wallet: WalletRecord, chain: ChainRef): Promise<RawAssetPage>;
  fetchNativeBalance(address: Address, chain: ChainRef): Promise<RawBalance>;
}
