import type { AccountPort, AccountMode, SignerHandle, UpgradeResult } from "../../ports/account-port";
import type { WalletRecord, ChainRef } from "../../ports/types";

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`StubAccountAdapter.${method} is not implemented — real adapters land in Plan 6`);
    this.name = "NotImplementedError";
  }
}

export class StubAccountAdapter implements AccountPort {
  async getSigner(_wallet: WalletRecord, _chain: ChainRef): Promise<SignerHandle> {
    throw new NotImplementedError("getSigner");
  }

  async upgrade(_wallet: WalletRecord, _chain: ChainRef): Promise<UpgradeResult> {
    throw new NotImplementedError("upgrade");
  }

  async downgrade(_wallet: WalletRecord, _chain: ChainRef): Promise<void> {
    throw new NotImplementedError("downgrade");
  }

  async status(_wallet: WalletRecord, _chain: ChainRef): Promise<AccountMode> {
    return "eoa";
  }
}
