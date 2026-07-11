import { getDb } from "../client";
import type { ProviderRuntimeDoc } from "../entities";
import type { ProviderKey } from "../../config/schema";

// Environment-agnostic (provider health is a global ops signal) — does not
// extend BaseRepository, unlike every other repository in this plan.
export class ProviderRuntimeRepository {
  private readonly collectionName = "provider_runtime";

  private async collection() {
    const db = await getDb();
    return db.collection<ProviderRuntimeDoc>(this.collectionName);
  }

  async findByProviderKey(key: ProviderKey): Promise<ProviderRuntimeDoc | null> {
    const col = await this.collection();
    return col.findOne({ providerKey: key });
  }

  async upsertStatus(key: ProviderKey, status: ProviderRuntimeDoc["status"], notes?: string): Promise<void> {
    const col = await this.collection();
    await col.updateOne(
      { providerKey: key },
      { $set: { providerKey: key, status, notes, lastCheckAt: new Date().toISOString() } },
      { upsert: true },
    );
  }
}
