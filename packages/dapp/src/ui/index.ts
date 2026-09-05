/**
 * Browser-side DVT node registration (CC-38's UI half).
 *
 * ## What was here before, and why it could never work
 *
 * This file exported `DVTClient.registerValidator`, which called `registerValidator(bytes)` through
 * a `parseAbi` literal written by hand. **That function does not exist on any contract in this
 * repository.** Measured against every ABI under `packages/core/src/abis/`:
 *
 * ```
 * registerValidator(bytes)                  → exists nowhere (0 hits across 52 ABIs)
 * signProposal(uint256,bytes)               → exists nowhere (0 hits across 52 ABIs)
 * createProposal(address,uint8,string)      → EXISTS. DVTValidator declares two overloads,
 *                                             0x8e24bc9a (3 params) and 0x2dcc352b (4 params)
 * ```
 *
 * **Correction, #381 review.** An earlier version of this comment said all three were wrong. The
 * third one is real — and the way I got it wrong is the same hazard this whole file is about: my
 * audit script kept ONE signature per function name, so it saw the four-parameter overload and
 * reported a mismatch. **An extractor that collapses overloads is blind to exactly the case where
 * one name has two selectors**, which is the shape that cost a day elsewhere in this repo
 * (`guardianSlashCases`, #362).
 *
 * It was still dead weight here: `createProposal` was declared in the literal and never called by
 * any method on the class. Two invented names and one unused real one.
 *
 * The real registration entry points are
 * `registerWithProof(bytes,bytes,bytes)` (staked path) and `registerPublicKey(bytes32,bytes)`
 * (bootstrap, unreachable on every environment we run — `requireStake()` is true).
 *
 * ## Why it survived, which is the part worth keeping
 *
 * Two independent covers, and **neither is a lapse of attention**:
 *
 * 1. The repo bans hand-written ABIs (`.eslintrc.js` forbids importing `parseAbi` from viem), and
 *    `packages/airaccount` carries `eslint-disable` lines with justifications where it genuinely
 *    needs one. This file had no disable comment because **the rule never ran on it**: no package
 *    in this monorepo defines a `lint` script, so `pnpm -r lint` is a repo-wide no-op. The CI
 *    comment already documents that honestly — it just means the ban protects nothing by default.
 *
 * 2. Its only caller, `scripts/20_sdk_full_capability.ts`, wrapped the call in try/catch and printed
 *    `DVT Call Reached (Reverted as expected for dummy key)`. **It prints that whether the function
 *    exists or not.** A missing selector and a rejected key both arrive as a revert, and the script
 *    reported the first as evidence of the second. Success and failure produced the same output.
 *
 * @module
 */
import type { Address, Hex, WalletClient } from 'viem';
import { AAStarBLSAlgorithmABI } from '@aastar/core';

/**
 * The proof-of-possession tuple `registerWithProof` binds.
 *
 * Structurally `DvtPop` from `@aastar/core`, restated here so this module does not force a value
 * import on consumers that only need the shape.
 */
export interface DvtRegistrationProof {
    /** BLS G1 public key, EIP-2537 128-byte form. */
    publicKey: Hex;
    popPoint: Hex;
    popSig: Hex;
}

export class DVTClient {
    /**
     * Register a DVT node from the browser.
     *
     * **The PoP is an input, not something this can build.** A browser has no BLS secret: on a
     * local-key node the proof comes from the operator's tooling (`buildDvtPop`), and on the
     * recommended KMS-TEE deployment the secret never leaves the enclave, so it comes from the
     * KMS `/pop` endpoint (`kmsPopSigner`). Taking the tuple as a parameter is what makes both
     * deployments reachable from the same page.
     *
     * `nodeId` is derived on chain as `keccak256(publicKey)`; there is nothing to pass for it, and
     * nothing to get wrong here. Registering a key the running node does not hold **succeeds** —
     * see `parseDvtNodeState` in `@aastar/core`, which is where that cross-check belongs (the
     * caller should have run it before reaching this screen).
     *
     * The operator must already hold ROLE_DVT stake; `@aastar/operator`'s `onboardDvtNode` is the
     * server-side workflow that arranges that. This is deliberately only the final transaction.
     */
    static async registerWithProof(
        wallet: WalletClient,
        validator: Address,
        proof: DvtRegistrationProof,
    ) {
        if (!wallet.account) throw new Error('DVTClient.registerWithProof: wallet has no account bound');
        return wallet.writeContract({
            address: validator,
            abi: AAStarBLSAlgorithmABI,
            functionName: 'registerWithProof',
            args: [proof.publicKey, proof.popPoint, proof.popSig],
            account: wallet.account,
            chain: wallet.chain,
        } as never);
    }
}
