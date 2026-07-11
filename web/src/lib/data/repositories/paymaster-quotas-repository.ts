import { BaseRepository } from "../base-repository";
import type { PaymasterQuotaDoc } from "../entities";

export class PaymasterQuotasRepository extends BaseRepository<PaymasterQuotaDoc> {
  protected collectionName = "paymaster_quotas";

  async findByUserAndWindow(userId: string, windowStart: string): Promise<PaymasterQuotaDoc | null> {
    return this.findOne({ userId, windowStart });
  }
}
