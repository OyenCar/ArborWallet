import { BaseRepository } from "../base-repository";
import type { VaultDoc } from "../entities";
import type { ChainKey } from "../../config/schema";

export class VaultsRepository extends BaseRepository<VaultDoc> {
  protected collectionName = "vaults";
  protected majorityWriteConcern = true;

  async findByChainKey(chainKey: ChainKey): Promise<VaultDoc[]> {
    return this.find({ chainKey });
  }
}
