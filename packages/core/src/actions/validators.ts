import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { DVTValidatorABI, BLSAggregatorABI } from '../abis/index.js';

// DVT Validator Actions (完整 11 个函数)
export type DVTActions = {
    createProposal: (args: { target: Address, calldata: Hex, description: string, account?: Account | Address }) => Promise<Hash>;
    signProposal: (args: { proposalId: bigint, account?: Account | Address }) => Promise<Hash>;
    executeWithProof: (args: { proposalId: bigint, signatures: Hex[], account?: Account | Address }) => Promise<Hash>;
    cancelProposal: (args: { proposalId: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Validator 管理
    isValidator: (args: { validator: Address }) => Promise<boolean>;
    addValidator: (args: { validator: Address, account?: Account | Address }) => Promise<Hash>;
    removeValidator: (args: { validator: Address, account?: Account | Address }) => Promise<Hash>;
    getValidators: () => Promise<Address[]>;
    getValidatorCount: () => Promise<bigint>;
    
    // Proposal 查询
    getProposal: (args: { proposalId: bigint }) => Promise<any>;
    getProposalCount: () => Promise<bigint>;
    getProposalState: (args: { proposalId: bigint }) => Promise<number>;
    getSignatureCount: (args: { proposalId: bigint }) => Promise<bigint>;
    hasVoted: (args: { proposalId: bigint, validator: Address }) => Promise<boolean>;
    proposals: (args: { proposalId: bigint }) => Promise<any>; // View
    nextProposalId: () => Promise<bigint>; // View
    
    // Threshold
    threshold: () => Promise<bigint>;
    setThreshold: (args: { newThreshold: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Admin
    setRegistry: (args: { registry: Address, account?: Account | Address }) => Promise<Hash>;
    setBLSAggregator: (args: { aggregator: Address, account?: Account | Address }) => Promise<Hash>;
    markProposalExecuted: (args: { proposalId: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Constants
    BLS_AGGREGATOR: () => Promise<Address>;
    
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    version: () => Promise<string>;
};

// BLSAggregator Actions (完整 15 个函数)
export type BLSAggregatorActions = {
    // 密钥注册
    registerBLSPublicKey: (args: { publicKey: Hex, account?: Account | Address }) => Promise<Hash>;
    deregisterBLSPublicKey: (args: { account?: Account | Address }) => Promise<Hash>;
    updatePublicKey: (args: { newKey: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // 签名聚合 & 执行
    aggregateSignatures: (args: { signatures: Hex[] }) => Promise<Hex>;
    verifyAggregatedSignature: (args: { message: Hex, aggregatedSignature: Hex, publicKeys: Hex[] }) => Promise<boolean>;
    validateSignature: (args: { message: Hex, signature: Hex, publicKey: Hex }) => Promise<boolean>;
    executeProposal: (args: { proposalId: bigint, signatures: Hex[], account?: Account | Address }) => Promise<Hash>; // Often via verifyAndExecute
    verifyAndExecute: (args: { proposalId: bigint, signatures: Hex[], account?: Account | Address }) => Promise<Hash>;
    
    // 公钥查询
    getPublicKey: (args: { address: Address }) => Promise<Hex>;
    getPublicKeys: (args: { addresses: Address[] }) => Promise<Hex[]>;
    getAggregatedPublicKey: (args: { addresses: Address[] }) => Promise<Hex>;
    isKeyRegistered: (args: { address: Address }) => Promise<boolean>;
    getRegisteredCount: () => Promise<bigint>;
    blsPublicKeys: (args: { address: Address }) => Promise<Hex[]>; // mapping view shim
    
    // Threshold
    threshold: () => Promise<bigint>;
    minThreshold: () => Promise<bigint>;
    defaultThreshold: () => Promise<bigint>;
    
    setThreshold: (args: { newThreshold: bigint, account?: Account | Address }) => Promise<Hash>;
    setMinThreshold: (args: { newThreshold: bigint, account?: Account | Address }) => Promise<Hash>;
    setDefaultThreshold: (args: { newThreshold: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Admin
    setRegistry: (args: { registry: Address, account?: Account | Address }) => Promise<Hash>;
    setDVTValidator: (args: { validator: Address, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymaster: (args: { paymaster: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    
    // Constants
    REGISTRY: () => Promise<Address>;
    DVT_VALIDATOR: () => Promise<Address>;
    SUPERPAYMASTER: () => Promise<Address>;
    MAX_VALIDATORS: () => Promise<bigint>;
    
    executedProposals: (args: { proposalId: bigint }) => Promise<boolean>;
    proposalNonces: (args: { proposalId: bigint }) => Promise<bigint>;
    
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    version: () => Promise<string>;
};

export const dvtActions = (address: Address) => (client: PublicClient | WalletClient): DVTActions => ({
    async createProposal({ target, calldata, description, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'createProposal',
            args: [target, calldata, description],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async signProposal({ proposalId, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'signProposal',
            args: [proposalId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async executeWithProof({ proposalId, signatures, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'executeWithProof',
            args: [proposalId, signatures],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async cancelProposal({ proposalId, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'cancelProposal',
            args: [proposalId],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async isValidator({ validator }) {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'isValidator',
            args: [validator]
        }) as Promise<boolean>;
    },

    async addValidator({ validator, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'addValidator',
            args: [validator],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async removeValidator({ validator, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'removeValidator',
            args: [validator],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getValidators() {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'getValidators',
            args: []
        }) as Promise<Address[]>;
    },

    async getValidatorCount() {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'getValidatorCount',
            args: []
        }) as Promise<bigint>;
    },

    async getProposal({ proposalId }) {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'getProposal',
            args: [proposalId]
        });
    },

    async getProposalCount() {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'getProposalCount',
            args: []
        }) as Promise<bigint>;
    },

    async getProposalState({ proposalId }) {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'getProposalState',
            args: [proposalId]
        }) as Promise<number>;
    },

    async getSignatureCount({ proposalId }) {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'getSignatureCount',
            args: [proposalId]
        }) as Promise<bigint>;
    },

    async hasVoted({ proposalId, validator }) {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'hasVoted',
            args: [proposalId, validator]
        }) as Promise<boolean>;
    },

    async proposals({ proposalId }) {
        return (client as PublicClient).readContract({ address, abi: DVTValidatorABI, functionName: 'proposals', args: [proposalId] }) as Promise<any>;
    },

    async nextProposalId() {
        return (client as PublicClient).readContract({ address, abi: DVTValidatorABI, functionName: 'nextProposalId', args: [] }) as Promise<bigint>;
    },

    async threshold() {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'threshold',
            args: []
        }) as Promise<bigint>;
    },

    async setThreshold({ newThreshold, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'setThreshold',
            args: [newThreshold],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setRegistry({ registry, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'setRegistry',
            args: [registry],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setBLSAggregator({ aggregator, account }) {
         return (client as any).writeContract({ address, abi: DVTValidatorABI, functionName: 'setBLSAggregator', args: [aggregator], account: account as any, chain: (client as any).chain });
    },

    async markProposalExecuted({ proposalId, account }) {
         return (client as any).writeContract({ address, abi: DVTValidatorABI, functionName: 'markProposalExecuted', args: [proposalId], account: account as any, chain: (client as any).chain });
    },

    async BLS_AGGREGATOR() {
        return (client as PublicClient).readContract({ address, abi: DVTValidatorABI, functionName: 'BLS_AGGREGATOR', args: [] }) as Promise<Address>;
    },

    async owner() {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async transferOwnership({ newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async renounceOwnership({ account }) {
        return (client as any).writeContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'renounceOwnership',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async version() {
        return (client as PublicClient).readContract({
            address,
            abi: DVTValidatorABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    }
});

export const blsActions = (address: Address) => (client: PublicClient | WalletClient): BLSAggregatorActions => ({
    async registerBLSPublicKey({ publicKey, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'registerBLSPublicKey',
            args: [publicKey],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async deregisterBLSPublicKey({ account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'deregisterBLSPublicKey',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async updatePublicKey({ newKey, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'updatePublicKey',
            args: [newKey],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async aggregateSignatures({ signatures }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'aggregateSignatures',
            args: [signatures]
        }) as Promise<Hex>;
    },

    async verifyAggregatedSignature({ message, aggregatedSignature, publicKeys }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'verifyAggregatedSignature',
            args: [message, aggregatedSignature, publicKeys]
        }) as Promise<boolean>;
    },

    async validateSignature({ message, signature, publicKey }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'validateSignature',
            args: [message, signature, publicKey]
        }) as Promise<boolean>;
    },

    async executeProposal({ proposalId, signatures, account }) {
         return (client as any).writeContract({ address, abi: BLSAggregatorABI, functionName: 'executeProposal', args: [proposalId, signatures], account: account as any, chain: (client as any).chain });
    },

    async verifyAndExecute({ proposalId, signatures, account }) {
         return (client as any).writeContract({ address, abi: BLSAggregatorABI, functionName: 'verifyAndExecute', args: [proposalId, signatures], account: account as any, chain: (client as any).chain });
    },

    async getPublicKey({ address: userAddress }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'getPublicKey',
            args: [userAddress]
        }) as Promise<Hex>;
    },

    async getPublicKeys({ addresses }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'getPublicKeys',
            args: [addresses]
        }) as Promise<Hex[]>;
    },

    async getAggregatedPublicKey({ addresses }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'getAggregatedPublicKey',
            args: [addresses]
        }) as Promise<Hex>;
    },

    async isKeyRegistered({ address: userAddress }) {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'isKeyRegistered',
            args: [userAddress]
        }) as Promise<boolean>;
    },

    async getRegisteredCount() {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'getRegisteredCount',
            args: []
        }) as Promise<bigint>;
    },

    async blsPublicKeys({ address: userAddress }) {
        return (client as PublicClient).readContract({ address, abi: BLSAggregatorABI, functionName: 'blsPublicKeys', args: [userAddress] }) as Promise<Hex[]>;
    },

    async threshold() {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'threshold',
            args: []
        }) as Promise<bigint>;
    },

    async minThreshold() {
        return (client as PublicClient).readContract({ address, abi: BLSAggregatorABI, functionName: 'minThreshold', args: [] }) as Promise<bigint>;
    },
    async defaultThreshold() {
        return (client as PublicClient).readContract({ address, abi: BLSAggregatorABI, functionName: 'defaultThreshold', args: [] }) as Promise<bigint>;
    },

    async setThreshold({ newThreshold, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'setThreshold',
            args: [newThreshold],
            account: account as any,
            chain: (client as any).chain
        });
    },
    
    async setMinThreshold({ newThreshold, account }) {
        return (client as any).writeContract({address, abi: BLSAggregatorABI, functionName: 'setMinThreshold', args: [newThreshold], account: account as any, chain: (client as any).chain });
    },
    async setDefaultThreshold({ newThreshold, account }) {
         return (client as any).writeContract({address, abi: BLSAggregatorABI, functionName: 'setDefaultThreshold', args: [newThreshold], account: account as any, chain: (client as any).chain });
    },

    async setRegistry({ registry, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'setRegistry',
            args: [registry],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setDVTValidator({ validator, account }) {
         return (client as any).writeContract({address, abi: BLSAggregatorABI, functionName: 'setDVTValidator', args: [validator], account: account as any, chain: (client as any).chain });
    },
    async setSuperPaymaster({ paymaster, account }) {
         return (client as any).writeContract({address, abi: BLSAggregatorABI, functionName: 'setSuperPaymaster', args: [paymaster], account: account as any, chain: (client as any).chain });
    },

    async renounceOwnership({ account }) {
         return (client as any).writeContract({address, abi: BLSAggregatorABI, functionName: 'renounceOwnership', args: [], account: account as any, chain: (client as any).chain });
    },

    async REGISTRY() {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'REGISTRY',
            args: []
        }) as Promise<Address>;
    },

    async DVT_VALIDATOR() {
        return (client as PublicClient).readContract({ address, abi: BLSAggregatorABI, functionName: 'DVT_VALIDATOR', args: [] }) as Promise<Address>;
    },
    async SUPERPAYMASTER() {
        return (client as PublicClient).readContract({ address, abi: BLSAggregatorABI, functionName: 'SUPERPAYMASTER', args: [] }) as Promise<Address>;
    },
    async MAX_VALIDATORS() {
        return (client as PublicClient).readContract({ address, abi: BLSAggregatorABI, functionName: 'MAX_VALIDATORS', args: [] }) as Promise<bigint>;
    },
    
    async executedProposals({ proposalId }) {
        return (client as PublicClient).readContract({ address, abi: BLSAggregatorABI, functionName: 'executedProposals', args: [proposalId] }) as Promise<boolean>;
    },
    async proposalNonces({ proposalId }) {
        return (client as PublicClient).readContract({ address, abi: BLSAggregatorABI, functionName: 'proposalNonces', args: [proposalId] }) as Promise<bigint>;
    },

    async owner() {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async transferOwnership({ newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async version() {
        return (client as PublicClient).readContract({
            address,
            abi: BLSAggregatorABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    }
});
