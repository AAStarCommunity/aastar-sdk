import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { GTokenAuthorizationABI } from '../abis/index.js';
import { type GTokenActions } from './tokens.js';

// AuthorizationState enum mirrors GTokenAuthorization.AuthorizationState
export enum AuthorizationState {
    Unused = 0,
    Used = 1,
    Canceled = 2,
}

export type GTokenAuthorizationActions = GTokenActions & {
    // ── EIP-3009 Write ────────────────────────────────────────────────────────
    // Any relay may submit. validBefore - validAfter must be <= 300s (MAX_AUTH_VALIDITY).
    //
    // xPNTsToken trust model (RC-2):
    //   xPNTsToken is NOT part of the EIP-712 signature — the signer does not commit to it.
    //   It is supplied by the relay at submission time as a hint for the RC-2 access check.
    //   Pass address(0) to fall back to the SBT-only path (no xPNTs required).
    //   If a non-zero xPNTsToken is accepted by the contract for access, the relay is trusted
    //   to supply the correct token address. Callers in untrusted relay environments should
    //   always pass address(0) to avoid relay-supplied access escalation.
    transferWithAuthorization: (args: {
        token: Address;
        from: Address;
        to: Address;
        value: bigint;
        validAfter: bigint;
        validBefore: bigint;
        nonce: Hex;
        /** RC-2 access hint — NOT signed; pass address(0) to use SBT path only. See trust model above. */
        xPNTsToken: Address;
        signature: Hex;
        account?: Account | Address;
    }) => Promise<Hash>;

    // Only msg.sender == to may call on-chain (CallerMustBeRecipient if violated).
    // Use for atomic deposit/wrapper flows where the recipient is the caller.
    receiveWithAuthorization: (args: {
        token: Address;
        from: Address;
        to: Address;
        value: bigint;
        validAfter: bigint;
        validBefore: bigint;
        nonce: Hex;
        /** RC-2 access hint — NOT signed; pass address(0) to use SBT path only. See trust model above. */
        xPNTsToken: Address;
        signature: Hex;
        account?: Account | Address;
    }) => Promise<Hash>;

    // signature must be signed by `authorizer` over CancelAuthorization typehash.
    cancelAuthorization: (args: {
        token: Address;
        authorizer: Address;
        nonce: Hex;
        signature: Hex;
        account?: Account | Address;
    }) => Promise<Hash>;

    // ── EIP-3009 View ─────────────────────────────────────────────────────────
    authorizationState: (args: { token: Address; authorizer: Address; nonce: Hex }) => Promise<AuthorizationState>;
    DOMAIN_SEPARATOR: (args: { token: Address }) => Promise<Hex>;
    TRANSFER_WITH_AUTHORIZATION_TYPEHASH: (args: { token: Address }) => Promise<Hex>;
    RECEIVE_WITH_AUTHORIZATION_TYPEHASH: (args: { token: Address }) => Promise<Hex>;
    CANCEL_AUTHORIZATION_TYPEHASH: (args: { token: Address }) => Promise<Hex>;

    // RC-1: hard-capped validity window in seconds (= 300)
    MAX_AUTH_VALIDITY: (args: { token: Address }) => Promise<bigint>;

    // RC-2: SBT and factory references
    mySBT: (args: { token: Address }) => Promise<Address>;
    factory: (args: { token: Address }) => Promise<Address>;

    // One-time post-deploy config (owner only)
    setMySBT: (args: { token: Address; mySBT: Address; account?: Account | Address }) => Promise<Hash>;
};

