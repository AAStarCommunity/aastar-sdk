import type { Hex } from "viem";

import { DVT_CONFIG } from "../dvt.js";

/**
 * A DVT signer node: its public `/signature/sign` endpoint and its on-chain-registered
 * `bytes32` nodeId (registered on the chain's `AAStarBLSAlgorithm` verifier).
 *
 * @module
 */
export interface DVTNode {
    /** Base URL of the node (POST `{url}/signature/sign` with `{ userOp, ownerAuth }`). */
    url: string;
    /**
     * The node's `bytes32` nodeId, as registered on the validator's `AAStarBLSAlgorithm`.
     *
     * TREAT AS OPAQUE. On where it comes from, measured on Sepolia: `registerPublicKey` takes the
     * nodeId as an argument, but that path reverts with "Staking on: use registerWithProof" while
     * `requireStake()` is `true` — and `registerWithProof` derives `nodeId = keccak256(pubkey)`.
     * So the ids below are derived, and match `keccak256` of the 128-byte EIP-2537 G1 blob.
     *
     * The derivation is therefore a property of a GOVERNANCE FLAG, not of the interface: flipping
     * `requireStake` to `false` reopens the argument-shaped path and with it the possibility of one
     * key under two ids (FU-34, FU-16). Nothing in this repo watches that flag.
     *
     * The live co-sign path reads nodeIds DYNAMICALLY (from the `/signature/sign` response and the
     * `/gossip/peers` roster), so a re-registration is transparent to aggregation; this value is
     * only a discovery-free default.
     */
    nodeId: Hex;
}

/**
 * AAStar's default, always-on **testnet** DVT signer nodes, keyed by chainId.
 *
 * FU-12: DERIVED from {@link DVT_CONFIG}, not a second copy of it. These two lists used to be
 * independent literals holding the same three URLs and ids — a duplicated source of truth whose
 * halves nothing compared, so they could drift apart silently and the only symptom would have been
 * an operation failing against nodes one of them still believed in.
 *
 * The `sepolia` environment is named explicitly rather than going through `getDvtConfig()`, and
 * that is a deliberate difference in meaning, not an oversight: this export is keyed by CHAIN and
 * answers "what are the published always-on nodes for chain N", while `getDvtConfig()` answers
 * "which nodes should THIS RUN talk to" and honours `AASTAR_DVT_ENV`. A caller who wants the
 * local mirror wants the second function; wiring the env switch in here would silently redirect
 * every consumer of a chain-keyed lookup.
 *
 * On-chain verified: a 3-node co-sign → `validate(userOpHash, proof) === 0`, with fail-closed `403`
 * on a bad `ownerAuth`. Source of truth upstream:
 * `YetAnotherAA-Validator/deploy/sdk-dvt-config.testnet.json`.
 *
 * Conventions for these nodes: `userOpHash = EntryPoint.getUserOpHash(PackedUserOp)`;
 * `ownerAuth` is a TAG-prefixed owner authorization the DVT (v1.7+) forwards to
 * `account.isValidOwnerAuth(userOpHash, ownerAuth)` (airaccount-contract v0.23.0, #159/#257/#261):
 * tag `0x01` = 65-byte EIP-191 ECDSA over userOpHash; tag `0x02` = device-passkey WebAuthn blob
 * (P256-verified against the account's `p256KeyX/Y`). Proof wire = EIP-2537 (matches {@link encodeDVTVerifierProof}).
 * Mandatory-BLS account: guard-enabled + `approvedAlgIds = [0x01]`.
 */
export const DEFAULT_DVT_NODES: Readonly<Record<number, readonly DVTNode[]>> = Object.freeze({
    [DVT_CONFIG.environments.sepolia!.chainId]: Object.freeze(
        DVT_CONFIG.environments.sepolia!.dvtNodes.map(
            (n): DVTNode => Object.freeze({ url: n.url, nodeId: n.nodeId as Hex }),
        ),
    ),
});

/**
 * The default always-on DVT signer nodes for a chain, or an empty array if none are published
 * for that chainId. Sepolia (11155111) returns AAStar's 3 beta-test nodes.
 */
export function getDefaultDvtNodes(chainId: number): readonly DVTNode[] {
    return DEFAULT_DVT_NODES[chainId] ?? [];
}
