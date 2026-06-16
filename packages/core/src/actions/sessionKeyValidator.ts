import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { SessionKeyValidatorABI } from '../abis/index.js';
import { validateAddress, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

// sessionStates_p256() velocity-window state tuple.
export type P256SessionState = {
    windowStart: number;
    callCount: number;
    prevCount: number;
};

export type SessionKeyValidatorActions = {
    // checkSessionScope reverts (view) when the session may not call dest/selector.
    checkSessionScope: (args: { account: Address, sessionKeyOrHash: Hex, sessionType: number, dest: Address, selector: Hex }) => Promise<void>;
    grantNonces: (args: { account: Address, key: Address }) => Promise<bigint>;
    grantNonces_p256: (args: { account: Address, keyHash: Hex }) => Promise<bigint>;
    sessionKeyCount: (args: { account: Address }) => Promise<bigint>;
    sessionStates_p256: (args: { account: Address, keyHash: Hex }) => Promise<P256SessionState>;
    // recordCallForVelocity advances the velocity counter (state-changing).
    recordCallForVelocity: (args: { account: Address, sessionKeyOrHash: Hex, sessionType: number, signer?: Account | Address }) => Promise<Hash>;
};

const ABI = SessionKeyValidatorABI;

export const sessionKeyValidatorActions = (address: Address) => (client: PublicClient | WalletClient): SessionKeyValidatorActions => ({
    async checkSessionScope({ account, sessionKeyOrHash, sessionType, dest, selector }) {
        try {
            validateAddress(account, 'account');
            validateAddress(dest, 'dest');
            validateRequired(sessionKeyOrHash, 'sessionKeyOrHash');
            validateRequired(selector, 'selector');
            await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'checkSessionScope',
                args: [account, sessionKeyOrHash, sessionType, dest, selector]
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'checkSessionScope');
        }
    },

    async grantNonces({ account, key }) {
        try {
            validateAddress(account, 'account');
            validateAddress(key, 'key');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'grantNonces', args: [account, key]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'grantNonces');
        }
    },

    async grantNonces_p256({ account, keyHash }) {
        try {
            validateAddress(account, 'account');
            validateRequired(keyHash, 'keyHash');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'grantNonces_p256', args: [account, keyHash]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'grantNonces_p256');
        }
    },

    async sessionKeyCount({ account }) {
        try {
            validateAddress(account, 'account');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'sessionKeyCount', args: [account]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'sessionKeyCount');
        }
    },

    async sessionStates_p256({ account, keyHash }) {
        try {
            validateAddress(account, 'account');
            validateRequired(keyHash, 'keyHash');
            const r = await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'sessionStates_p256', args: [account, keyHash]
            }) as readonly [number, number, number];
            return { windowStart: r[0], callCount: r[1], prevCount: r[2] };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'sessionStates_p256');
        }
    },

    async recordCallForVelocity({ account, sessionKeyOrHash, sessionType, signer }) {
        try {
            validateAddress(account, 'account');
            validateRequired(sessionKeyOrHash, 'sessionKeyOrHash');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'recordCallForVelocity',
                args: [account, sessionKeyOrHash, sessionType],
                account: signer as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'recordCallForVelocity');
        }
    },
});
