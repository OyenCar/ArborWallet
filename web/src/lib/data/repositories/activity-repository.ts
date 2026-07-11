import { getDb } from "../client";
import { BaseRepository } from "../base-repository";
import type { ActivityDoc } from "../entities";

export class ActivityRepository extends BaseRepository<ActivityDoc> {
  protected collectionName = "activity";

  async recordForUser(
    userId: string,
    kind: string,
    refs: ActivityDoc["refs"],
    summary: string,
  ): Promise<void> {
    await this.insertOne({ userId, kind, refs, summary, at: new Date().toISOString() });
  }

  async findRecentForUser(userId: string, limit: number): Promise<ActivityDoc[]> {
    const db = await getDb();
    const col = db.collection<ActivityDoc>(this.collectionName);
    return col
      .find({ userId, environment: this.environment })
      .sort({ at: -1 })
      .limit(limit)
      .toArray();
  }
}
