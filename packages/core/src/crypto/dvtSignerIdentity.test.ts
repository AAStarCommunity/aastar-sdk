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
import type { Hex } from 'viem';

import { classifyDvtSigner, recordDvtSigner, newDvtIdentitySeen, canonicalSignature } from './dvtSignerIdentity.js';
import { encodeG2Point } from './dvtWire.js';

/**
 * REAL signatures, because the dedup key is now a parsed G2 point rather than a string.
 *
 * The previous fixtures were `'0xaa'` and `'0x' + 'cd'.repeat(128)` — strings no encoder in this
 * repo would accept. They exercised the comparison happily and could not have noticed a shape check
 * being added or removed, which is the same blind spot the transport tests had before FU-16.
 */
const SIG_A_COMPRESSED = `0x${Buffer.from(bls.sign(new Uint8Array(32).fill(3), new Uint8Array(32).fill(7))).toString('hex')}` as Hex;
const SIG_B_COMPRESSED = `0x${Buffer.from(bls.sign(new Uint8Array(32).fill(3), new Uint8Array(32).fill(9))).toString('hex')}` as Hex;
const SIG_A = encodeG2Point(SIG_A_COMPRESSED);
const SIG_B = encodeG2Point(SIG_B_COMPRESSED);

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
    expect(classifyDvtSigner({ endpoint: 'https://a', nodeId: ID('1'), signature: SIG_A }, newDvtIdentitySeen())).toBeNull();
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
    const first = { endpoint: 'https://a', nodeId: ID('1'), signature: SIG_A };
    expect(classifyDvtSigner(first, seen)).toBeNull();
    recordDvtSigner(first, seen);
    expect(classifyDvtSigner({ endpoint: 'https://b', nodeId: ID('1'), signature: SIG_B }, seen)?.kind).toBe('duplicate-node-id');
  });

  it('rejects a repeated SIGNATURE even when the nodeIds differ — the case ids cannot catch', () => {
    // The whole reason this module exists. Two well-formed, distinct ids; one key behind them.
    const seen = newDvtIdentitySeen();
    const first = { endpoint: 'https://a', nodeId: ID('1'), signature: SIG_A };
    expect(classifyDvtSigner(first, seen)).toBeNull();
    recordDvtSigner(first, seen);

    const second = { endpoint: 'https://b', nodeId: ID('2'), signature: SIG_A };
    expect(classifyDvtSigner(second, seen)?.kind).toBe('duplicate-signature');
  });

  it('case-different signatures are still the same signature', () => {
    const seen = newDvtIdentitySeen();
    const first = { endpoint: 'https://a', nodeId: ID('1'), signature: SIG_A };
    recordDvtSigner(first, seen);
    expect(classifyDvtSigner({ endpoint: 'https://b', nodeId: ID('2'), signature: SIG_A.toUpperCase().replace('0X','0x') as Hex }, seen)?.kind).toBe('duplicate-signature');
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
    const c = { endpoint: 'https://a', nodeId: ID('1'), signature: SIG_A };
    classifyDvtSigner(c, seen);
    classifyDvtSigner(c, seen);
    expect(seen.nodeIds.size).toBe(0);
    expect(seen.signatures.size).toBe(0);
  });

  it('every fault names the endpoint, so an operator can act on it', () => {
    const seen = newDvtIdentitySeen();
    const first = { endpoint: 'https://a', nodeId: ID('1'), signature: SIG_A };
    recordDvtSigner(first, seen);
    const faults = [
      classifyDvtSigner({ endpoint: 'https://bad1', nodeId: 'nope' }, seen),
      classifyDvtSigner({ endpoint: 'https://bad2', nodeId: ID('9'), expectedNodeId: ID('8') }, seen),
      classifyDvtSigner({ endpoint: 'https://bad3', nodeId: ID('1') }, seen),
      classifyDvtSigner({ endpoint: 'https://bad4', nodeId: ID('2'), signature: SIG_A }, seen),
    ];
    expect(faults.map((f) => f?.kind)).toEqual([
      'malformed-node-id', 'unexpected-node-id', 'duplicate-node-id', 'duplicate-signature',
    ]);
    for (const f of faults) expect(f!.message).toContain(f!.endpoint);
  });
});

describe('the dedup key is a POINT, not a string (FU-37)', () => {
  // Each of these is the same signature written another way. Before canonicalisation the first one
  // walked straight through the SDK transport — measured, two survivors where there was one key.
  const shapes: [string, () => Hex][] = [
    ['0X uppercase prefix', () => `0X${SIG_A.slice(2)}` as Hex],
    ['uppercase hex body', () => SIG_A.toUpperCase().replace('0X', '0x') as Hex],
    ['compressed form of the same point', () => SIG_A_COMPRESSED],
  ];

  it.each(shapes)('%s is recognised as the same signature', (_label, make) => {
    const seen = newDvtIdentitySeen();
    const first = { endpoint: 'https://a', nodeId: ID('1'), signature: SIG_A };
    expect(classifyDvtSigner(first, seen)).toBeNull();
    recordDvtSigner(first, seen);

    expect(classifyDvtSigner({ endpoint: 'https://b', nodeId: ID('2'), signature: make() }, seen)?.kind).toBe('duplicate-signature');
  });

  it('the compressed and uncompressed forms canonicalise to the same key', () => {
    // Stated separately from the dedup case: this is the property that makes
    // `signatureCompact || signature` safe, and that field pair needs no adversary — one node
    // answering compact and another uncompressed is ordinary.
    expect(canonicalSignature(SIG_A_COMPRESSED)).toBe(canonicalSignature(SIG_A));
    expect(canonicalSignature(SIG_A)).not.toBe(canonicalSignature(SIG_B));
  });

  it('a value that is not a G2 point is rejected, not carried as an opaque string', () => {
    // The asymmetry the bypass lived in: nodeId had a bytes32 check from the start, signature had none.
    const seen = newDvtIdentitySeen();
    for (const bad of ['0xaa', `0x${'cd'.repeat(128)}`, '0x', 'not-hex']) {
      expect(classifyDvtSigner({ endpoint: 'https://a', nodeId: ID('1'), signature: bad }, seen)?.kind, bad).toBe('malformed-signature');
    }
  });

  it('canonicalSignature returns null rather than throwing', () => {
    // classify must be able to report a fault; a throw here would escape as an unhandled error in
    // the evidence gates, which collect faults instead of catching them.
    expect(canonicalSignature('0xzz')).toBeNull();
  });
});
