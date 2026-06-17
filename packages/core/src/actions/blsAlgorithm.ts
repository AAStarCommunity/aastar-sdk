import { type Address, type Hex, type PublicClient, type WalletClient } from 'viem';
import { AAStarBLSAlgorithmABI } from '../abis/index.js';
import { validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

export type BLSAlgorithmActions = {
    // validate(bytes32 userOpHash, bytes proof) -> uint256: the on-chain DVT signature verifier.
    // Returns 0 when the combined-signature proof is ACCEPTED, non-zero when rejected.
    validate: (args: { userOpHash: Hex, proof: Hex }) => Promise<bigint>;
};

const ABI = AAStarBLSAlgorithmABI;

/**
 * AAStarBLSAlgorithm — the on-chain DVT combined-signature verifier. Pair with
 * `dvtWire.encodeDVTVerifierProof()` (which builds `proof`) to verify an SDK-assembled
 * DVT co-signature on-chain via the SDK rather than a hand-written ABI call.
 */
export const blsAlgorithmActions = (address: Address) => (client: PublicClient | WalletClient): BLSAlgorithmActions => ({
    async validate({ userOpHash, proof }) {
        try {
            validateRequired(userOpHash, 'userOpHash');
            validateRequired(proof, 'proof');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'validate', args: [userOpHash, proof],
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'validate');
        }
    },
});
