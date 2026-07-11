import type { ChainRef } from "./types";
import type { SignerHandle } from "./account-port";

export interface ExecutionIntent {
  kind: "transfer" | "vault_deposit" | "vault_withdraw" | "swap";
  sourceChain: ChainRef;
  destinationChain?: ChainRef;
  amountRaw: string;
  recipient: string;
}

export interface ExecutionQuote {
  feeRaw: string;
  etaSeconds: number;
  legCount: number;
}

export interface ExecutionRef {
  providerRef: string;
  chain: ChainRef;
}

export interface ExecutionReceipt extends ExecutionRef {
  submittedAt: string;
}

export type ExecutionStatus = "pending" | "confirmed" | "failed";

export interface ExecutionPort {
  quote(intent: ExecutionIntent): Promise<ExecutionQuote>;
  submit(intent: ExecutionIntent, signer: SignerHandle): Promise<ExecutionReceipt>;
  trackStatus(ref: ExecutionRef): Promise<ExecutionStatus>;
}
