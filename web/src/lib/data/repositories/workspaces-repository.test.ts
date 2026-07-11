import { describe, it, expect } from "vitest";
import { WorkspacesRepository } from "./workspaces-repository";
import { WorkspaceMembershipsRepository } from "./workspace-memberships-repository";

describe("WorkspacesRepository + WorkspaceMembershipsRepository", () => {
  it("creates a workspace and finds its members", async () => {
    const workspaces = new WorkspacesRepository();
    const memberships = new WorkspaceMembershipsRepository();

    const ws = await workspaces.insertOne({ name: "Acme Corp", ownerUserId: "owner-1", createdAt: new Date().toISOString() });
    await memberships.insertOne({ workspaceId: String(ws._id), userId: "owner-1", role: "owner", createdAt: new Date().toISOString() });
    await memberships.insertOne({ workspaceId: String(ws._id), userId: "user-2", role: "member", createdAt: new Date().toISOString() });

    const found = await memberships.findByWorkspace(String(ws._id));
    expect(found).toHaveLength(2);
  });
});
