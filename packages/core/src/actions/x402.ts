import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { SuperPaymasterABI } from '../abis/index.js';
import { validateAddress, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

export type X402Actions = {
    // Settlement
    settleX402Payment: (args: {
        from: Address, to: Address, asset: Address, amount: bigint,
        validAfter: bigint, validBefore: bigint, nonce: Hex, signature: Hex,
        account?: Account | Address
    }) => Promise<Hex>;
    settleX402PaymentDirect: (args: {
        from: Address, to: Address, asset: Address, amount: bigint, nonce: Hex,
        account?: Account | Address
    }) => Promise<Hex>;

    // View
    x402SettlementNonces: (args: { nonce: Hex }) => Promise<boolean>;
    facilitatorFeeBPS: () => Promise<bigint>;
    facilitatorEarnings: (args: { operator: Address, asset: Address }) => Promise<bigint>;
    operatorFacilitatorFees: (args: { operator: Address }) => Promise<bigint>;

    // Admin
    withdrawFacilitatorEarnings: (args: { asset: Address, account?: Account | Address }) => Promise<Hash>;
    setFacilitatorFeeBPS: (args: { fee: bigint, account?: Account | Address }) => Promise<Hash>;
    setOperatorFacilitatorFee: (args: { operator: Address, fee: bigint, account?: Account | Address }) => Promise<Hash>;
};

export const x402Actions = (address: Address) => (client: PublicClient | WalletClient): X402Actions => ({
    // --- Settlement ---
    async settleX402Payment({ from, to, asset, amount, validAfter, validBefore, nonce, signature, account }) {
        try {
            validateAddress(from, 'from');
            validateAddress(to, 'to');
            validateAddress(asset, 'asset');
            validateRequired(nonce, 'nonce');
            validateRequired(signature, 'signature');
            return await (client as any).writeContract({
                address, abi: SuperPaymasterABI,
                functionName: 'settleX402Payment',
                args: [from, to, asset, amount, validAfter, validBefore, nonce, signature],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'settleX402Payment');
        }
    },

    async settleX402PaymentDirect({ from, to, asset, amount, nonce, account }) {
        try {
            validateAddress(from, 'from');
            validateAddress(to, 'to');
            validateAddress(asset, 'asset');
            validateRequired(nonce, 'nonce');
            return await (client as any).writeContract({
                address, abi: SuperPaymasterABI,
                functionName: 'settleX402PaymentDirect',
                args: [from, to, asset, amount, nonce],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'settleX402PaymentDirect');
        }
    },

    // --- View ---
    async x402SettlementNonces({ nonce }) {
        try {
            validateRequired(nonce, 'nonce');
            return await (client as PublicClient).readContract({
                address, abi: SuperPaymasterABI,
                functionName: 'x402SettlementNonces',
                args: [nonce]
            }) as boolean;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'x402SettlementNonces');
        }
    },

    async facilitatorFeeBPS() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: SuperPaymasterABI,
                functionName: 'facilitatorFeeBPS'
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'facilitatorFeeBPS');
        }
    },

    async facilitatorEarnings({ operator, asset }) {
        try {
            validateAddress(operator, 'operator');
            validateAddress(asset, 'asset');
            return await (client as PublicClient).readContract({
                address, abi: SuperPaymasterABI,
                functionName: 'facilitatorEarnings',
                args: [operator, asset]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'facilitatorEarnings');
        }
    },

    async operatorFacilitatorFees({ operator }) {
        try {
            validateAddress(operator, 'operator');
            return await (client as PublicClient).readContract({
                address, abi: SuperPaymasterABI,
                functionName: 'operatorFacilitatorFees',
                args: [operator]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'operatorFacilitatorFees');
        }
    },

    // --- Admin ---
    async withdrawFacilitatorEarnings({ asset, account }) {
        try {
            validateAddress(asset, 'asset');
            return await (client as any).writeContract({
                address, abi: SuperPaymasterABI,
                functionName: 'withdrawFacilitatorEarnings',
                args: [asset],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'withdrawFacilitatorEarnings');
        }
    },

    async setFacilitatorFeeBPS({ fee, account }) {
        try {
            return await (client as any).writeContract({
                address, abi: SuperPaymasterABI,
                functionName: 'setFacilitatorFeeBPS',
                args: [fee],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setFacilitatorFeeBPS');
        }
    },

    async setOperatorFacilitatorFee({ operator, fee, account }) {
        try {
            validateAddress(operator, 'operator');
            return await (client as any).writeContract({
                address, abi: SuperPaymasterABI,
                functionName: 'setOperatorFacilitatorFee',
                args: [operator, fee],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setOperatorFacilitatorFee');
        }
    },
});