export const gTokenAuthorizationActions = (
    client: PublicClient | WalletClient
): GTokenAuthorizationActions => {
    const walletClient = client as WalletClient;
    const publicClient = client as PublicClient;

    const readContract = <T>(token: Address, functionName: string, args: unknown[] = []) =>
        publicClient.readContract({
            address: token,
            abi: GTokenAuthorizationABI,
            functionName,
            args,
        }) as Promise<T>;

    const writeContract = (token: Address, functionName: string, args: unknown[], account?: Account | Address) =>
        (client as any).writeContract({
            address: token,
            abi: GTokenAuthorizationABI,
            functionName,
            args,
            account: account as any,
            chain: (client as any).chain,
        });

    return {
        // ── Inherited GToken / ERC20 ─────────────────────────────────────────
        totalSupply: ({ token }) => readContract<bigint>(token, 'totalSupply'),
        balanceOf: ({ token, account }) => readContract<bigint>(token, 'balanceOf', [account]),
        transfer: ({ token, to, amount, account }) => writeContract(token, 'transfer', [to, amount], account),
        transferFrom: ({ token, from, to, amount, account }) => writeContract(token, 'transferFrom', [from, to, amount], account),
        approve: ({ token, spender, amount, account }) => writeContract(token, 'approve', [spender, amount], account),
        allowance: ({ token, owner, spender }) => readContract<bigint>(token, 'allowance', [owner, spender]),
        name: ({ token }) => readContract<string>(token, 'name'),
        symbol: ({ token }) => readContract<string>(token, 'symbol'),
        decimals: ({ token }) => readContract<number>(token, 'decimals'),
        mint: ({ token, to, amount, account }) => writeContract(token, 'mint', [to, amount], account),
        burn: ({ token, amount, account }) => writeContract(token, 'burn', [amount], account),
        burnFrom: ({ token, from, amount, account }) => writeContract(token, 'burnFrom', [from, amount], account),
        cap: ({ token }) => readContract<bigint>(token, 'cap'),
        remainingMintableSupply: ({ token }) => readContract<bigint>(token, 'remainingMintableSupply'),
        version: ({ token }) => readContract<string>(token, 'version'),
        owner: ({ token }) => readContract<Address>(token, 'owner'),
        transferOwnership: ({ token, newOwner, account }) => writeContract(token, 'transferOwnership', [newOwner], account),
        renounceOwnership: ({ token, account }) => writeContract(token, 'renounceOwnership', [], account),

        // ── EIP-3009 Write ────────────────────────────────────────────────────
        transferWithAuthorization: ({ token, from, to, value, validAfter, validBefore, nonce, xPNTsToken, signature, account }) =>
            writeContract(token, 'transferWithAuthorization', [
                from, to, value, validAfter, validBefore, nonce, xPNTsToken, signature,
            ], account),

        receiveWithAuthorization: ({ token, from, to, value, validAfter, validBefore, nonce, xPNTsToken, signature, account }) =>
            writeContract(token, 'receiveWithAuthorization', [
                from, to, value, validAfter, validBefore, nonce, xPNTsToken, signature,
            ], account),

        cancelAuthorization: ({ token, authorizer, nonce, signature, account }) =>
            writeContract(token, 'cancelAuthorization', [authorizer, nonce, signature], account),

        // ── EIP-3009 View ─────────────────────────────────────────────────────
        authorizationState: async ({ token, authorizer, nonce }) => {
            const state = await readContract<number>(token, 'authorizationState', [authorizer, nonce]);
            return state as AuthorizationState;
        },
        DOMAIN_SEPARATOR: ({ token }) => readContract<Hex>(token, 'DOMAIN_SEPARATOR'),
        TRANSFER_WITH_AUTHORIZATION_TYPEHASH: ({ token }) => readContract<Hex>(token, 'TRANSFER_WITH_AUTHORIZATION_TYPEHASH'),
        RECEIVE_WITH_AUTHORIZATION_TYPEHASH: ({ token }) => readContract<Hex>(token, 'RECEIVE_WITH_AUTHORIZATION_TYPEHASH'),
        CANCEL_AUTHORIZATION_TYPEHASH: ({ token }) => readContract<Hex>(token, 'CANCEL_AUTHORIZATION_TYPEHASH'),
        MAX_AUTH_VALIDITY: ({ token }) => readContract<bigint>(token, 'MAX_AUTH_VALIDITY'),
        mySBT: ({ token }) => readContract<Address>(token, 'mySBT'),
        factory: ({ token }) => readContract<Address>(token, 'factory'),

        // ── One-time config ───────────────────────────────────────────────────
        setMySBT: ({ token, mySBT, account }) =>
            writeContract(token, 'setMySBT', [mySBT], account),
    };
};
