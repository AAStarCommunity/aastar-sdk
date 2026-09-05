/**
 * Parse and CROSS-CHECK a DVT node's `node_state.json` (T1.2.2 · gaps G1 + G4).
 *
 * ## Why this is a parser over a parsed OBJECT, not a file loader
 *
 * All three onboarding scripts read this file from disk, and the obvious API would mirror that. It
 * does not, for two reasons:
 *
 * 1. The bytes arrive from three different places — a CLI reading the board's
 *    `/opt/dvt-build/node_state.json`, a portal receiving a paste/upload, a KMS returning the same
 *    shape over HTTP. Only one of those has a filesystem.
 * 2. `@aastar/core` is browser-safe and must not statically import `node:fs` (`check:browser` is a
 *    hard CI gate). A path-taking loader would either break that or force this into a node-only
 *    package, where the portal could not reach it.
 *
 * So the caller does its own I/O and hands over the parsed value. What is worth centralising is not
 * the reading — it is the CHECKING, which all three scripts do differently.
 *
 * ## What the cross-check is actually protecting (G4)
 *
 * `registerWithProof` binds `nodeId = keccak256(publicKey)`. If the key you register does not match
 * the key the running node holds, **the transaction succeeds and the node silently never
 * participates** — nothing reverts, nothing warns, and the operator has paid a stake for a node
 * that is not in the set. `dvt3-register.ts:130` names this exactly and aborts on it; the DVT-side
 * `loadNode()` checks a weaker version of it; the AirAccount-side script checks nothing.
 *
 * This takes the strictest of the three: every field the state records that we can independently
 * derive MUST agree with the derivation. A recorded value that disagrees is not a warning — the two
 * sources describe different keys, and there is no safe way to choose between them here.
 */
import { type Hex, isHex, size } from 'viem';

import { dvtNodeId, encodeG1Point } from './dvtPop.js';

/** The subset of `node_state.json` this SDK needs. Extra fields are ignored, never rejected. */
export interface DvtNodeStateInput {
    /** BLS G1 public key — compressed 48-byte or EIP-2537 128-byte hex. */
    publicKey?: unknown;
    /** Optional pre-expanded 128-byte form some boards persist alongside `publicKey`. */
    publicKeyEip2537?: unknown;
    /** Optional recorded node id. When present it MUST equal the derived one. */
    nodeId?: unknown;
    /**
     * Present only on a local-key node. Its ABSENCE is what makes a node key-less (KMS-TEE), which
     * is a routing fact, not an error — see {@link DvtNodeState.keyless}.
     */
    privateKey?: unknown;
}

export interface DvtNodeState {
    /** The node's public key, normalised to the 128-byte EIP-2537 form the contract stores. */
    publicKey: Hex;
    /** `keccak256(publicKey)` — derived here, never taken from the input. */
    nodeId: Hex;
    /**
     * `true` when the state carries no private key: the BLS secret is sealed in a TEE and the PoP
     * must come from the KMS `/pop` endpoint (`kmsPopSigner`) rather than `buildDvtPop`.
     */
    keyless: boolean;
}

const asHex = (v: unknown, field: string): Hex => {
    if (typeof v !== 'string' || !isHex(v)) {
        throw new Error(`dvt node_state: ${field} must be a hex string, got ${v === undefined ? 'undefined' : typeof v}`);
    }
    return v;
};

/**
 * Validate a parsed `node_state.json` and derive the values the onboarding flow needs.
 *
 * Throws — never returns a partially-trusted result — when the state is unusable or when a value it
 * records contradicts one we can derive. See the module doc for why a mismatch cannot be a warning.
 */
export function parseDvtNodeState(raw: DvtNodeStateInput | null | undefined): DvtNodeState {
    if (raw === null || typeof raw !== 'object') {
        throw new Error(`dvt node_state: expected an object, got ${raw === null ? 'null' : typeof raw}`);
    }
    if (raw.publicKey === undefined && raw.publicKeyEip2537 === undefined) {
        throw new Error('dvt node_state: has neither publicKey nor publicKeyEip2537');
    }

    // Normalise to the 128-byte wire form. encodeG1Point accepts the compressed 48-byte key and the
    // already-expanded 128-byte one, so both board layouts land on the same value.
    const source = raw.publicKeyEip2537 !== undefined
        ? asHex(raw.publicKeyEip2537, 'publicKeyEip2537')
        : asHex(raw.publicKey, 'publicKey');
    let publicKey: Hex;
    try {
        publicKey = encodeG1Point(source);
    } catch (error) {
        throw new Error(`dvt node_state: publicKey is not a valid BLS G1 point — ${(error as Error).message}`);
    }

    // When a board records BOTH forms, they must describe the same key. Skipping this would let a
    // state whose two fields disagree pick whichever field this function happens to read first.
    if (raw.publicKeyEip2537 !== undefined && raw.publicKey !== undefined) {
        const fromCompressed = encodeG1Point(asHex(raw.publicKey, 'publicKey'));
        if (fromCompressed.toLowerCase() !== publicKey.toLowerCase()) {
            throw new Error(
                'dvt node_state: publicKey and publicKeyEip2537 describe DIFFERENT keys ' +
                `(${fromCompressed} vs ${publicKey}). One of them is stale; this cannot be resolved here.`,
            );
        }
    }

    const nodeId = dvtNodeId(publicKey);
    if (raw.nodeId !== undefined) {
        const recorded = asHex(raw.nodeId, 'nodeId');
        if (size(recorded) !== 32) {
            throw new Error(`dvt node_state: nodeId must be 32 bytes, got ${size(recorded)}`);
        }
        if (recorded.toLowerCase() !== nodeId.toLowerCase()) {
            throw new Error(
                `dvt node_state: recorded nodeId ${recorded} != keccak256(publicKey) ${nodeId}. ` +
                'Registering the derived id would bind a node the running process does not serve — ' +
                'the transaction would SUCCEED and the node would silently never participate. ' +
                'Fix the state file (or the key) before onboarding; do not pick one.',
            );
        }
    }

    // `=== undefined` treated a JSON `null` — the idiomatic way a board writes "no key here" — as
    // "this node HAS a local key", which routes a key-less TEE node into `buildDvtPop` instead of
    // the KMS `/pop` signer (#367 review found it by value table: null / "" / 0 all read as
    // key-bearing). null and undefined are both absent.
    //
    // A value that is PRESENT but not a usable key is neither: it is a malformed state file, and
    // guessing which way to route it would pick a side of an ambiguity the file itself did not
    // resolve. Same stance as the nodeId mismatch above — say so, do not choose.
    if (raw.privateKey !== undefined && raw.privateKey !== null) {
        if (typeof raw.privateKey !== 'string' || raw.privateKey.length === 0) {
            throw new Error(
                'dvt node_state: privateKey is present but is not a non-empty string ' +
                `(got ${raw.privateKey === '' ? 'an empty string' : typeof raw.privateKey}). ` +
                'Absent means key-less (PoP comes from the KMS TEE); a real key means local signing. ' +
                'This value is neither, and choosing one would route the node on a guess.',
            );
        }
    }
    return { publicKey, nodeId, keyless: raw.privateKey === undefined || raw.privateKey === null };
}
