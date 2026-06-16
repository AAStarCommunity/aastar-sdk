import { type Address, type PublicClient, type WalletClient, type Hash, type Account } from 'viem';
import { AgentRegistryABI } from '../abis/index.js';
import { validateAddress } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

export type AgentRegistryActions = {
    // Reads
    deployer: () => Promise<Address>;
    factory: () => Promise<Address>;
    // Writes (admin)
    bindFactory: (args: { factory: Address, account?: Account | Address }) => Promise<Hash>;
    markValid: (args: { account: Address, signer?: Account | Address }) => Promise<Hash>;
};

const ABI = AgentRegistryABI;

export const agentRegistryActions = (address: Address) => (client: PublicClient | WalletClient): AgentRegistryActions => ({
    async deployer() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'deployer', args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'deployer');
        }
    },

    async factory() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'factory', args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'factory');
        }
    },

    async bindFactory({ factory, account }) {
        try {
            validateAddress(factory, 'factory');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'bindFactory', args: [factory],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'bindFactory');
        }
    },

    // markValid(address account): flags an account as a factory-deployed valid agent.
    async markValid({ account: target, signer }) {
        try {
            validateAddress(target, 'account');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'markValid', args: [target],
                account: signer as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'markValid');
        }
    },
});
