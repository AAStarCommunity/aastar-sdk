import { describe, expect, it } from 'vitest';
import { getAddress } from 'viem';
import { KeeperStartupRefusal, parseKeeperMode, resolveKeeperSigner } from './keeperKey.js';
import {
    assertChainId, castChildEnv, castSendArgs, envFileConflicts, feeDecision, parseAddressOption, parseGweiOption,
    parseIntOption, parseNetwork, receiptOutcome, redactRpcUrl, safeChildError,
} from './keeperGuards.js';

const KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // anvil #0, public test key
const T = '0x09df0d2e3722ec0e401fe3819e64278a42ae4de9' as const;

describe('keeper local guards (Daybreak 6c240b42 round 1)', () => {
    it('KPR-002: either cast signer argument means cast mode; privateKey mode refuses a cast argument; both refuse', () => {
        expect(parseKeeperMode(undefined, true)).toBe('cast');
        expect(parseKeeperMode(undefined, false)).toBe('privateKey');
        const env = { KEEPER_PRIVATE_KEY: KEY };
        expect(() => resolveKeeperSigner({ mode: 'privateKey', dryRun: false, env, keystorePath: undefined, castAccount: 'keeper' }))
            .toThrow(/the mode is privateKey/);
        expect(() => resolveKeeperSigner({ mode: 'privateKey', dryRun: false, env, keystorePath: '/k.json', castAccount: undefined }))
            .toThrow(/the mode is privateKey/);
        expect(() => resolveKeeperSigner({ mode: 'cast', dryRun: false, env, keystorePath: '/k.json', castAccount: 'keeper' }))
            .toThrow(/not both/);
    });

    it('KPR-012 / FU-113: numbers, gwei and networks are checked locally and never echoed', () => {
        expect(parseIntOption('--poll-interval', undefined, 30n, 1n)).toBe(30n);
        expect(parseIntOption('--poll-interval', '180', 30n, 1n)).toBe(180n);
        for (const bad of ['abc', '1.5', '-1', '1e3', ' 5', KEY]) {
            expect(() => parseIntOption('--max-updates-per-day', bad, 24n, 0n)).toThrow(KeeperStartupRefusal);
        }
        // NaN used to slip through: `updatesToday >= NaN` is always false, so the daily cap never applied.
        expect(() => parseIntOption('--max-updates-per-day', 'abc', 24n, 0n)).toThrow(/whole number/);
        expect(() => parseIntOption('--poll-interval', '0', 30n, 1n)).toThrow(/at least 1/);
        try { parseIntOption('--poll-interval', KEY, 30n, 1n); } catch (e: any) { expect(e.message).not.toContain(KEY.slice(2, 20)); }
        expect(parseGweiOption('--hard-max-fee-gwei', '0.5')).toBe(500_000_000n);
        expect(parseGweiOption('--hard-max-fee-gwei', '3')).toBe(3_000_000_000n);
        expect(parseGweiOption('--hard-max-fee-gwei', undefined)).toBeUndefined();
        for (const bad of ['0', '0.0', 'x', '1.1234567891', '-1']) expect(() => parseGweiOption('--hard-max-fee-gwei', bad)).toThrow(KeeperStartupRefusal);
        expect(parseNetwork(undefined)).toBe('op-sepolia');
        expect(parseNetwork('sepolia')).toBe('sepolia');
        expect(() => parseNetwork('../../etc')).toThrow(/value is not shown/);
    });

    it('KPR-009: address options must be addresses; the value is not shown', () => {
        expect(parseAddressOption('--paymaster', T)).toBe(T);
        expect(parseAddressOption('--paymaster', getAddress(T))).toBe(getAddress(T)); // valid checksum
        expect(parseAddressOption('--paymaster', undefined)).toBeUndefined();
        for (const bad of [KEY, '0x09DF0d2e3722ec0e401fe3819e64278a42ae4de9', 'not-an-address-zz', '0x1234']) {
            let msg = '';
            try { parseAddressOption('--paymaster', bad); } catch (e: any) { msg = e.message; }
            expect(msg).toMatch(/not a valid address/);
            expect(msg).not.toContain(bad.slice(2, 20));
        }
    });

    it('KPR-003: two env files that disagree on a variable are reported by name only', () => {
        expect(envFileConflicts([
            { name: '.env.optimism', vars: { KEEPER_PRIVATE_KEY: 'a', RPC_URL: 'x', ONLY_OLD: '1' } },
            { name: '.env.op-mainnet', vars: { KEEPER_PRIVATE_KEY: 'b', RPC_URL: 'x', ONLY_NEW: '2' } },
        ])).toEqual(['KEEPER_PRIVATE_KEY']);
        expect(envFileConflicts([{ name: '.env.sepolia', vars: { RPC_URL: 'x' } }])).toEqual([]);
    });

    it('KPR-004 / KPR-018: cast gets an allowlisted env with the RPC URL, and no RPC URL on argv', () => {
        const env = castChildEnv({
            PATH: '/bin', HOME: '/h', KEEPER_PRIVATE_KEY: KEY, PRIVATE_KEY: KEY, TELEGRAM_BOT_TOKEN: 't', CAST_KEYSTORE_PASSWORD: 'p',
            RPC_URL: 'https://x/key', ETH_KEYSTORE_ACCOUNT: 'deployer',
        }, 'https://rpc.example/v2/SECRET');
        expect(env).toEqual({ PATH: '/bin', HOME: '/h', ETH_RPC_URL: 'https://rpc.example/v2/SECRET' });
        const args = castSendArgs({ signerArgs: ['--account', 'keeper'], chainId: 11155111, passwordFilePath: '/p', target: T, gasPriceWei: 7n });
        expect(args).toEqual(['send', '--async', '--timeout', '60', '--chain', '11155111', '--account', 'keeper', '--gas-price', '7', '--password-file', '/p', T, 'updatePrice()']);
        expect(args.join(' ')).not.toMatch(/rpc/i);
        // The hard ceiling is the max fee per gas cast signs, whatever the node's gas price was.
        const capped = castSendArgs({ signerArgs: ['--account', 'keeper'], chainId: 10, passwordFilePath: '/p', target: T, gasPriceWei: 7n, maxFeeWei: 5n });
        expect(capped[capped.indexOf('--gas-price') + 1]).toBe('5');
    });

    it('KPR-018: URLs are reduced to scheme and host in logs and child errors', () => {
        expect(redactRpcUrl('https://eth-sepolia.g.alchemy.com/v2/SECRETKEY')).toBe('https://eth-sepolia.g.alchemy.com/…');
        expect(redactRpcUrl('https://user:pass@rpc.example:8545/?key=SECRET')).toBe('https://rpc.example:8545/…');
        expect(redactRpcUrl('http://127.0.0.1:8545')).toBe('http://127.0.0.1:8545');
        const e = safeChildError('Error: (code: -32000) at https://rpc.example/v2/SECRETKEY: header not found');
        expect(e).not.toContain('SECRETKEY');
        expect(e).toContain('https://rpc.example/…');
        expect(safeChildError('x'.repeat(500)).length).toBe(301);
    });

    it('KPR-005: a chain id mismatch refuses', () => {
        expect(() => assertChainId(10, 10, 'startup')).not.toThrow();
        expect(() => assertChainId(11155111, 10, 'startup')).toThrow(/serves chain 11155111.*chain 10; nothing is signed/);
    });

    it('KPR-006: the hard ceiling applies even in the near-expiry window; the soft gate does not', () => {
        const g = (baseFeeWei: bigint | undefined, nearExpiry: boolean, soft?: bigint, hard?: bigint) =>
            feeDecision({ baseFeeWei, maxBaseFeeWei: soft, hardMaxFeeWei: hard, nearExpiry });
        expect(g(10n, false)).toBe('send');
        expect(g(10n, false, 5n)).toBe('skip-soft');
        expect(g(10n, true, 5n)).toBe('send');
        expect(g(10n, true, 5n, 8n)).toBe('skip-hard');
        expect(g(10n, false, undefined, 8n)).toBe('skip-hard');
        expect(g(8n, true, undefined, 8n)).toBe('send');
        expect(g(undefined, true, undefined, 8n)).toBe('skip-hard');
    });

    it('KPR-020: only a successful receipt counts', () => {
        expect(receiptOutcome({ status: 'success' })).toBe('receipt');
        expect(receiptOutcome({ status: 'reverted' })).toBe('reverted');
        expect(receiptOutcome(undefined)).toBe('reverted');
    });
});
