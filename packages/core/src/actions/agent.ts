import { type Address, type PublicClient, type WalletClient, type Hash, type Account } from 'viem';
import { SuperPaymasterABI } from '../abis/index.js';
import { validateAddress } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

export type AgentSponsorshipPolicy = {
    minReputationScore: bigint;
    sponsorshipBPS: bigint;
    maxDailyUSD: bigint;
};

export type AgentActions = {
    // View
    isRegisteredAgent: (args: { account: Address }) => Promise<boolean>;
    isEligibleForSponsorship: (args: { user: Address }) => Promise<boolean>;
    getAgentSponsorshipRate: (args: { agent: Address, operator: Address }) => Promise<bigint>;
    agentIdentityRegistry: () => Promise<Address>;
    agentReputationRegistry: () => Promise<Address>;
    agentPolicies: (args: { operator: Address, index: bigint }) => Promise<AgentSponsorshipPolicy>;

    // Admin
    setAgentPolicies: (args: { policies: AgentSponsorshipPolicy[], account?: Account | Address }) => Promise<Hash>;
    setAgentRegistries: (args: { identity: Address, reputation: Address, account?: Account | Address }) => Promise<Hash>;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const agentActions = (address: Address) => (client: PublicClient | WalletClient): AgentActions => {
    if (address === ZERO_ADDRESS) {
        throw new Error('Agent contracts are not deployed on this network');
    }
    return ({
    // --- View ---
    async isRegisteredAgent({ account: agentAddr }) {
        try {
            validateAddress(agentAddr, 'account');
            return await (client as PublicClient).readContract({
                address, abi: SuperPaymasterABI,
                functionName: 'isRegisteredAgent',
                args: [agentAddr]
            }) as boolean;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isRegisteredAgent');
        }
    },

    async isEligibleForSponsorship({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address, abi: SuperPaymasterABI,
                functionName: 'isEligibleForSponsorship',
                args: [user]
            }) as boolean;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isEligibleForSponsorship');
        }
    },

    async getAgentSponsorshipRate({ agent, operator }) {
        try {
            validateAddress(agent, 'agent');
            validateAddress(operator, 'operator');
            return await (client as PublicClient).readContract({
                address, abi: SuperPaymasterABI,
                functionName: 'getAgentSponsorshipRate',
                args: [agent, operator]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getAgentSponsorshipRate');
        }
    },

    async agentIdentityRegistry() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: SuperPaymasterABI,
                functionName: 'agentIdentityRegistry'
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'agentIdentityRegistry');
        }
    },

    async agentReputationRegistry() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: SuperPaymasterABI,
                functionName: 'agentReputationRegistry'
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'agentReputationRegistry');
        }
    },

    async agentPolicies({ operator, index }) {
        try {
            validateAddress(operator, 'operator');
            const result = await (client as PublicClient).readContract({
                address, abi: SuperPaymasterABI,
                functionName: 'agentPolicies',
                args: [operator, index]
            }) as readonly [bigint, bigint, bigint];
            return {
                minReputationScore: result[0],
                sponsorshipBPS: result[1],
                maxDailyUSD: result[2],
            };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'agentPolicies');
        }
    },

    // --- Admin ---
    async setAgentPolicies({ policies, account }) {
        try {
            const tuples = policies.map(p => ({
                minReputationScore: p.minReputationScore,
                sponsorshipBPS: p.sponsorshipBPS,
                maxDailyUSD: p.maxDailyUSD,
            }));
            return await (client as any).writeContract({
                address, abi: SuperPaymasterABI,
                functionName: 'setAgentPolicies',
                args: [tuples],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setAgentPolicies');
        }
    },

    async setAgentRegistries({ identity, reputation, account }) {
        try {
            validateAddress(identity, 'identity');
            validateAddress(reputation, 'reputation');
            return await (client as any).writeContract({
                address, abi: SuperPaymasterABI,
                functionName: 'setAgentRegistries',
                args: [identity, reputation],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setAgentRegistries');
        }
    },
});
};
