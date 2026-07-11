import { describe, it, expect } from "vitest";
import type { WalletPort } from "./wallet-port";
import type { IdentityAttestation, WalletRecord } from "./types";

class InMemoryWalletPort implements WalletPort {
  private wallets = new Map<string, WalletRecord>();

  private key(identity: IdentityAttestation, family: string): string {
    return `${identity.uid}:${family}`;
  }

  async provision(identity: IdentityAttestation, family: WalletRecord["family"]): Promise<WalletRecord> {
    const key = this.key(identity, family);
    const existing = this.wallets.get(key);
    if (existing) return existing;
    const record: WalletRecord = {
      address: `0xFAKE${key}`,
      family,
      provider: "magic",
      providerRef: key,
    };
    this.wallets.set(key, record);
    return record;
  }

  async getAddress(identity: IdentityAttestation, family: WalletRecord["family"]) {
    return this.wallets.get(this.key(identity, family))?.address ?? null;
  }

  async sign(identity: IdentityAttestation, family: WalletRecord["family"], payload: { data: string }) {
    if (!this.wallets.has(this.key(identity, family))) {
      throw new Error("no wallet provisioned for this identity/family");
    }
    return `sig:${payload.data}`;
  }

  async healthcheck() {
    return { provider: "magic" as const, status: "healthy" as const, checkedAt: new Date().toISOString() };
  }
}

const identity: IdentityAttestation = { uid: "user-1", email: "user@example.com", idToken: "token-abc" };

describe("WalletPort contract (via in-memory fake)", () => {
  it("provision is idempotent for the same identity+family", async () => {
    const port = new InMemoryWalletPort();
    const first = await port.provision(identity, "evm");
    const second = await port.provision(identity, "evm");
    expect(second).toEqual(first);
  });

  it("provisions independent wallets per family", async () => {
    const port = new InMemoryWalletPort();
    const evm = await port.provision(identity, "evm");
    const solana = await port.provision(identity, "solana");
    expect(evm.address).not.toBe(solana.address);
  });

  it("getAddress returns null before provisioning", async () => {
    const port = new InMemoryWalletPort();
    expect(await port.getAddress(identity, "bitcoin")).toBeNull();
  });

  it("sign throws for an unprovisioned family", async () => {
    const port = new InMemoryWalletPort();
    await expect(port.sign(identity, "solana", { data: "hello" })).rejects.toThrow(/no wallet provisioned/);
  });

  it("sign succeeds after provisioning", async () => {
    const port = new InMemoryWalletPort();
    await port.provision(identity, "evm");
    const sig = await port.sign(identity, "evm", { data: "hello" });
    expect(sig).toBe("sig:hello");
  });

  it("healthcheck reports a provider and status", async () => {
    const port = new InMemoryWalletPort();
    const health = await port.healthcheck();
    expect(health.provider).toBe("magic");
    expect(health.status).toBe("healthy");
  });
});
