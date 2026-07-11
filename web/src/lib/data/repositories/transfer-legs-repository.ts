import { getDb } from "../client";
import { BaseRepository } from "../base-repository";
import type { TransferLegDoc } from "../entities";

export class TransferLegsRepository extends BaseRepository<TransferLegDoc> {
  protected collectionName = "transfer_legs";
  protected majorityWriteConcern = true;

  async findByIntent(intentId: string): Promise<TransferLegDoc[]> {
    const db = await getDb();
    const col = db.collection<TransferLegDoc>(this.collectionName);
    return col
      .find({ intentId, environment: this.environment })
      .sort({ seq: 1 })
      .toArray();
  }

  async findDueForJanitorScan(beforeDeadline: string): Promise<TransferLegDoc[]> {
    const db = await getDb();
    const col = db.collection<TransferLegDoc>(this.collectionName);
    return col
      .find({
        status: "submitted",
        deadlineAt: { $lt: beforeDeadline },
        environment: this.environment,
      })
      .toArray();
  }
}
