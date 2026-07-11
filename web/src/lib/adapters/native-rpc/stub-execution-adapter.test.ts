import { describe, it, expect } from "vitest";
import { StubExecutionAdapter } from "./stub-execution-adapter";
import { NotImplementedError } from "../eoa/stub-account-adapter";
import type { ExecutionIntent } from "../../ports/execution-port";
import type { SignerHandle } from "../../ports/account-port";

const intent: ExecutionIntent = {
  kind: "transfer",
  sourceChain: { key: "arbitrum-sepolia", family: "evm" },
  amountRaw: "1000000000000000000",
  recipient: "0xRECIPIENT",
};
const signer: SignerHandle = { address: "0xABC", mode: "eoa" };

describe("StubExecutionAdapter", () => {
  it("quote throws NotImplementedError", async () => {
    const adapter = new StubExecutionAdapter();
    await expect(adapter.quote(intent)).rejects.toThrow(NotImplementedError);
  });

  it("submit throws NotImplementedError", async () => {
    const adapter = new StubExecutionAdapter();
    await expect(adapter.submit(intent, signer)).rejects.toThrow(NotImplementedError);
  });

  it("trackStatus throws NotImplementedError", async () => {
    const adapter = new StubExecutionAdapter();
    await expect(adapter.trackStatus({ providerRef: "0xhash", chain: intent.sourceChain })).rejects.toThrow(NotImplementedError);
  });
});
