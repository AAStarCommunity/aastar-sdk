import { type Hex, keccak256 } from 'viem';
import { dvtPopPoint, encodeG1Point, type DvtPop } from '@aastar/core';

/**
 * KMS-TEE Proof-of-Possession signer for a **key-less** DVT node — the CC-37 `/pop` contract.
 *
 * For a node whose BLS secret key never leaves the TEE, the SDK cannot run {@link buildDvtPop} locally.
 * KMS exposes `POST {url}/pop {node_id | publicKey} → {publicKey, popPoint, popSig}` where the TEE signs the
 * node's OWN 128-byte EIP-2537 public key (`popPoint = hashToCurve(publicKey, BLS_POP_DST)`, `popSig =
 * sk·popPoint`) — the caller supplies no message, so it is not a signing oracle. This returns a `popSigner`
 * callback you hand straight to {@link onboardDvtNode}.
 *
 * SECURITY / integrity: before trusting the response we recompute `popPoint` from the returned `publicKey`
 * with {@link dvtPopPoint} (no secret needed — it is a public deterministic hash) and reject a mismatch,
 * so a compromised/incorrect KMS cannot slip in a wrong `popPoint`. The on-chain `_verifyPoP` pairing then
 * gates `popSig`. `nodeId` is derived locally as `keccak256(publicKey)` (never taken from the response).
 */
export interface KmsPopSignerOptions {
    /** KMS base URL, e.g. `http://127.0.0.1:3100` (board loopback) — `/pop` is appended. */
    url: string;
    /** KMS-side node identifier the TEE maps to its sealed key. Provide this OR {@link publicKey}. */
    nodeId?: string;
    /** The node's public key, if addressing `/pop` by key rather than node id. */
    publicKey?: Hex;
    /** `X-Signer-Token` (same token as the KMS BLS `/sign`), if the endpoint requires it. */
    token?: string;
    /** Injected fetch (tests / non-browser runtimes). Defaults to the global `fetch`. */
    fetchImpl?: typeof fetch;
    /** Recompute `popPoint` from `publicKey` and reject a mismatch. Default `true`; do not disable in prod. */
    verifyPopPoint?: boolean;
}

interface KmsPopResponse {
    publicKey: Hex;
    popPoint: Hex;
    popSig: Hex;
}

/** Build a `popSigner` for {@link onboardDvtNode} that fetches a PoP from the KMS-TEE `/pop` endpoint. */
export function kmsPopSigner(opts: KmsPopSignerOptions): () => Promise<DvtPop> {
    if (!opts.url) throw new Error('kmsPopSigner: url is required');
    if (!opts.nodeId && !opts.publicKey) throw new Error('kmsPopSigner: provide nodeId or publicKey');
    const doFetch = opts.fetchImpl ?? globalThis.fetch;
    if (!doFetch) throw new Error('kmsPopSigner: no fetch implementation available (pass opts.fetchImpl)');

    return async () => {
        const body = opts.nodeId ? { node_id: opts.nodeId } : { publicKey: opts.publicKey };
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
        // Normalize/validate the pubkey to canonical 128-byte EIP-2537 (throws on a malformed blob).
        const publicKey = encodeG1Point(j.publicKey);
        // Client-side cross-check: popPoint MUST equal hashToCurve(publicKey, BLS_POP_DST). No sk needed.
        if (opts.verifyPopPoint !== false) {
            const expected = dvtPopPoint(publicKey);
            if (expected.toLowerCase() !== j.popPoint.toLowerCase()) {
                throw new Error(
                    'kmsPopSigner: KMS popPoint != hashToCurve(publicKey, BLS_POP_DST) — refusing to submit ' +
                    '(KMS PoP is inconsistent with the SDK golden convention).',
                );
            }
        }
        // nodeId is derived locally, never trusted from the response.
        return { publicKey, popPoint: j.popPoint, popSig: j.popSig, nodeId: keccak256(publicKey) };
    };
}
