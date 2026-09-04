/**
 * The identity classifier, and the property the whole thing rests on.
 *
 * The first block is not about this module at all — it checks that BLS signing really is
 * deterministic over (key, message). If it were not, `duplicate-signature` would be detecting
 * nothing and every comment claiming it catches same-key-two-ids would be decoration. Asserting an
 * assumption you inherited is cheaper than discovering later that you inherited it wrong.
 */
import { describe, expect, it } from 'vitest';
import { bls12_381 as bls } from '@noble/curves/bls12-381';

import { classifyDvtSigner, recordDvtSigner, newDvtIdentitySeen } from './dvtSignerIdentity.js';

const ID = (n: string) => `0x${n.repeat(64).slice(0, 64)}`;

describe('the assumption underneath duplicate-signature', () => {
  it('one key signing one message twice yields byte-identical signatures', () => {
    const sk = new Uint8Array(32).fill(7);
    const msg = new Uint8Array(32).fill(3);
    expect(Buffer.from(bls.sign(msg, sk)).toString('hex')).toBe(Buffer.from(bls.sign(msg, sk)).toString('hex'));
  });

  it('two different keys signing the same message do NOT collide', () => {
    // The other half: if distinct keys could collide, the check would reject honest signers.
    const msg = new Uint8Array(32).fill(3);
    const a = Buffer.from(bls.sign(msg, new Uint8Array(32).fill(7))).toString('hex');
    const b = Buffer.from(bls.sign(msg, new Uint8Array(32).fill(9))).toString('hex');
    expect(a).not.toBe(b);
  });
});

describe('classifyDvtSigner', () => {
  it('accepts a well-formed, unseen answer', () => {
    expect(classifyDvtSigner({ endpoint: 'https://a', nodeId: ID('1'), signature: '0xaa' }, newDvtIdentitySeen())).toBeNull();
  });

  it('rejects a nodeId that is not bytes32', () => {
    const seen = newDvtIdentitySeen();
    for (const bad of [undefined, null, 42, '0xabcd', `0x${'1'.repeat(63)}`, `0x${'1'.repeat(65)}`]) {
      const f = classifyDvtSigner({ endpoint: 'https://a', nodeId: bad }, seen);
      expect(f?.kind, `${JSON.stringify(bad)} should be malformed`).toBe('malformed-node-id');
    }
  });

  it('rejects a nodeId that is not the one pinned for that endpoint', () => {
    const f = classifyDvtSigner({ endpoint: 'https://a', nodeId: ID('1'), expectedNodeId: ID('2') }, newDvtIdentitySeen());
    expect(f?.kind).toBe('unexpected-node-id');
  });

  it('accepts when the pin matches, case-insensitively', () => {
    const seen = newDvtIdentitySeen();
    expect(classifyDvtSigner({ endpoint: 'https://a', nodeId: `0x${'AB'.repeat(32)}`, expectedNodeId: `0x${'ab'.repeat(32)}` }, seen)).toBeNull();
  });

  it('rejects a repeated nodeId', () => {
    const seen = newDvtIdentitySeen();
    const first = { endpoint: 'https://a', nodeId: ID('1'), signature: '0xaa' };
    expect(classifyDvtSigner(first, seen)).toBeNull();
    recordDvtSigner(first, seen);
    expect(classifyDvtSigner({ endpoint: 'https://b', nodeId: ID('1'), signature: '0xbb' }, seen)?.kind).toBe('duplicate-node-id');
  });

  it('rejects a repeated SIGNATURE even when the nodeIds differ — the case ids cannot catch', () => {
    // The whole reason this module exists. Two well-formed, distinct ids; one key behind them.
    const seen = newDvtIdentitySeen();
    const first = { endpoint: 'https://a', nodeId: ID('1'), signature: `0x${'cd'.repeat(128)}` };
    expect(classifyDvtSigner(first, seen)).toBeNull();
    recordDvtSigner(first, seen);

    const second = { endpoint: 'https://b', nodeId: ID('2'), signature: `0x${'cd'.repeat(128)}` };
    expect(classifyDvtSigner(second, seen)?.kind).toBe('duplicate-signature');
  });

  it('case-different signatures are still the same signature', () => {
    const seen = newDvtIdentitySeen();
    const first = { endpoint: 'https://a', nodeId: ID('1'), signature: `0x${'cd'.repeat(128)}` };
    recordDvtSigner(first, seen);
    expect(classifyDvtSigner({ endpoint: 'https://b', nodeId: ID('2'), signature: `0x${'CD'.repeat(128)}` }, seen)?.kind).toBe('duplicate-signature');
  });

  it('a caller with no signature still gets the id checks', () => {
    // Not every caller holds the partial at classification time. Degrading to id-only must not
    // silently degrade to accepting everything.
    const seen = newDvtIdentitySeen();
    const first = { endpoint: 'https://a', nodeId: ID('1') };
    recordDvtSigner(first, seen);
    expect(classifyDvtSigner({ endpoint: 'https://b', nodeId: ID('1') }, seen)?.kind).toBe('duplicate-node-id');
  });

  it('classify does not mutate — recording is the caller\'s explicit act', () => {
    // A helper that mutated on some paths and not others is the kind of thing nobody re-reads.
    const seen = newDvtIdentitySeen();
    const c = { endpoint: 'https://a', nodeId: ID('1'), signature: '0xaa' };
    classifyDvtSigner(c, seen);
    classifyDvtSigner(c, seen);
    expect(seen.nodeIds.size).toBe(0);
    expect(seen.signatures.size).toBe(0);
  });

  it('every fault names the endpoint, so an operator can act on it', () => {
    const seen = newDvtIdentitySeen();
    const first = { endpoint: 'https://a', nodeId: ID('1'), signature: '0xaa' };
    recordDvtSigner(first, seen);
    const faults = [
      classifyDvtSigner({ endpoint: 'https://bad1', nodeId: 'nope' }, seen),
      classifyDvtSigner({ endpoint: 'https://bad2', nodeId: ID('9'), expectedNodeId: ID('8') }, seen),
      classifyDvtSigner({ endpoint: 'https://bad3', nodeId: ID('1') }, seen),
      classifyDvtSigner({ endpoint: 'https://bad4', nodeId: ID('2'), signature: '0xaa' }, seen),
    ];
    expect(faults.map((f) => f?.kind)).toEqual([
      'malformed-node-id', 'unexpected-node-id', 'duplicate-node-id', 'duplicate-signature',
    ]);
    for (const f of faults) expect(f!.message).toContain(f!.endpoint);
  });
});
