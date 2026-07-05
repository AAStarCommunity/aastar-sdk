import type { Hex } from "viem";

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
     * TREAT AS OPAQUE. Since YetAnotherAA-Validator #165, staked registration derives
     * `nodeId = keccak256(pubkey)`. The live co-sign path reads nodeIds DYNAMICALLY (from the
     * `/signature/sign` response and the `/gossip/peers` roster), so a re-registration is
     * transparent to aggregation — this hardcoded value is only a discovery-free default and
     * MUST be refreshed once operators re-register (until then it tracks the current live nodes).
     */
    nodeId: Hex;
}

/**
 * AAStar's default, always-on **testnet** DVT signer nodes, keyed by chainId.
 *
 * Sepolia (11155111): the 3 production-key nodes behind AAStar's Cloudflare named tunnel,
 * each registered on the v0.20.0 validator `AAStarBLSAlgorithm`
 * (`0x539B9681aFd5BFbCaa655Fe4c6BdcFe1fa7864bC` = `CANONICAL_ADDRESSES[11155111].aaStarBLSAlgorithm`, the v0.27.0 DVT validator).
 * These are AAStar's **beta-test** nodes with INDEPENDENT secret keys (NOT the public `BLS_TEST`
 * fixtures). On-chain verified: a 3-node co-sign → `validate(userOpHash, proof) === 0`, with
 * fail-closed `403` on a bad `ownerAuth`. Source of truth:
 * `YetAnotherAA-Validator/deploy/sdk-dvt-config.testnet.json`.
 *
 * Conventions for these nodes: `userOpHash = EntryPoint.getUserOpHash(PackedUserOp)`;
 * `ownerAuth` is a TAG-prefixed owner authorization the DVT (v1.7+) forwards to
 * `account.isValidOwnerAuth(userOpHash, ownerAuth)` (airaccount-contract v0.23.0, #159/#257/#261):
 * tag `0x01` = 65-byte EIP-191 ECDSA over userOpHash; tag `0x02` = device-passkey WebAuthn blob
 * (P256-verified against the account's `p256KeyX/Y`). Proof wire = EIP-2537 (matches {@link encodeDVTVerifierProof}).
 * Mandatory-BLS account: guard-enabled + `approvedAlgIds = [0x01]`.
 */
export const DEFAULT_DVT_NODES: Readonly<Record<number, readonly DVTNode[]>> = {
    // Sepolia — AAStar always-on testnet DVT (airaccount-contract v0.20.0).
    11155111: [
        { url: "https://dvt1.aastar.io", nodeId: "0x2df775b934046ddd210828fb5096ea8a15bb18a145dae5bd94535375c319c53f" },
        { url: "https://dvt2.aastar.io", nodeId: "0xd907ad728a7091c5cc628d9c7c71ae8d69f062a39533a2890bea3c299bacd201" },
        { url: "https://dvt3.aastar.io", nodeId: "0xd4f954361cdb2b2d89a631c939b6f930de5b2c5753911d2be7fb1ecc9f17a60e" },
    ],
} as const;

/**
 * The default always-on DVT signer nodes for a chain, or an empty array if none are published
 * for that chainId. Sepolia (11155111) returns AAStar's 3 beta-test nodes.
 */
export function getDefaultDvtNodes(chainId: number): readonly DVTNode[] {
    return DEFAULT_DVT_NODES[chainId] ?? [];
}
