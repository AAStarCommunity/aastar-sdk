/**
 * One place that decides whether a DVT co-signature came from the signer it claims to be.
 *
 * WHY THIS IS SHARED CODE AND NOT A CONVENTION
 * --------------------------------------------
 * The same check had been written four and a half times: once properly in
 * `tier3-composite-e2e.ts`, and in weaker forms in three other evidence scripts and in the SDK's own
 * transport. They did not merely differ in style — they disagreed about WHAT to check, and the gaps
 * were not the same gaps, so no single reading of any one of them described the system.
 *
 * WHAT THE SIGNATURE-BYTE CHECK BUYS, AND WHY IT IS NOT REDUNDANT
 * --------------------------------------------------------------
 * Distinct nodeIds are not distinct signers. Two nodes holding the SAME BLS key, registered under
 * two ids, produce an aggregate that counts one key twice: it pairs, it verifies, and the threshold
 * it appears to meet is not the threshold it met.
 *
 * `nodeId` dedup cannot see that — both ids are well-formed and different. The signature bytes can,
 * for free: BLS signing is deterministic over (key, message), so one key signing one userOpHash
 * yields byte-identical partials no matter which host produced them. Verified in
 * `dvtSignerIdentity.test.ts` rather than assumed, because the entire check rests on it.
 *
 * COMPARING BYTES MEANS COMPARING A CANONICAL FORM (FU-37)
 * -------------------------------------------------------
 * The first version of this compared the strings as they arrived, and that is not the same thing as
 * comparing the signatures. Measured, on the SDK's own transport:
 *
 *   node B returns the identical partial with an uppercase `0X` prefix  →  dedup missed it,
 *   two signers counted where there was one key
 *
 * and a second entry point needs no adversary at all: the transport reads
 * `signatureCompact || signature`, so one node answering with the 96-byte compressed form and
 * another with the 256-byte EIP-2537 form produce different strings for the same point.
 *
 * The fix is not more string handling. Every candidate is now put through {@link encodeG2Point},
 * which parses the 96/192/256-byte forms and emits the one canonical 256-byte layout — so the
 * comparison is between POINTS, and a value that is not a point is rejected outright instead of
 * being carried as an opaque string. Shape validation comes free with it: `nodeId` had a bytes32
 * check from the start and `signature` had none, which is the asymmetry the bypass lived in.
 *
 * A CORRECTION THIS FILE EXISTS TO CARRY
 * --------------------------------------
 * FU-16 (#343) added nodeId shape and dedup checks to the SDK transport and stated in its method
 * doc that same-key-two-ids "needs the registered public keys, which this transport does not hold".
 * That was wrong, and it shipped. The evidence script had been catching exactly that case for weeks
 * with three lines and no extra data — the claim was reasoned from what the transport knows about
 * KEYS, when the property that matters is one of the SIGNATURES it already has in hand.
 *
 * SKIP OR ABORT IS THE CALLER'S DECISION
 * --------------------------------------
 * This module classifies; it does not act. The difference is deliberate and must not be unified:
 * a release gate aborts on any fault, because routing around an impostor would let the gate pass
 * while exercising a signer set other than the one it claims. A live transport skips the node and
 * carries on, because refusing to sign is the wrong response to one bad peer. Same fault, opposite
 * correct reactions.
 *
 * @module
 */

import { encodeG2Point } from './dvtWire.js';

/** Why a co-signature was rejected. Ordered from cheapest to establish to most expensive. */
export type DvtIdentityFaultKind =
    | 'malformed-node-id'
    | 'unexpected-node-id'
    | 'duplicate-node-id'
    | 'malformed-signature'
    | 'duplicate-signature';

export interface DvtIdentityFault {
  kind: DvtIdentityFaultKind;
  /** The endpoint that produced the answer, so an operator can act on it. */
  endpoint: string;
  /** Operator-facing explanation, complete enough to act on without reading this file. */
  message: string;
}

export interface DvtIdentityCandidate {
  /** The endpoint that answered. */
  endpoint: string;
  /** The nodeId the node reported about itself. */
  nodeId: unknown;
  /** The partial signature it returned, if the caller has it. */
  signature?: string;
  /** The nodeId configuration pins to this endpoint, when the caller has one. */
  expectedNodeId?: string;
}

/** What has already been accepted this round. Callers add to it only on `null`. */
export interface DvtIdentitySeen {
  nodeIds: Set<string>;
  signatures: Set<string>;
}

