import { getDb } from "../client";
import type { RegistryOverrideDoc } from "../entities";

// Environment-agnostic (ops config applies across environments) — does not
// extend BaseRepository, unlike every other repository in this plan.
export class RegistryOverridesRepository {
  private readonly collectionName = "registry_overrides";

  private async collection() {
    const db = await getDb();
    return db.collection<RegistryOverrideDoc>(this.collectionName);
  }

  async insertOne(doc: RegistryOverrideDoc): Promise<void> {
    const col = await this.collection();
    await col.insertOne(doc);
  }

  async findActiveByScope(scope: "chain" | "provider", key: string): Promise<RegistryOverrideDoc[]> {
    const col = await this.collection();
    const now = new Date().toISOString();
    return col
      .find({
        scope,
        key,
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
      })
      .toArray();
  }
}
