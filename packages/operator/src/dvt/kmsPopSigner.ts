import { type Hex, keccak256 } from 'viem';
import { dvtPopPoint, encodeG1Point, verifyDvtPop, type DvtPop } from '@aastar/core';

/**
 * KMS-TEE Proof-of-Possession signer for a **key-less** DVT node — the CC-37 `/pop` contract.
 *
 * For a node whose BLS secret key never leaves the TEE, the SDK cannot run {@link buildDvtPop} locally.
 * KMS exposes `POST {url}/pop {node_id | publicKey} → {publicKey, popPoint, popSig}` where the TEE signs the
 * node's OWN 128-byte EIP-2537 public key (`popPoint = hashToCurve(publicKey, BLS_POP_DST)`, `popSig =
 * sk·popPoint`) — the caller supplies no message, so it is not a signing oracle. This returns a `popSigner`
 * callback you hand straight to {@link onboardDvtNode}.
 *
 * ## Trust model — READ THIS
 * The node the operator will register is `nodeId = keccak256(publicKey)`, where `publicKey` comes from the
 * `/pop` RESPONSE. `_verifyPoP` (and {@link verifyDvtPop} here) only prove the responder knows the `sk`
 * behind THAT key — a compromised KMS or a MITM can return a self-consistent tuple for an ATTACKER'S key,
 * and the operator would stake + register the attacker's node. The ONLY defence is to **pin the expected
 * public key**: pass `publicKey`, and the signer rejects any response whose key differs. If you address by
 * `nodeId` alone (no `publicKey`), you are trusting the KMS's `node_id → key` mapping — acceptable only for
 * a KMS you fully control (e.g. your own board loopback). Prefer passing the node's known `publicKey`.
 *
 * On every response the signer additionally: normalizes/validates `publicKey` to 128-byte EIP-2537,
 * recomputes `popPoint = hashToCurve(publicKey, BLS_POP_DST)` and rejects a mismatch (enforces the RFC
 * convention), runs the {@link verifyDvtPop} pairing (points on-curve/non-infinity + `popSig = sk·popPoint`)
 * so a bad tuple fails HERE rather than after stake, and derives `nodeId` locally (never from the response).
 */
export interface KmsPopSignerOptions {
    /** KMS base URL, e.g. `http://127.0.0.1:3100` (board loopback) — `/pop` is appended. Treat as trusted config. */
    url: string;
    /** KMS-side node identifier the TEE maps to its sealed key. Provide this and/or {@link publicKey}. */
    nodeId?: string;
    /**
     * The node's EXPECTED public key. Strongly recommended: when set, the signer pins it and rejects a
     * response for any other key — the only defence against a KMS/MITM key substitution (see trust model).
     */
    publicKey?: Hex;
    /** `X-Signer-Token` (same token as the KMS BLS `/sign`), if the endpoint requires it. */
    token?: string;
    /** Injected fetch (tests / non-browser runtimes). Defaults to the global `fetch`. */
    fetchImpl?: typeof fetch;
}

interface KmsPopResponse {
    publicKey: Hex;
    popPoint: Hex;
    popSig: Hex;
}

/** Build a `popSigner` for {@link onboardDvtNode} that fetches a PoP from the KMS-TEE `/pop` endpoint. */
export function kmsPopSigner(opts: KmsPopSignerOptions): () => Promise<DvtPop> {
    if (!opts.url) throw new Error('kmsPopSigner: url is required');
    if (!opts.nodeId && !opts.publicKey) throw new Error('kmsPopSigner: provide nodeId and/or publicKey');
    const doFetch = opts.fetchImpl ?? globalThis.fetch;
    if (!doFetch) throw new Error('kmsPopSigner: no fetch implementation available (pass opts.fetchImpl)');
    // Normalize the pinned key once up front (throws on a malformed input).
    const pinnedKey = opts.publicKey ? encodeG1Point(opts.publicKey) : undefined;

    return async () => {
        const body: Record<string, string> = {};
        if (opts.nodeId) body.node_id = opts.nodeId;
        if (opts.publicKey) body.publicKey = opts.publicKey;
        const res = await doFetch(`${opts.url.replace(/\/$/, '')}/pop`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(opts.token ? { 'X-Signer-Token': opts.token } : {}) },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            throw new Error(`kmsPopSigner: KMS /pop returned HTTP ${res.status} (is the endpoint live? — CC-37)`);
        }
        const j = (await res.json()) as Partial<KmsPopResponse>;
        if (!j.publicKey || !j.popPoint || !j.popSig) {
            throw new Error('kmsPopSigner: KMS /pop response missing publicKey/popPoint/popSig');
        }
        // Normalize/validate the response pubkey to canonical 128-byte EIP-2537 (throws on a malformed blob).
        const publicKey = encodeG1Point(j.publicKey);

        // KEY PIN (the substitution defence): the response MUST be for the expected key, if one was given.
        if (pinnedKey && publicKey.toLowerCase() !== pinnedKey.toLowerCase()) {
            throw new Error(
                'kmsPopSigner: KMS /pop returned a different publicKey than the one pinned — refusing to submit ' +
                '(possible key substitution by a compromised KMS or MITM).',
            );
        }
        // Enforce the RFC convention: popPoint must be hashToCurve(publicKey, BLS_POP_DST). No secret needed.
        if (dvtPopPoint(publicKey).toLowerCase() !== j.popPoint.toLowerCase()) {
            throw new Error(
                'kmsPopSigner: KMS popPoint != hashToCurve(publicKey, BLS_POP_DST) — refusing to submit ' +
                '(KMS PoP is inconsistent with the SDK golden convention).',
            );
        }
        // Full pairing check (points valid + popSig = sk·popPoint) — fails HERE, before any stake/gas.
        verifyDvtPop({ publicKey, popPoint: j.popPoint, popSig: j.popSig });

        // nodeId is derived locally, never trusted from the response.
        return { publicKey, popPoint: j.popPoint, popSig: j.popSig, nodeId: keccak256(publicKey) };
    };
}
