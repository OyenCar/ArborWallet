import { describe, it, expect } from "vitest";
import { TransferLegsRepository } from "./transfer-legs-repository";

const baseLeg = {
  intentId: "intent-1",
  kind: "same_chain" as const,
  fromChainKey: "arbitrum-sepolia" as const,
  toChainKey: "arbitrum-sepolia" as const,
  provider: "evm-rpc" as const,
  status: "pending" as const,
  attempts: 0,
  deadlineAt: new Date(Date.now() + 60_000).toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("TransferLegsRepository", () => {
  it("findByIntent returns legs sorted by seq", async () => {
    const repo = new TransferLegsRepository();
    await repo.insertOne({ ...baseLeg, seq: 2 });
    await repo.insertOne({ ...baseLeg, seq: 1 });

    const legs = await repo.findByIntent("intent-1");
    expect(legs.map((l) => l.seq)).toEqual([1, 2]);
  });

  it("findDueForJanitorScan finds submitted legs past their deadline", async () => {
    const repo = new TransferLegsRepository();
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 1000_000).toISOString();

    await repo.insertOne({ ...baseLeg, seq: 1, status: "submitted", deadlineAt: past });
    await repo.insertOne({ ...baseLeg, seq: 2, status: "submitted", deadlineAt: future });
    await repo.insertOne({ ...baseLeg, seq: 3, status: "confirmed", deadlineAt: past });

    const due = await repo.findDueForJanitorScan(new Date().toISOString());
    expect(due).toHaveLength(1);
    expect(due[0].seq).toBe(1);
  });
});
