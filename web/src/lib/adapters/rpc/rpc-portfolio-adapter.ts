import type { PortfolioPort, RawAssetPage, RawBalance } from "../../ports/portfolio-port";
import type { Address, ChainRef, WalletRecord } from "../../ports/types";
import { getChain } from "../../config/registry";

interface RpcPortfolioAdapterConfig {
  fetchImpl?: typeof fetch;
}

export class RpcPortfolioAdapter implements PortfolioPort {
  private readonly fetchImpl: typeof fetch;

  constructor(config: RpcPortfolioAdapterConfig = {}) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async fetchNativeBalance(address: Address, chain: ChainRef): Promise<RawBalance> {
    if (chain.family !== "evm") {
      return { raw: "0", chainKey: chain.key };
    }

    try {
      const definition = getChain(chain.key);
      const rpcUrl = definition.rpc[0].url;
      const res = await this.fetchImpl(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBalance",
          params: [address, "latest"],
          id: 1,
        }),
      });

      if (!res.ok) return { raw: "0", chainKey: chain.key };

      const data = await res.json();
      if (!data.result) return { raw: "0", chainKey: chain.key };

      return { raw: BigInt(data.result).toString(), chainKey: chain.key };
    } catch {
      return { raw: "0", chainKey: chain.key };
    }
  }

  async fetchAssets(wallet: WalletRecord, chain: ChainRef): Promise<RawAssetPage> {
    const native = await this.fetchNativeBalance(wallet.address, chain);
    return {
      items: [{ kind: "native", raw: native.raw }],
      source: "rpc",
    };
  }
}
