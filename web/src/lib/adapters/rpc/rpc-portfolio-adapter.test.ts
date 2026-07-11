import { describe, it, expect, vi } from "vitest";
import { RpcPortfolioAdapter } from "./rpc-portfolio-adapter";
import type { WalletRecord, ChainRef } from "../../ports/types";

const evmWallet: WalletRecord = { address: "0xABC", family: "evm", provider: "magic", providerRef: "0xABC" };
const evmChain: ChainRef = { key: "arbitrum-sepolia", family: "evm" };
const solanaWallet: WalletRecord = { address: "SoLAddr", family: "solana", provider: "magic", providerRef: "SoLAddr" };
const solanaChain: ChainRef = { key: "solana-devnet", family: "solana" };

describe("RpcPortfolioAdapter.fetchNativeBalance", () => {
  it("reads the balance from the chain's registry RPC endpoint for evm chains", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: "0xde0b6b3a7640000" }), // 1 ETH in wei, hex
    });
    const adapter = new RpcPortfolioAdapter({ fetchImpl: fetchMock });

    const balance = await adapter.fetchNativeBalance(evmWallet.address, evmChain);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://sepolia-rollup.arbitrum.io/rpc",
      expect.objectContaining({ method: "POST" }),
    );
    expect(balance).toEqual({ raw: "1000000000000000000", chainKey: "arbitrum-sepolia" });
  });

  it("returns a zero balance for non-evm families (not yet supported by this adapter)", async () => {
    const fetchMock = vi.fn();
    const adapter = new RpcPortfolioAdapter({ fetchImpl: fetchMock });
    const balance = await adapter.fetchNativeBalance(solanaWallet.address, solanaChain);
    expect(balance).toEqual({ raw: "0", chainKey: "solana-devnet" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a zero balance when the RPC call fails rather than throwing", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    const adapter = new RpcPortfolioAdapter({ fetchImpl: fetchMock });
    const balance = await adapter.fetchNativeBalance(evmWallet.address, evmChain);
    expect(balance).toEqual({ raw: "0", chainKey: "arbitrum-sepolia" });
  });
});

describe("RpcPortfolioAdapter.fetchAssets", () => {
  it("returns a page containing only the native balance (no token discovery yet)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: "0x0" }),
    });
    const adapter = new RpcPortfolioAdapter({ fetchImpl: fetchMock });
    const page = await adapter.fetchAssets(evmWallet, evmChain);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].kind).toBe("native");
    expect(page.source).toBe("rpc");
  });
});
