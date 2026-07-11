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

describe("GET /api/wallet/address", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, MAGIC_SECRET_KEY: "sk_test", OIDC_PROVIDER_ID: "oidc_test" };
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/wallet/address", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns the resolved address on success", async () => {
    const { MagicWalletAdapter } = await import("../../../../lib/adapters/magic/magic-wallet-adapter");
    vi.mocked(MagicWalletAdapter).mockImplementation(
      () =>
        ({
          getAddress: vi.fn().mockResolvedValue("0xMOCK"),
        }) as never,
    );
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/wallet/address", {
      method: "GET",
      headers: { Authorization: "Bearer sometoken" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.public_address).toBe("0xMOCK");
  });

  it("passes through the TEE's original status code on MagicApiError (preserves prior route contract)", async () => {
    const { MagicWalletAdapter } = await import("../../../../lib/adapters/magic/magic-wallet-adapter");
    vi.mocked(MagicWalletAdapter).mockImplementation(
      () =>
        ({
          getAddress: vi.fn().mockRejectedValue(new MagicApiError("Wallet lookup failed (503): down", 503, "down")),
        }) as never,
    );
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/wallet/address", {
      method: "GET",
      headers: { Authorization: "Bearer sometoken" },
    });
    const res = await GET(req);
    expect(res.status).toBe(503);
  });
});
