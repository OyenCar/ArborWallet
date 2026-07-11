import { BaseRepository } from "../base-repository";
import type { WalletDoc } from "../entities";
import type { ChainFamily } from "../../config/schema";

export class WalletsRepository extends BaseRepository<WalletDoc> {
  protected collectionName = "wallets";
  protected majorityWriteConcern = true;

  async findByUserAndFamily(userId: string, family: ChainFamily): Promise<WalletDoc | null> {
    return this.findOne({ userId, family });
  }

  async findAllForUser(userId: string): Promise<WalletDoc[]> {
    return this.find({ userId });
  }
}
