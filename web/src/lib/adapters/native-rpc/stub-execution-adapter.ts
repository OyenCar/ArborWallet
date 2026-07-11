import type { ExecutionPort, ExecutionIntent, ExecutionQuote, ExecutionReceipt, ExecutionRef, ExecutionStatus } from "../../ports/execution-port";
import type { SignerHandle } from "../../ports/account-port";
import { NotImplementedError } from "../eoa/stub-account-adapter";

export class StubExecutionAdapter implements ExecutionPort {
  async quote(_intent: ExecutionIntent): Promise<ExecutionQuote> {
    throw new NotImplementedError("StubExecutionAdapter.quote");
  }

  async submit(_intent: ExecutionIntent, _signer: SignerHandle): Promise<ExecutionReceipt> {
    throw new NotImplementedError("StubExecutionAdapter.submit");
  }

  async trackStatus(_ref: ExecutionRef): Promise<ExecutionStatus> {
    throw new NotImplementedError("StubExecutionAdapter.trackStatus");
  }
}
