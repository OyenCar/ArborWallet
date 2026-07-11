import { getDb } from "../client";
import { BaseRepository } from "../base-repository";
import type { TransferIntentDoc } from "../entities";

export class TransferIntentsRepository extends BaseRepository<TransferIntentDoc> {
  protected collectionName = "transfer_intents";
  protected majorityWriteConcern = true;

  async findByIdempotencyKey(key: string): Promise<TransferIntentDoc | null> {
    return this.findOne({ idempotencyKey: key });
  }

  async findRecentForUser(userId: string, limit: number): Promise<TransferIntentDoc[]> {
    const db = await getDb();
    const col = db.collection<TransferIntentDoc>(this.collectionName);
    return col
      .find({ userId, environment: this.environment })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
}
