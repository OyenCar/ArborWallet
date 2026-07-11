import { getDb } from "../client";
import { BaseRepository } from "../base-repository";
import type { PortfolioCacheDoc } from "../entities";
import type { ChainKey } from "../../config/schema";

export class PortfolioCacheRepository extends BaseRepository<PortfolioCacheDoc> {
  protected collectionName = "portfolio_cache";

  async findByWalletAndChain(walletId: string, chainKey: ChainKey): Promise<PortfolioCacheDoc | null> {
    return this.findOne({ walletId, chainKey });
  }

  async upsertForWalletAndChain(
    walletId: string,
    chainKey: ChainKey,
    doc: Omit<PortfolioCacheDoc, "_id" | "walletId" | "chainKey" | "environment">,
  ): Promise<void> {
    const db = await getDb();
    const col = db.collection<PortfolioCacheDoc>(this.collectionName);
    await col.updateOne(
      { walletId, chainKey, environment: this.environment },
      { $set: { ...doc, walletId, chainKey, environment: this.environment } },
      { upsert: true },
    );
  }
}
