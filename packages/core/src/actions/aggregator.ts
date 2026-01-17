import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { BLSAggregatorABI } from '../abis/index.js';

export type AggregatorActions = {
    // BLS Public Key Management
    registerBLSPublicKey: (args: { address: Address, publicKey: Hex, account?: Account | Address }) => Promise<Hash>;
    blsPublicKeys: (args: { address: Address, validator: Address }) => Promise<{ publicKey: Hex, registered: boolean }>;
    
    // Threshold Management
    setBLSThreshold: (args: { address: Address, threshold: number, account?: Account | Address }) => Promise<Hash>;
    getBLSThreshold: (args: { address: Address }) => Promise<bigint>;
    setDefaultThreshold: (args: { address: Address, newThreshold: bigint, account?: Account | Address }) => Promise<Hash>;
    setMinThreshold: (args: { address: Address, newThreshold: bigint, account?: Account | Address }) => Promise<Hash>;
    defaultThreshold: (args: { address: Address }) => Promise<bigint>;
    minThreshold: (args: { address: Address }) => Promise<bigint>;
    
    // Proposal & Execution
    executeProposal: (args: { address: Address, proposalId: bigint, target: Address, callData: Hex, requiredThreshold: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    verifyAndExecute: (args: { address: Address, proposalId: bigint, operator: Address, slashLevel: number, repUsers: Address[], newScores: bigint[], epoch: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    executedProposals: (args: { address: Address, proposalId: bigint }) => Promise<boolean>;
    proposalNonces: (args: { address: Address, proposalId: bigint }) => Promise<bigint>;
    
    // Aggregated Signatures
    aggregatedSignatures: (args: { address: Address, index: bigint }) => Promise<{ signature: Hex, messageHash: Hex, timestamp: bigint, verified: boolean }>;
    
    // Registry & SuperPaymaster
    setDVTValidator: (args: { address: Address, dv: Address, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymaster: (args: { address: Address, sp: Address, account?: Account | Address }) => Promise<Hash>;
    DVT_VALIDATOR: (args: { address: Address }) => Promise<Address>;
    SUPERPAYMASTER: (args: { address: Address }) => Promise<Address>;
    REGISTRY: (args: { address: Address }) => Promise<Address>;
    
    // Constants
    MAX_VALIDATORS: (args: { address: Address }) => Promise<bigint>;
    
    // Ownership
    owner: (args: { address: Address }) => Promise<Address>;
    transferOwnership: (args: { address: Address, newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { address: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Version
    version: (args: { address: Address }) => Promise<string>;
};

export const aggregatorActions = () => (client: PublicClient | WalletClient): AggregatorActions => ({
    // BLS Public Key Management
    async registerBLSPublicKey({ address, publicKey, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'registerBLSPublicKey',
            args: [publicKey],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async blsPublicKeys({ address, validator }) {
        const result = await (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'blsPublicKeys',
            args: [validator]
        }) as any;
        return { publicKey: result[0], registered: result[1] };
    },

    // Threshold Management
    async setBLSThreshold({ address, threshold, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'setThreshold',
            args: [BigInt(threshold)],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getBLSThreshold({ address }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'threshold',
            args: []
        }) as Promise<bigint>;
    },

    async setDefaultThreshold({ address, newThreshold, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'setDefaultThreshold',
            args: [newThreshold],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setMinThreshold({ address, newThreshold, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'setMinThreshold',
            args: [newThreshold],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async defaultThreshold({ address }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'defaultThreshold',
            args: []
        }) as Promise<bigint>;
    },

    async minThreshold({ address }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'minThreshold',
            args: []
        }) as Promise<bigint>;
    },

    // Proposal & Execution
    async executeProposal({ address, proposalId, target, callData, requiredThreshold, proof, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'executeProposal',
            args: [proposalId, target, callData, requiredThreshold, proof],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async verifyAndExecute({ address, proposalId, operator, slashLevel, repUsers, newScores, epoch, proof, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'verifyAndExecute',
            args: [proposalId, operator, slashLevel, repUsers, newScores, epoch, proof],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async executedProposals({ address, proposalId }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'executedProposals',
            args: [proposalId]
        }) as Promise<boolean>;
    },

    async proposalNonces({ address, proposalId }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'proposalNonces',
            args: [proposalId]
        }) as Promise<bigint>;
    },

    // Aggregated Signatures
    async aggregatedSignatures({ address, index }) {
        const result = await (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'aggregatedSignatures',
            args: [index]
        }) as any;
        return {
            signature: result[0],
            messageHash: result[1],
            timestamp: result[2],
            verified: result[3]
        };
    },

    // Registry & SuperPaymaster
    async setDVTValidator({ address, dv, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'setDVTValidator',
            args: [dv],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setSuperPaymaster({ address, sp, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'setSuperPaymaster',
            args: [sp],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async DVT_VALIDATOR({ address }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'DVT_VALIDATOR',
            args: []
        }) as Promise<Address>;
    },

    async SUPERPAYMASTER({ address }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'SUPERPAYMASTER',
            args: []
        }) as Promise<Address>;
    },

    async REGISTRY({ address }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'REGISTRY',
            args: []
        }) as Promise<Address>;
    },

    // Constants
    async MAX_VALIDATORS({ address }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'MAX_VALIDATORS',
            args: []
        }) as Promise<bigint>;
    },

    // Ownership
    async owner({ address }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async transferOwnership({ address, newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async renounceOwnership({ address, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'renounceOwnership',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Version
    async version({ address }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    }
});
