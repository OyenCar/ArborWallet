import { BaseRepository } from "../base-repository";
import type { WorkspaceMembershipDoc } from "../entities";

export class WorkspaceMembershipsRepository extends BaseRepository<WorkspaceMembershipDoc> {
  protected collectionName = "workspace_memberships";

  async findByWorkspace(workspaceId: string): Promise<WorkspaceMembershipDoc[]> {
    return this.find({ workspaceId });
  }
}
