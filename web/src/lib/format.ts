const WEI = 10n ** 18n;

export function weiToEth(wei: string): number {
  const w = BigInt(wei);
  return Number((w * 10000n) / WEI) / 10000;
}

export function ethToWei(eth: number): string {
  return (BigInt(Math.round(eth * 1e6)) * (WEI / 10n ** 6n)).toString();
}

export function formatEth(wei: string): string {
  return `${weiToEth(wei).toLocaleString("en-US", { maximumFractionDigits: 4 })} ETH`;
}

export function formatFiat(wei: string, ethUsd: number): string {
  const usd = weiToEth(wei) * ethUsd;
  return usd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function getArbitrumSepoliaBalance(address: string): Promise<string> {
  try {
    const res = await fetch("https://sepolia-rollup.arbitrum.io/rpc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: 1,
      }),
    });
    if (!res.ok) return "0";
    const data = await res.json();
    if (data.result) {
      const bigIntValue = BigInt(data.result);
      return bigIntValue.toString();
    }
  } catch (err) {
    console.error("Failed to fetch balance from RPC:", err);
  }
  return "0";
}
