/**
 * Proves the helpers encode the validated paymaster and reject a reverted receipt,
 * and that a thrown withdraw is counted as a failure.
 * The recording transport also checks pause/unpause destinations: paymasterActions
 * bound to the validated paymaster, and adminClient.pause/unpause bound to MySBT.
 * It also decodes setMaxGasCostCap and setServiceFeeRate. A source check looks for
 * that binding and those argument names in script 21; this file does not execute the script.
 * A recording transport never opens a socket.
 */
import { readFileSync } from 'node:fs';
import {
  custom, decodeFunctionData, getAddress, hexToBigInt, parseTransaction,
  type Address, type Hash, type Hex, type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { PaymasterABI } from '../packages/core/src/abis/index.js';
import { paymasterActions } from '../packages/core/src/actions/paymaster.js';
import { CORE_ADDRESSES } from '../packages/core/src/contract-addresses.js';
import { createAdminClient } from '../packages/sdk/src/clients/admin.js';
import {
  adminClientForPaymaster,
  classifySbtActivityError,
  registerGasToken,
  withdrawPaymasterDeposit,
  type MinedReceipt,
} from './paymaster-v4-anvil-client.js';

const ANVIL_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
const PAYMASTER = getAddress('0x1111111111111111111111111111111111111111');
const TOKEN = getAddress('0x2222222222222222222222222222222222222222');
const SBT = getAddress('0x3333333333333333333333333333333333333333');

function recordingTransport(receipts: MinedReceipt[] = []) {
  const sent: Hex[] = [];
  const transport = custom({
    async request({ method, params }) {
      if (method === 'eth_chainId') return 31337;
      if (method === 'eth_sendRawTransaction') {
        sent.push((params as [Hex])[0]);
        return `0x${'11'.repeat(32)}` as Hex;
      }
      if (method === 'eth_estimateGas') return '0x5208';
      if (method === 'eth_gasPrice' || method === 'eth_maxPriorityFeePerGas') return '0x3b9aca00';
      if (method === 'eth_getTransactionCount') return '0x0';
      if (method === 'eth_blockNumber') return '0x1';
      if (method === 'eth_getBlockByNumber') {
        return { baseFeePerGas: '0x1', number: '0x1', timestamp: '0x1' };
      }
      throw new Error(`unexpected rpc ${method}`);
    },
  });
  const waitForReceipt = async (_hash: Hash): Promise<MinedReceipt> => {
    return receipts[sent.length - 1] ?? { status: 'success' };
  };
  return { transport, sent, waitForReceipt };
}

function decodeSent(raw: Hex, to: Address = PAYMASTER) {
  const tx = parseTransaction(raw);
  const data = tx.input ?? (tx as { data?: Hex }).data;
  expect(data, 'signed tx calldata').toBeDefined();
  expect(getAddress(tx.to!)).toBe(to);
  return {
    tx,
    decoded: decodeFunctionData({ abi: PaymasterABI, data: data! }),
  };
}

const WRITE_LABELS = [
  'addSBT',
  'addSBTWithActivity',
  'setMaxGasCostCap',
  'setServiceFeeRate',
  'pause',
  'unpause',
] as const;

describe('scripts/21_test_paymasterv4_complete', () => {
  it('classifies a reverted addSBTWithActivity receipt as a failure and AlreadyExists as idempotent', () => {
    expect(classifySbtActivityError('execution reverted: AlreadyExists()')).toBe('idempotent');
    expect(classifySbtActivityError('addSBTWithActivity reverted: 0xabc')).toBe('failed');
    expect(classifySbtActivityError('adminClient.addSBTWithActivity is not a function')).toBe('skipped');
  });

  it('classifies timeout, network, and unknown addSBTWithActivity errors as failures', () => {
    expect(classifySbtActivityError('The request took too long to respond.')).toBe('failed');
    expect(classifySbtActivityError('HTTP request failed.')).toBe('failed');
    expect(classifySbtActivityError('socket hang up')).toBe('failed');
    expect(classifySbtActivityError(undefined)).toBe('failed');
  });

  it('script 21 checks mined success before counting each remaining write as passed', () => {
    const src = readFileSync(new URL('./21_test_paymasterv4_complete.ts', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const calls = src.match(/requireMinedSuccess\(/g) ?? [];
    expect(calls).toHaveLength(WRITE_LABELS.length);
    for (const label of WRITE_LABELS) {
      expect(src).toContain(`requireMinedSuccess(await publicClient.waitForTransactionReceipt({ hash }), '${label}', hash)`);
    }
    expect(src).toContain('classifySbtActivityError(');
    expect(src).toContain("import { paymasterActions } from '@aastar/core'");
    expect(src).toContain('paymasterActions(paymasterV4Address)(adminClient as PublicClient)');
    expect(src).toContain('_maxGasCostCap: newCap');
    expect(src).toContain('_serviceFeeRate: newRate');
    expect(src).not.toMatch(/adminClient\.pause\s*\(/);
    expect(src).not.toMatch(/adminClient\.unpause\s*\(/);
  });

  it('bound pause and unpause target the validated paymaster, adminClient pause targets MySBT', async () => {
    const account = privateKeyToAccount(ANVIL_KEY);
    const { transport, sent } = recordingTransport();
    const adminClient = createAdminClient({
      chain: foundry,
      transport,
      account,
      addresses: {
        ...CORE_ADDRESSES,
        paymasterV4: PAYMASTER,
        mySBT: SBT,
      },
    });
    // Same binding as script 21. Vitest does not apply the root tsconfig paths
    // entry for `@aastar/core`; this file is the module that package re-exports.
    const paymaster = paymasterActions(PAYMASTER)(adminClient as PublicClient);
    await paymaster.pause({});
    await paymaster.unpause({});
    await adminClient.pause({});
    await adminClient.unpause({});

    expect(sent).toHaveLength(4);
    expect(decodeSent(sent[0], PAYMASTER).decoded.functionName).toBe('pause');
    expect(decodeSent(sent[1], PAYMASTER).decoded.functionName).toBe('unpause');
    expect(decodeSent(sent[2], SBT).decoded.functionName).toBe('pause');
    expect(decodeSent(sent[3], SBT).decoded.functionName).toBe('unpause');
  });

  it('setMaxGasCostCap and setServiceFeeRate encode the script amounts on the validated paymaster', async () => {
    const account = privateKeyToAccount(ANVIL_KEY);
    const { transport, sent } = recordingTransport();
    const adminClient = adminClientForPaymaster({
      transport,
      account,
      paymasterV4Address: PAYMASTER,
    });
    // Same amounts as script 21 tests 7 and 9.
    const newCap = BigInt(2 * 1e18);
    const newRate = BigInt(500);
    await adminClient.setMaxGasCostCap({ _maxGasCostCap: newCap });
    await adminClient.setServiceFeeRate({ _serviceFeeRate: newRate });

    expect(sent).toHaveLength(2);
    const cap = decodeSent(sent[0]);
    const rate = decodeSent(sent[1]);
    expect(cap.decoded.functionName).toBe('setMaxGasCostCap');
    expect(cap.decoded.args).toEqual([newCap]);
    expect(rate.decoded.functionName).toBe('setServiceFeeRate');
    expect(rate.decoded.args).toEqual([newRate]);
  });

  it('registerGasToken and withdrawPaymasterDeposit encode the validated paymaster', async () => {
    const account = privateKeyToAccount(ANVIL_KEY);
    const { transport, sent, waitForReceipt } = recordingTransport();
    const adminClient = adminClientForPaymaster({
      transport,
      account,
      paymasterV4Address: PAYMASTER,
    });

    await registerGasToken({ adminClient, token: TOKEN, waitForReceipt });
    const withdrawn = await withdrawPaymasterDeposit({
      adminClient,
      to: account.address,
      waitForReceipt,
    });

    expect(withdrawn).toEqual({ testsPassed: 1, testsFailed: 0 });
    expect(sent).toHaveLength(2);
    const price = decodeSent(sent[0]);
    const withdraw = decodeSent(sent[1]);
    expect(price.decoded.functionName).toBe('setTokenPrice');
    expect(price.decoded.args).toEqual([TOKEN, 100_000_000n]);
    expect(withdraw.decoded.functionName).toBe('withdrawTo');
    expect(withdraw.decoded.args).toEqual([account.address, 1n]);
    expect(hexToBigInt(withdraw.tx.value ?? '0x0')).toBe(0n);
  });

  it('counts a thrown withdrawTo as a failure', async () => {
    const account = privateKeyToAccount(ANVIL_KEY);
    const withdrawn = await withdrawPaymasterDeposit({
      adminClient: {
        withdrawTo: async () => { throw new Error('empty EntryPoint deposit'); },
      },
      to: account.address,
      waitForReceipt: async () => ({ status: 'success' }),
    });
    expect(withdrawn.testsPassed).toBe(0);
    expect(withdrawn.testsFailed).toBe(1);
    expect(withdrawn.error).toBeInstanceOf(Error);
  });

  it('counts a reverted withdrawTo receipt as a failure', async () => {
    const account = privateKeyToAccount(ANVIL_KEY);
    const { transport, sent, waitForReceipt } = recordingTransport([{ status: 'reverted' }]);
    const adminClient = adminClientForPaymaster({
      transport,
      account,
      paymasterV4Address: PAYMASTER,
    });
    const withdrawn = await withdrawPaymasterDeposit({
      adminClient,
      to: account.address,
      waitForReceipt,
    });
    expect(sent).toHaveLength(1);
    expect(withdrawn.testsPassed).toBe(0);
    expect(withdrawn.testsFailed).toBe(1);
    expect((withdrawn.error as Error).message).toContain('reverted');
  });

  it('rejects a reverted setTokenPrice receipt', async () => {
    const account = privateKeyToAccount(ANVIL_KEY);
    const { transport, waitForReceipt } = recordingTransport([{ status: 'reverted' }]);
    const adminClient = adminClientForPaymaster({
      transport,
      account,
      paymasterV4Address: PAYMASTER,
    });
    await expect(registerGasToken({
      adminClient,
      token: TOKEN,
      waitForReceipt,
    })).rejects.toThrow(/setTokenPrice reverted/);
  });
});
