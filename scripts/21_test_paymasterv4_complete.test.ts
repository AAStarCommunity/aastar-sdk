/**
 * FU-77: setTokenPrice / withdrawTo must hit the paymaster the script validated
 * (`PAYMASTER_V4_ADDRESS`), with that call's arguments. A source regex still matches
 * after the calls are commented out, and it cannot see the destination.
 * The transport below never opens a socket.
 */
import { readFileSync } from 'node:fs';
import {
  custom, decodeFunctionData, getAddress, hexToBigInt, parseTransaction,
  type Address, type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { PaymasterABI } from '../packages/core/src/abis/index.js';
import { adminClientForPaymaster } from './paymaster-v4-anvil-client.js';

const ANVIL_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
const PAYMASTER = getAddress('0x1111111111111111111111111111111111111111');
const TOKEN = getAddress('0x2222222222222222222222222222222222222222');
const GAS_TOKEN_PRICE = 100_000_000n;
const WITHDRAW_WEI = 1n;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function recordingTransport() {
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
  return { transport, sent };
}

describe('scripts/21_test_paymasterv4_complete', () => {
  it('setTokenPrice and withdrawTo encode the validated paymaster and the call arguments', async () => {
    const src = stripComments(readFileSync(new URL('./21_test_paymasterv4_complete.ts', import.meta.url), 'utf8'));
    expect(src).toMatch(/adminClient\.setTokenPrice\(\s*\{[^}]*token:\s*apntsAddress[^}]*price:\s*100_000_000n/);
    expect(src).toMatch(/adminClient\.withdrawTo\(\s*\{[^}]*to:\s*account\.address[^}]*amount:\s*1n/);
    expect(src).toMatch(/adminClientForPaymaster\(\{[\s\S]*paymasterV4Address,\s*\}\)/);
    expect(src).not.toMatch(/adminClient\.addGasToken\b/);
    expect(src).not.toMatch(/adminClient\.withdrawPNT\b/);

    const account = privateKeyToAccount(ANVIL_KEY);
    const { transport, sent } = recordingTransport();
    const admin = adminClientForPaymaster({
      transport,
      account,
      paymasterV4Address: PAYMASTER,
    });

    await admin.setTokenPrice({ token: TOKEN, price: GAS_TOKEN_PRICE });
    await admin.withdrawTo({ to: account.address, amount: WITHDRAW_WEI });

    expect(sent).toHaveLength(2);
    const decoded = sent.map((raw) => {
      const tx = parseTransaction(raw);
      // This viem build puts calldata on `data`. `input` is the other spelling.
      const data = tx.input ?? (tx as { data?: Hex }).data;
      expect(data, 'signed tx calldata').toBeDefined();
      expect(getAddress(tx.to!)).toBe(PAYMASTER);
      return decodeFunctionData({ abi: PaymasterABI, data: data! });
    });
    expect(decoded[0].functionName).toBe('setTokenPrice');
    expect(decoded[0].args).toEqual([TOKEN, GAS_TOKEN_PRICE]);
    expect(decoded[1].functionName).toBe('withdrawTo');
    expect(decoded[1].args).toEqual([account.address, WITHDRAW_WEI]);
    expect(hexToBigInt(parseTransaction(sent[1]).value ?? '0x0')).toBe(0n);
  });
});
