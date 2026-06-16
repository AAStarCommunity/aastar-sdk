import { type Address, type PublicClient, type WalletClient, type Hash, type Account } from 'viem';
import { SuperPaymasterABI } from '../abis/index.js';
import { validateAddress, validateDeployedAddress } from '../validators/index.js';
import { AAStarError, ErrorCode } from '../errors/index.js';

export type AgentSponsorshipPolicy = {
    minReputationScore: bigint;
    sponsorshipBPS: bigint;
    maxDailyUSD: bigint;
};

export type AgentActions = {
    // View
    isRegisteredAgent: (args: { account: Address }) => Promise<boolean>;
    isEligibleForSponsorship: (args: { user: Address }) => Promise<boolean>;
    /** @deprecated Removed in the v5.x contract refactor — the SuperPaymaster ABI has no per-agent sponsorship-rate getter; sponsorship is now a boolean eligibility check. Throws {@link ErrorCode.NOT_IMPLEMENTED}; use {@link isEligibleForSponsorship}. */
    getAgentSponsorshipRate: (args: { agent: Address, operator: Address }) => Promise<bigint>;
    agentIdentityRegistry: () => Promise<Address>;
    agentReputationRegistry: () => Promise<Address>;
    /** @deprecated Removed in the v5.x contract refactor — per-operator agent policies are no longer stored on-chain (no `agentPolicies` in the SuperPaymaster ABI). Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    agentPolicies: (args: { operator: Address, index: bigint }) => Promise<AgentSponsorshipPolicy>;

    // Admin
    /** @deprecated Removed in the v5.x contract refactor — per-operator sponsorship policies are no longer configurable on-chain (no `setAgentPolicies`). Throws {@link ErrorCode.NOT_IMPLEMENTED}; to wire up the agent identity/reputation registries use {@link setAgentRegistries}. */
    setAgentPolicies: (args: { policies: AgentSponsorshipPolicy[], account?: Account | Address }) => Promise<Hash>;
    setAgentRegistries: (args: { identity: Address, reputation: Address, account?: Account | Address }) => Promise<Hash>;
};

export const agentActions = (address: Address) => (client: PublicClient | WalletClient): AgentActions => {
    validateDeployedAddress(address, 'AgentContracts');
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
        // Removed in the v5.x contract refactor: there is no per-agent sponsorship-RATE
        // getter on the deployed SuperPaymaster ABI. Sponsorship is now a boolean
        // eligibility decision. Validate inputs then throw rather than revert on-chain.
        validateAddress(agent, 'agent');
        validateAddress(operator, 'operator');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'getAgentSponsorshipRate was removed in the v5.x contract refactor; sponsorship is ' +
            'now a boolean check — use isEligibleForSponsorship({ user }) instead.'
        );
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

    async agentPolicies({ operator }) {
        // Removed in the v5.x contract refactor: per-operator agent sponsorship policies are
        // no longer stored on-chain (no `agentPolicies` mapping in the SuperPaymaster ABI).
        validateAddress(operator, 'operator');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'agentPolicies was removed in the v5.x contract refactor; per-operator agent ' +
            'sponsorship policies are no longer stored on-chain.'
        );
    },

    // --- Admin ---
    async setAgentPolicies({ policies }) {
        // Removed in the v5.x contract refactor: per-operator sponsorship policies are no
        // longer configurable on-chain (no `setAgentPolicies`). To wire up the agent identity
        // and reputation registries used for eligibility, use setAgentRegistries instead.
        if (!policies) {
            throw new AAStarError(ErrorCode.REQUIRED_PARAMETER, 'setAgentPolicies: policies is required');
        }
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'setAgentPolicies was removed in the v5.x contract refactor; per-operator sponsorship ' +
            'policies are no longer configurable on-chain. Use setAgentRegistries({ identity, reputation }) ' +
            'to configure the agent identity/reputation registries instead.'
        );
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
