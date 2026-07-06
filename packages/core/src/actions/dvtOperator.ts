import { type Account, type Address, type Hash, type Hex, type PublicClient, type WalletClient, isHex, size } from 'viem';
import { AAStarBLSAlgorithmABI } from '../abis/index.js';
import { buildDvtPop, type DvtPop } from '../crypto/dvtPop.js';
import { validateAddress, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

/**
 * A registered DVT node, as returned by the paginated `getRegisteredNodes(offset, limit)` reader.
 */
export interface DvtRegisteredNode {
    /** `bytes32` nodeId = `keccak256(publicKey)`. */
    nodeId: Hex;
    /** The node's G1 public key in 128-byte EIP-2537 layout. */
    publicKey: Hex;
}

/**
 * Operator-facing actions for the DVT node registry on
 * {@link https://github.com/AAStarCommunity/YetAnotherAA-Validator | AAStarBLSAlgorithm}
 * (source `AAStarValidator.sol`, the DVT validator, Sepolia `0x539B9681…`) — the
 * staked, self-service registration path (YetAnotherAA-Validator #165).
 *
 * The write path is `registerWithProof(publicKey, popPoint, popSig)`, gated on-chain by:
 * `requireStake == true`, the caller holding **ROLE_DVT** stake (checked via the linked
 * GTokenStaking registry), a non-infinity pubkey, a valid Proof-of-Possession, and the derived
 * `nodeId = keccak256(publicKey)` / caller not already bound to a node. Use {@link DvtOperatorActions.register}
 * to build the PoP from a secret key and submit in one call, or {@link DvtOperatorActions.registerWithProof}
 * to submit a pre-built tuple (e.g. when the key lives in an HSM and the PoP is produced elsewhere).
 */
export type DvtOperatorActions = {
    /**
     * Build the PoP tuple from `blsSecretKey` (via {@link buildDvtPop}) and submit `registerWithProof`.
     * Returns both the tx `Hash` and the derived `nodeId` so callers can track the binding without
     * re-deriving it. Requires a WalletClient whose account holds ROLE_DVT stake.
     */
    register: (args: { blsSecretKey: Hex, account?: Account | Address }) => Promise<{ hash: Hash, pop: DvtPop }>;
    /**
     * Submit a pre-built PoP tuple. ABI: `registerWithProof(bytes publicKey, bytes popPoint, bytes popSig)`.
     * `publicKey` is a 128-byte EIP-2537 G1 point; `popPoint`/`popSig` are 256-byte EIP-2537 G2 points
     * (see {@link buildDvtPop} for the construction). State-changing → resolves to the tx `Hash`.
     */
    registerWithProof: (args: { publicKey: Hex, popPoint: Hex, popSig: Hex, account?: Account | Address }) => Promise<Hash>;
    /**
     * Re-derive and cache the aggregated-key set for a node after roster changes.
     * ABI: `syncNode(bytes32 nodeId)`.
     */
    syncNode: (args: { nodeId: Hex, account?: Account | Address }) => Promise<Hash>;

    // ---- reads ----
    /** `isRegistered(bytes32 nodeId) -> bool`. */
    isRegistered: (args: { nodeId: Hex }) => Promise<boolean>;
    /** `nodeOperator(bytes32 nodeId) -> address` — the operator bound to a node (zero if none). */
    nodeOperator: (args: { nodeId: Hex }) => Promise<Address>;
    /** `operatorNode(address operator) -> bytes32` — the node an operator owns (zero if none). */
    operatorNode: (args: { operator: Address }) => Promise<Hex>;
    /** `registeredKeys(bytes32 nodeId) -> bytes` — the stored 128-byte EIP-2537 G1 pubkey. */
    registeredKeys: (args: { nodeId: Hex }) => Promise<Hex>;
    /**
     * Paginated roster. ABI: `getRegisteredNodes(uint256 offset, uint256 limit) -> (bytes32[], bytes[])`.
     * Returns `{ nodeId, publicKey }` pairs zipped from the two parallel arrays. The contract reverts
     * with "Offset out of bounds" when `offset >= count` (including an empty validator at offset 0);
     * this helper reads the count first and returns `[]` for an out-of-range page instead of throwing.
     */
    getRegisteredNodes: (args?: { offset?: bigint, limit?: bigint }) => Promise<DvtRegisteredNode[]>;
    /** `getRegisteredNodeCount() -> uint256` — number of registered nodes. */
    getRegisteredNodeCount: () => Promise<bigint>;
    /** `requireStake() -> bool` — whether the staked-registration path is enabled. */
    requireStake: () => Promise<boolean>;
    /** `minStake() -> uint256` — the ROLE_DVT stake floor enforced at registration. */
    minStake: () => Promise<bigint>;
};

const ABI = AAStarBLSAlgorithmABI;

/** G1 public key EIP-2537 byte length the contract enforces (`require(publicKey.length == 128)`). */
const G1_POINT_LENGTH = 128;
/** G2 point EIP-2537 byte length the contract enforces on popPoint/popSig (`length == 256`). */
const G2_POINT_LENGTH = 256;

/** Assert a hex value is exactly `expected` bytes, matching the contract's on-chain length guards. */
function assertHexLength(value: Hex, expected: number, name: string): void {
    if (!isHex(value) || size(value) !== expected) {
        throw new Error(
            `dvtOperator.registerWithProof: ${name} must be a ${expected}-byte EIP-2537 hex value, ` +
            `got ${isHex(value) ? `${size(value)} bytes` : 'non-hex'} — the contract reverts on a mismatched length`
        );
    }
}

export const dvtOperatorActions =
    (address: Address) =>
    (client: PublicClient | WalletClient): DvtOperatorActions => ({
        async register({ blsSecretKey, account }) {
            try {
                validateRequired(blsSecretKey, 'blsSecretKey');
                const pop = buildDvtPop(blsSecretKey);
                const hash = await (client as any).writeContract({
                    address,
                    abi: ABI,
                    functionName: 'registerWithProof',
                    args: [pop.publicKey, pop.popPoint, pop.popSig],
                    account: account as any,
                    chain: (client as any).chain,
                });
                return { hash, pop };
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'register');
            }
        },

        async registerWithProof({ publicKey, popPoint, popSig, account }) {
            try {
                validateRequired(publicKey, 'publicKey');
                validateRequired(popPoint, 'popPoint');
                validateRequired(popSig, 'popSig');
                // Fail fast on malformed EIP-2537 lengths — the contract's require()s would otherwise
                // revert on-chain (128-byte G1 pubkey, 256-byte G2 popPoint/popSig).
                assertHexLength(publicKey, G1_POINT_LENGTH, 'publicKey');
                assertHexLength(popPoint, G2_POINT_LENGTH, 'popPoint');
                assertHexLength(popSig, G2_POINT_LENGTH, 'popSig');
                return await (client as any).writeContract({
                    address,
                    abi: ABI,
                    functionName: 'registerWithProof',
                    args: [publicKey, popPoint, popSig],
                    account: account as any,
                    chain: (client as any).chain,
                });
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'registerWithProof');
            }
        },

        async syncNode({ nodeId, account }) {
            try {
                validateRequired(nodeId, 'nodeId');
                return await (client as any).writeContract({
                    address,
                    abi: ABI,
                    functionName: 'syncNode',
                    args: [nodeId],
                    account: account as any,
                    chain: (client as any).chain,
                });
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'syncNode');
            }
        },

        async isRegistered({ nodeId }) {
            try {
                validateRequired(nodeId, 'nodeId');
                return await (client as PublicClient).readContract({
                    address, abi: ABI, functionName: 'isRegistered', args: [nodeId],
                }) as boolean;
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'isRegistered');
            }
        },

        async nodeOperator({ nodeId }) {
            try {
                validateRequired(nodeId, 'nodeId');
                return await (client as PublicClient).readContract({
                    address, abi: ABI, functionName: 'nodeOperator', args: [nodeId],
                }) as Address;
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'nodeOperator');
            }
        },

        async operatorNode({ operator }) {
            try {
                validateAddress(operator, 'operator');
                return await (client as PublicClient).readContract({
                    address, abi: ABI, functionName: 'operatorNode', args: [operator],
                }) as Hex;
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'operatorNode');
            }
        },

        async registeredKeys({ nodeId }) {
            try {
                validateRequired(nodeId, 'nodeId');
                return await (client as PublicClient).readContract({
                    address, abi: ABI, functionName: 'registeredKeys', args: [nodeId],
                }) as Hex;
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'registeredKeys');
            }
        },

        async getRegisteredNodes(args) {
            try {
                const offset = args?.offset ?? 0n;
                const limit = args?.limit ?? 100n;
                // The contract reverts on `offset >= count` (incl. an empty validator at offset 0), so
                // read the count first and short-circuit an out-of-range page to [] rather than throwing.
                const count = await (client as PublicClient).readContract({
                    address, abi: ABI, functionName: 'getRegisteredNodeCount', args: [],
                }) as bigint;
                if (offset >= count) return [];
                const [nodeIds, publicKeys] = await (client as PublicClient).readContract({
                    address, abi: ABI, functionName: 'getRegisteredNodes', args: [offset, limit],
                }) as [readonly Hex[], readonly Hex[]];
                return nodeIds.map((nodeId, i) => ({ nodeId, publicKey: publicKeys[i] }));
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'getRegisteredNodes');
            }
        },

        async getRegisteredNodeCount() {
            try {
                return await (client as PublicClient).readContract({
                    address, abi: ABI, functionName: 'getRegisteredNodeCount', args: [],
                }) as bigint;
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'getRegisteredNodeCount');
            }
        },

        async requireStake() {
            try {
                return await (client as PublicClient).readContract({
                    address, abi: ABI, functionName: 'requireStake', args: [],
                }) as boolean;
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'requireStake');
            }
        },

        async minStake() {
            try {
                return await (client as PublicClient).readContract({
                    address, abi: ABI, functionName: 'minStake', args: [],
                }) as bigint;
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'minStake');
            }
        },
    });