/** A fresh, empty accumulator for one aggregation round. */
export function newDvtIdentitySeen(): DvtIdentitySeen {
  return { nodeIds: new Set(), signatures: new Set() };
}

const BYTES32 = /^0x[0-9a-fA-F]{64}$/;

/**
 * Classify one co-signature. Returns `null` when it is acceptable — at which point the caller
 * records it in `seen` — or the reason it is not.
 *
 * Nothing here is mutated: a caller that forgets to record an accepted answer gets duplicates
 * through, and that is visible in tests, whereas a helper that mutated silently on some paths and
 * not others would be the kind of thing nobody re-reads.
 */
export function classifyDvtSigner(candidate: DvtIdentityCandidate, seen: DvtIdentitySeen): DvtIdentityFault | null {
  const { endpoint, nodeId, signature, expectedNodeId } = candidate;

  if (typeof nodeId !== 'string' || !BYTES32.test(nodeId)) {
    return {
      kind: 'malformed-node-id',
      endpoint,
      message: `${endpoint} returned a nodeId that is not a 32-byte hex value (${JSON.stringify(nodeId)})`,
    };
  }
  const id = nodeId.toLowerCase();

  if (expectedNodeId && id !== expectedNodeId.toLowerCase()) {
    return {
      kind: 'unexpected-node-id',
      endpoint,
      message:
        `${endpoint} reported nodeId ${id} but the configuration pins ${expectedNodeId.toLowerCase()} for ` +
        'that endpoint — either the endpoint is serving another node\'s identity, or the pinned value is stale',
    };
  }

  if (seen.nodeIds.has(id)) {
    return {
      kind: 'duplicate-node-id',
      endpoint,
      message: `${endpoint} reported nodeId ${id}, which another node in this round already claimed`,
    };
  }

  if (signature !== undefined) {
    const sig = canonicalSignature(signature);
    if (sig === null) {
      return {
        kind: 'malformed-signature',
        endpoint,
        message:
          `${endpoint} returned a signature that is not a BLS12-381 G2 point ` +
          `(${signature.slice(0, 18)}…, ${Math.max(0, (signature.length - 2) / 2)} bytes) — it cannot be compared ` +
          'with the others, and an aggregate built from it could not verify',
      };
    }
    if (seen.signatures.has(sig)) {
      return {
        kind: 'duplicate-signature',
        endpoint,
        message:
          `${endpoint} returned a partial byte-identical to another endpoint's — BLS is deterministic over ` +
          '(key, message), so this is ONE key behind two nodeIds, not two signers. The aggregate would ' +
          'count that key twice and appear to meet a threshold it did not meet.',
      };
    }
  }

  return null;
}

/**
 * The canonical 256-byte EIP-2537 form of a co-signature, or `null` if it is not a G2 point.
 *
 * This is the dedup key. Two nodes sharing a key produce the same point however each of them chooses
 * to write it — uppercase, `0X`-prefixed, compressed or uncompressed — and only after this does the
 * byte comparison mean what its comment claims.
 */
export function canonicalSignature(signature: string): string | null {
  // The prefix is normalised BEFORE parsing, and that is not cosmetic. `encodeG2Point` rejects
  // `0X…`, so without this a node writing the prefix in caps would be classified as "not a G2
  // point" — fail-closed, so the duplicate is still dropped, but for the wrong reason and at the
  // cost of rejecting an honest node that happens to write hex the other legal way. A check that
  // gets the right answer through a wrong diagnosis sends the operator after the wrong node.
  // Accept the forms a node may actually put on the wire: `0x…`, `0X…`, or bare hex. Callers used
  // to prefix it themselves before comparing, and that is where the original bypass lived — a
  // case-sensitive `startsWith('0x')` turned `0X…` into `0x0X…`, which then matched nothing.
  // Prefixing is the canonicaliser's job precisely because getting it wrong is invisible.
  const trimmed = signature.trim();
  const normalised = /^0[xX]/.test(trimmed) ? `0x${trimmed.slice(2)}` : `0x${trimmed}`;
  try {
    return encodeG2Point(normalised as `0x${string}`).toLowerCase();
  } catch {
    return null;
  }
}

/** Record an accepted answer. Call only after {@link classifyDvtSigner} returned `null`. */
export function recordDvtSigner(candidate: DvtIdentityCandidate, seen: DvtIdentitySeen): void {
  seen.nodeIds.add(String(candidate.nodeId).toLowerCase());
  if (candidate.signature !== undefined) {
    const sig = canonicalSignature(candidate.signature);
    if (sig !== null) seen.signatures.add(sig);
  }
}
