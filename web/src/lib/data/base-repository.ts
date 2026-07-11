import type { Filter, OptionalUnlessRequiredId, UpdateFilter } from "mongodb";
import { getDb } from "./client";
import { getActiveProfile } from "../config/registry";

export abstract class BaseRepository<T extends { environment?: string }> {
  protected abstract collectionName: string;

  // Captured at construction, not resolved per-call: a repository instance
  // stays bound to the environment active when it was created, even if
  // process.env.APP_ENV_PROFILE changes later in the process lifetime.
  protected readonly environment = getActiveProfile().networkClass;

  private async collection() {
    const db = await getDb();
    return db.collection<T>(this.collectionName);
  }

  private scopedFilter(filter: Partial<T>): Filter<T> {
    return { ...filter, environment: this.environment } as Filter<T>;
  }

  async insertOne(doc: Omit<T, "environment">): Promise<T & { _id: unknown }> {
    const col = await this.collection();
    const scoped = { ...doc, environment: this.environment } as OptionalUnlessRequiredId<T>;
    const result = await col.insertOne(scoped);
    return { ...(scoped as T), _id: result.insertedId };
  }

  async findOne(filter: Partial<T>): Promise<T | null> {
    const col = await this.collection();
    return col.findOne(this.scopedFilter(filter)) as Promise<T | null>;
  }

  async find(filter: Partial<T>): Promise<T[]> {
    const col = await this.collection();
    return col.find(this.scopedFilter(filter)).toArray() as Promise<T[]>;
  }

  async updateOne(filter: Partial<T>, update: Partial<T>): Promise<void> {
    const col = await this.collection();
    await col.updateOne(this.scopedFilter(filter), { $set: update } as UpdateFilter<T>);
  }
}
