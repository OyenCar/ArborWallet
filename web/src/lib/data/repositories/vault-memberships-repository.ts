import { BaseRepository } from "../base-repository";
import type { VaultMembershipDoc } from "../entities";

export class VaultMembershipsRepository extends BaseRepository<VaultMembershipDoc> {
  protected collectionName = "vault_memberships";
  protected majorityWriteConcern = true;

  async findByVaultAndUser(vaultId: string, userId: string): Promise<VaultMembershipDoc | null> {
    return this.findOne({ vaultId, userId });
  }

  async findActiveByVault(vaultId: string): Promise<VaultMembershipDoc[]> {
    return this.find({ vaultId, status: "active" });
  }

  async findByDriftState(): Promise<VaultMembershipDoc[]> {
    return this.find({ "onChain.syncState": "drift" } as unknown as Partial<VaultMembershipDoc>);
  }
}
