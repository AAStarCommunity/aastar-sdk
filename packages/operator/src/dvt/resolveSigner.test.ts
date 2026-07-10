import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveEoaAccount, resolveEoaPrivateKey } from './resolveSigner.js';

// Well-known Anvil account #1 — deterministic fixture, never used on any live network.
const KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const ADDR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

describe('resolveEoaPrivateKey', () => {
    const saved: Record<string, string | undefined> = {};
    const vars = ['OPERATOR_PRIVATE_KEY', 'ETH_PRIVATE_KEY', 'PRIVATE_KEY'];

    beforeEach(() => {
        for (const v of vars) {
            saved[v] = process.env[v];
            delete process.env[v];
        }
    });
    afterEach(() => {
        for (const v of vars) {
            if (saved[v] === undefined) delete process.env[v];
            else process.env[v] = saved[v];
        }
    });

    it('accepts an explicit private key and returns it 0x-normalized', async () => {
        expect(await resolveEoaPrivateKey({ type: 'privateKey', privateKey: KEY })).toBe(KEY);
    });

    it('normalizes a bare (no-0x) private key', async () => {
        expect(await resolveEoaPrivateKey({ type: 'privateKey', privateKey: KEY.slice(2) as `0x${string}` })).toBe(KEY);
    });

    it('reads the key from a named env var', async () => {
        process.env.MY_KEY = KEY;
        expect(await resolveEoaPrivateKey({ type: 'env', var: 'MY_KEY' })).toBe(KEY);
        delete process.env.MY_KEY;
    });

    it('falls back through OPERATOR_PRIVATE_KEY → ETH_PRIVATE_KEY → PRIVATE_KEY', async () => {
        process.env.PRIVATE_KEY = KEY;
        expect(await resolveEoaPrivateKey({ type: 'env' })).toBe(KEY);
        process.env.OPERATOR_PRIVATE_KEY = KEY;
        expect(await resolveEoaPrivateKey({ type: 'env' })).toBe(KEY);
    });

    it('throws when no env key is present', async () => {
        await expect(resolveEoaPrivateKey({ type: 'env' })).rejects.toThrow(/no private key in env/);
    });

    it('throws on a malformed key', async () => {
        await expect(resolveEoaPrivateKey({ type: 'privateKey', privateKey: '0x1234' as `0x${string}` }))
            .rejects.toThrow(/not a 32-byte hex private key/);
    });

    it('resolveEoaAccount derives the matching address', async () => {
        const acct = await resolveEoaAccount({ type: 'privateKey', privateKey: KEY });
        expect(acct.address).toBe(ADDR);
    });
});
