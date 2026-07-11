import { describe, it, expect } from "vitest";
import { StubAccountAdapter, NotImplementedError } from "./stub-account-adapter";
import type { WalletRecord, ChainRef } from "../../ports/types";

const wallet: WalletRecord = { address: "0xABC", family: "evm", provider: "magic", providerRef: "0xABC" };
const chain: ChainRef = { key: "arbitrum-sepolia", family: "evm" };

describe("StubAccountAdapter", () => {
  it("getSigner throws NotImplementedError", async () => {
    const adapter = new StubAccountAdapter();
    await expect(adapter.getSigner(wallet, chain)).rejects.toThrow(NotImplementedError);
  });

  it("upgrade throws NotImplementedError", async () => {
    const adapter = new StubAccountAdapter();
    await expect(adapter.upgrade(wallet, chain)).rejects.toThrow(NotImplementedError);
  });

  it("downgrade throws NotImplementedError", async () => {
    const adapter = new StubAccountAdapter();
    await expect(adapter.downgrade(wallet, chain)).rejects.toThrow(NotImplementedError);
  });

  it("status defaults to eoa without throwing (safe default for unimplemented chains)", async () => {
    const adapter = new StubAccountAdapter();
    expect(await adapter.status(wallet, chain)).toBe("eoa");
  });
});
