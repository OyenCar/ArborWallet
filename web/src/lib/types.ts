// Domain types — frozen early; contract + backend must satisfy these.
// All on-chain amounts are wei encoded as decimal strings (bigint-safe).

export type Role = "owner" | "employee";

export interface User {
  socialId: string; // "@budi"
  address: `0x${string}`;
  role: Role;
}

export interface PartitionMember {
  socialId: string;
  address: `0x${string}`;
  limitWei: string;
  spentWei: string;
}

export interface Partition {
  id: string; // db id
  onChainId: number;
  label: string;
  isBackup: boolean;
  balanceWei: string;
  dueDate: string | null; // ISO; non-null = auto-release (payroll)
  members: PartitionMember[];
}

export type FundRequestStatus = "pending" | "approved" | "rejected";

export interface FundRequest {
  id: string;
  partitionId: string;
  socialId: string;
  amountWei: string;
  reason: string;
  status: FundRequestStatus;
  requestedAt: string;
}

export type TxType = "withdraw" | "deposit" | "release" | "qr_pay";
export type TxStatus = "paid" | "pending" | "rejected";

export interface Tx {
  id: string;
  txHash: `0x${string}`;
  partitionId: string;
  partitionLabel: string;
  socialId: string;
  amountWei: string;
  type: TxType;
  status: TxStatus;
  description: string;
  timestamp: string; // ISO
  invoiceCid?: string;
}

export interface PaymentIntent {
  partitionId: string;
  amountWei: string;
  invoiceRef: string;
  nonce: string;
  expiresAt: string; // ISO
}

export type AutomationKind =
  | "scheduled_release" // payroll: releaseVault(partitionId) at dueDate
  | "low_balance_topup" // pull from backup partition when balance < threshold
  | "recurring_payment" // fixed amount to fixed address every interval
  | "limit_reset"; // zero out partitionSpent on a cycle (fresh monthly budgets)

export interface AutomationRule {
  id: string;
  partitionId: string;
  kind: AutomationKind;
  enabled: boolean;
  /** kind-specific settings — see mock data for shapes per kind */
  config: {
    thresholdWei?: string; // low_balance_topup: trigger level
    topUpWei?: string; // low_balance_topup: refill amount
    sourcePartitionId?: string; // low_balance_topup: usually the backup partition
    toAddress?: `0x${string}`; // recurring_payment
    amountWei?: string; // recurring_payment
    intervalDays?: number; // recurring_payment / limit_reset
    releaseAt?: string; // scheduled_release (ISO)
  };
  nextRunAt: string | null; // ISO; null = condition-based (no fixed schedule)
  lastRunAt: string | null;
}

export interface SessionStatus {
  active: boolean;
  scope: string; // e.g. "withdraw() @ Vault"
  expiresAt: string;
}

export interface WithdrawParams {
  partitionId: string;
  to: `0x${string}`;
  amountWei: string;
  invoiceCidHash: `0x${string}`;
}

export interface WithdrawResult {
  userOpHash: `0x${string}`;
  txHash: `0x${string}`;
  sponsored: boolean;
}

// Wallet layer contract — real lib/ implementation must match this exactly.
export interface WalletApi {
  connect(): Promise<User>;
  getSessionStatus(): Promise<SessionStatus>;
  sendWithdraw(params: WithdrawParams): Promise<WithdrawResult>;
  createPaymentIntent(
    p: Omit<PaymentIntent, "nonce" | "expiresAt">,
  ): Promise<PaymentIntent>;
}
