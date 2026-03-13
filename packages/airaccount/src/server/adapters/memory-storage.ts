import {
  IStorageAdapter,
  AccountRecord,
  TransferRecord,
  PaymasterRecord,
  BlsConfigRecord,
} from "../interfaces/storage-adapter";

/**
 * In-memory storage adapter — useful for testing and demos.
 * All data is lost when the process exits.
 */
export class MemoryStorage implements IStorageAdapter {
  private accounts: AccountRecord[] = [];
  private transfers: TransferRecord[] = [];
  private paymasters: Map<string, PaymasterRecord[]> = new Map();
  private blsConfig: BlsConfigRecord | null = null;

  // ── Accounts ─────────────────────────────────────────────────

  async getAccounts(): Promise<AccountRecord[]> {
    return [...this.accounts];
  }

  async saveAccount(account: AccountRecord): Promise<void> {
    this.accounts.push({ ...account });
  }

  async findAccountByUserId(userId: string): Promise<AccountRecord | null> {
    return this.accounts.find(a => a.userId === userId) ?? null;
  }

  async updateAccount(userId: string, updates: Partial<AccountRecord>): Promise<void> {
    const index = this.accounts.findIndex(a => a.userId === userId);
    if (index >= 0) {
      this.accounts[index] = { ...this.accounts[index], ...updates };
    }
  }

  // ── Transfers ────────────────────────────────────────────────

  async saveTransfer(transfer: TransferRecord): Promise<void> {
    this.transfers.push({ ...transfer });
  }

  async findTransfersByUserId(userId: string): Promise<TransferRecord[]> {
    return this.transfers.filter(t => t.userId === userId);
  }

  async findTransferById(id: string): Promise<TransferRecord | null> {
    return this.transfers.find(t => t.id === id) ?? null;
  }

  async updateTransfer(id: string, updates: Partial<TransferRecord>): Promise<void> {
    const index = this.transfers.findIndex(t => t.id === id);
    if (index >= 0) {
      this.transfers[index] = { ...this.transfers[index], ...updates };
    }
  }

  // ── Paymasters ───────────────────────────────────────────────

  async getPaymasters(userId: string): Promise<PaymasterRecord[]> {
    return this.paymasters.get(userId) ?? [];
  }

  async savePaymaster(userId: string, paymaster: PaymasterRecord): Promise<void> {
    const list = this.paymasters.get(userId) ?? [];
    const existingIndex = list.findIndex(p => p.name === paymaster.name);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...paymaster };
    } else {
      list.push({ ...paymaster });
    }
    this.paymasters.set(userId, list);
  }

  async removePaymaster(userId: string, name: string): Promise<boolean> {
    const list = this.paymasters.get(userId) ?? [];
    const filtered = list.filter(p => p.name !== name);
    if (filtered.length < list.length) {
      this.paymasters.set(userId, filtered);
      return true;
    }
    return false;
  }

  // ── BLS Config ───────────────────────────────────────────────

  async getBlsConfig(): Promise<BlsConfigRecord | null> {
    return this.blsConfig;
  }

  async updateSignerNodesCache(nodes: unknown[]): Promise<void> {
    this.blsConfig = {
      ...this.blsConfig,
      signerNodes: {
        nodes: nodes as BlsConfigRecord["signerNodes"] extends { nodes: infer N } ? N : never,
      },
    } as BlsConfigRecord;
  }
}
