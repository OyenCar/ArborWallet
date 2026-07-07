// Typed fetch client for /api routes. Pages currently import mocks directly;
// integration phase swaps those imports for these calls.
import type {
  FundRequest,
  Partition,
  PaymentIntent,
  Tx,
  User,
  WithdrawResult,
} from "./types";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  partitions: () =>
    fetch("/api/partitions").then(
      j<{ vaultTotalWei: string; partitions: Partition[] }>,
    ),

  partition: (id: string) =>
    fetch(`/api/partitions/${id}`).then(j<Partition>),

  transactions: (filters?: {
    partitionId?: string;
    type?: string;
    socialId?: string;
  }) => {
    const qs = new URLSearchParams(
      Object.entries(filters ?? {}).filter(([, v]) => v) as [string, string][],
    );
    return fetch(`/api/transactions?${qs}`).then(
      j<{ transactions: Tx[]; count: number }>,
    );
  },

  fundRequests: (status?: string) =>
    fetch(`/api/fund-requests${status ? `?status=${status}` : ""}`).then(
      j<{ fundRequests: FundRequest[] }>,
    ),

  createFundRequest: (body: {
    partitionId: string;
    socialId: string;
    amountWei: string;
    reason?: string;
  }) =>
    fetch("/api/fund-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(j<FundRequest>),

  reviewFundRequest: (id: string, action: "approve" | "reject") =>
    fetch(`/api/fund-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).then(j<FundRequest & { txHash?: string }>),

  uploadInvoice: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch("/api/invoices", { method: "POST", body: form }).then(
      j<{ cid: string; cidHash: string; fileName: string }>,
    );
  },

  executePay: (body: {
    partitionId: string;
    to: string;
    amountWei: string;
    invoiceCidHash: string;
  }) =>
    fetch("/api/pay/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(j<WithdrawResult & { network: string }>),

  createIntent: (body: {
    partitionId: string;
    amountWei: string;
    invoiceRef?: string;
  }) =>
    fetch("/api/intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(j<PaymentIntent>),

  claimIntent: (body: PaymentIntent & { to: string }) =>
    fetch("/api/intents", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(j<{ claimed: boolean; txHash: string }>),

  price: () =>
    fetch("/api/price").then(j<{ ethUsd: number; source: string }>),

  users: () => fetch("/api/users").then(j<{ users: User[] }>),
};
