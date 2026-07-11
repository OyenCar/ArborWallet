import { BaseRepository } from "../base-repository";
import type { WorkspaceDoc } from "../entities";

export class WorkspacesRepository extends BaseRepository<WorkspaceDoc> {
  protected collectionName = "workspaces";
}
