// Fake wallet layer. Same signatures as the real lib/ implementation
// (Magic + ZeroDev) so the swap later is a single import change.
import type {
  PaymentIntent,
  SessionStatus,
  User,
  WalletApi,
  WithdrawParams,
  WithdrawResult,
} from "../types";
import { mockUser } from "./data";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeHex(len = 64): `0x${string}` {
  let s = "";
  for (let i = 0; i < len; i++) s += "0123456789abcdef"[(Math.random() * 16) | 0];
  return `0x${s}` as `0x${string}`;
}

export const mockWallet: WalletApi = {
  async connect(): Promise<User> {
    await delay(800);
    return mockUser;
  },

  async getSessionStatus(): Promise<SessionStatus> {
    await delay(300);
    return {
      active: true,
      scope: "withdraw() @ Vault",
      expiresAt: new Date(Date.now() + 4 * 3600_000).toISOString(),
    };
  },

  async sendWithdraw(_params: WithdrawParams): Promise<WithdrawResult> {
    await delay(1200);
    return { userOpHash: fakeHex(), txHash: fakeHex(), sponsored: true };
  },

  async createPaymentIntent(
    p: Omit<PaymentIntent, "nonce" | "expiresAt">,
  ): Promise<PaymentIntent> {
    await delay(400);
    return {
      ...p,
      nonce: fakeHex(16),
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
    };
  },
};
