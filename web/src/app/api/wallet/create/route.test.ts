import { describe, it, expect, vi, beforeEach } from "vitest";
import { MagicApiError } from "../../../../lib/adapters/magic/magic-wallet-adapter";

vi.mock("../../../../lib/adapters/magic/magic-wallet-adapter", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/adapters/magic/magic-wallet-adapter")>(
    "../../../../lib/adapters/magic/magic-wallet-adapter",
  );
  return {
    ...actual,
    MagicWalletAdapter: vi.fn(),
  };
});

describe("POST /api/wallet/create", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, MAGIC_SECRET_KEY: "sk_test", OIDC_PROVIDER_ID: "oidc_test" };
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/wallet/create", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 500 when env is misconfigured", async () => {
    process.env.MAGIC_SECRET_KEY = "";
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/wallet/create", {
      method: "POST",
      headers: { Authorization: "Bearer sometoken" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("returns public_address and wallet_type on success", async () => {
    const { MagicWalletAdapter } = await import("../../../../lib/adapters/magic/magic-wallet-adapter");
    vi.mocked(MagicWalletAdapter).mockImplementation(
      () =>
        ({
          provision: vi.fn().mockResolvedValue({ address: "0xMOCK", family: "evm", provider: "magic", providerRef: "0xMOCK" }),
        }) as never,
    );
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/wallet/create", {
      method: "POST",
      headers: { Authorization: "Bearer sometoken" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.public_address).toBe("0xMOCK");
    expect(body.wallet_type).toBe("eoa");
  });

  it("passes through the TEE's original status code on MagicApiError (preserves prior route contract)", async () => {
    const { MagicWalletAdapter } = await import("../../../../lib/adapters/magic/magic-wallet-adapter");
    vi.mocked(MagicWalletAdapter).mockImplementation(
      () =>
        ({
          provision: vi.fn().mockRejectedValue(new MagicApiError("Wallet creation failed (429): rate limited", 429, "rate limited")),
        }) as never,
    );
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/wallet/create", {
      method: "POST",
      headers: { Authorization: "Bearer sometoken" },
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });
});
