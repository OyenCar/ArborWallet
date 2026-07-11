import type { WalletPort } from "../../ports/wallet-port";
import type { Address, IdentityAttestation, ProviderHealth, Signature, SignPayload, WalletRecord } from "../../ports/types";
import type { ChainFamily } from "../../config/schema";

const TEE_ENDPOINT = "https://tee.express.magiclabs.com/v1/wallet";

const FAMILY_TO_MAGIC_CHAIN: Record<ChainFamily, string> = {
  evm: "ETH",
  solana: "SOL",
  bitcoin: "BTC",
};

interface MagicWalletAdapterConfig {
  secretKey: string;
  oidcProviderId: string;
  fetchImpl?: typeof fetch;
}

export class MagicApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(message: string, status: number, detail: string) {
    super(message);
    this.name = "MagicApiError";
    this.status = status;
    this.detail = detail;
  }
}

export class MagicWalletAdapter implements WalletPort {
  private readonly secretKey: string;
  private readonly oidcProviderId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: MagicWalletAdapterConfig) {
    this.secretKey = config.secretKey;
    this.oidcProviderId = config.oidcProviderId;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private headers(identity: IdentityAttestation, family: ChainFamily, extra?: Record<string, string>) {
    return {
      "Authorization": `Bearer ${identity.idToken}`,
      "X-Magic-Secret-Key": this.secretKey,
      "X-OIDC-Provider-ID": this.oidcProviderId,
      "X-Magic-Chain": FAMILY_TO_MAGIC_CHAIN[family],
      ...extra,
    };
  }

  async provision(identity: IdentityAttestation, family: ChainFamily): Promise<WalletRecord> {
    const res = await this.fetchImpl(TEE_ENDPOINT, {
      method: "POST",
      headers: this.headers(identity, family, { "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new MagicApiError(`Wallet creation failed (${res.status}): ${detail}`, res.status, detail);
    }

    const data = await res.json();
    return {
      address: data.public_address,
      family,
      provider: "magic",
      providerRef: data.public_address,
    };
  }

  async getAddress(identity: IdentityAttestation, family: ChainFamily): Promise<Address | null> {
    const res = await this.fetchImpl(TEE_ENDPOINT, {
      method: "GET",
      headers: this.headers(identity, family),
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      const detail = await res.text();
      throw new MagicApiError(`Wallet lookup failed (${res.status}): ${detail}`, res.status, detail);
    }

    const data = await res.json();
    return data.public_address ?? null;
  }

  async sign(identity: IdentityAttestation, family: ChainFamily, payload: SignPayload): Promise<Signature> {
    const res = await this.fetchImpl(TEE_ENDPOINT, {
      method: "POST",
      headers: this.headers(identity, family, { "Content-Type": "application/json" }),
      body: JSON.stringify({ operation: "sign", data: payload.data }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new MagicApiError(`Signing failed (${res.status}): ${detail}`, res.status, detail);
    }

    const data = await res.json();
    return data.signature;
  }

  async healthcheck(): Promise<ProviderHealth> {
    try {
      const res = await this.fetchImpl(TEE_ENDPOINT, {
        method: "GET",
        headers: { "X-Magic-Secret-Key": this.secretKey, "X-OIDC-Provider-ID": this.oidcProviderId, "X-Magic-Chain": "ETH" },
      });
      return {
        provider: "magic",
        status: res.status < 500 ? "healthy" : "degraded",
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        provider: "magic",
        status: "down",
        checkedAt: new Date().toISOString(),
        detail: err instanceof Error ? err.message : "unknown error",
      };
    }
  }
}
