import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type Hex } from 'viem';
import { gTokenAuthorizationActions, AuthorizationState } from '../gTokenAuthorization.js';
import { GTokenAuthorizationABI } from '../../abis/index.js';

const TOKEN = '0xbC17B6C319561bcA805981fC2846e4678f9114Cb' as Address;
const ALICE = '0x1111111111111111111111111111111111111111' as Address;
const BOB = '0x2222222222222222222222222222222222222222' as Address;
const FACTORY = '0x3333333333333333333333333333333333333333' as Address;
const SBT = '0x4444444444444444444444444444444444444444' as Address;
const NONCE = '0xabcdef0000000000000000000000000000000000000000000000000000000001' as Hex;
const SIG = '0xdeadbeef' as Hex;

const makeReadClient = (returnValue: unknown) => ({
    readContract: vi.fn().mockResolvedValue(returnValue),
});

const makeWriteClient = () => ({
    writeContract: vi.fn().mockResolvedValue('0xtxhash'),
});

describe('gTokenAuthorizationActions — ABI coverage', () => {
    it('GTokenAuthorizationABI contains transferWithAuthorization', () => {
        const names = GTokenAuthorizationABI.map((e: any) => e.name);
        expect(names).toContain('transferWithAuthorization');
        expect(names).toContain('receiveWithAuthorization');
        expect(names).toContain('cancelAuthorization');
        expect(names).toContain('authorizationState');
        expect(names).toContain('DOMAIN_SEPARATOR');
        expect(names).toContain('MAX_AUTH_VALIDITY');
        expect(names).toContain('mySBT');
        expect(names).toContain('factory');
        expect(names).toContain('setMySBT');
    });

    it('GTokenAuthorizationABI contains EIP-3009 events', () => {
        const events = GTokenAuthorizationABI.filter((e: any) => e.type === 'event').map((e: any) => e.name);
        expect(events).toContain('AuthorizationUsed');
        expect(events).toContain('AuthorizationCanceled');
    });

    it('GTokenAuthorizationABI contains EIP-3009 errors', () => {
        const errors = GTokenAuthorizationABI.filter((e: any) => e.type === 'error').map((e: any) => e.name);
        expect(errors).toContain('AuthorizationNotYetValid');
        expect(errors).toContain('AuthorizationExpired');
        expect(errors).toContain('AuthorizationWindowTooLong');
        expect(errors).toContain('AuthorizationWindowInvalid');
        expect(errors).toContain('AuthorizationUsedOrCanceled');
        expect(errors).toContain('InvalidSignature');
        expect(errors).toContain('RecipientNotInProtocol');
        expect(errors).toContain('CallerMustBeRecipient');
        expect(errors).toContain('SBTAlreadySet');
    });
});

describe('gTokenAuthorizationActions — read methods', () => {
    it('authorizationState returns AuthorizationState enum', async () => {
        const client = makeReadClient(0) as any;
        const actions = gTokenAuthorizationActions(client);
        const result = await actions.authorizationState({ token: TOKEN, authorizer: ALICE, nonce: NONCE });
        expect(result).toBe(AuthorizationState.Unused);
        expect(client.readContract).toHaveBeenCalledWith(expect.objectContaining({
            functionName: 'authorizationState',
            args: [ALICE, NONCE],
        }));
    });

    it('authorizationState maps Used = 1', async () => {
        const client = makeReadClient(1) as any;
        const actions = gTokenAuthorizationActions(client);
        const result = await actions.authorizationState({ token: TOKEN, authorizer: ALICE, nonce: NONCE });
        expect(result).toBe(AuthorizationState.Used);
    });

    it('MAX_AUTH_VALIDITY reads constant', async () => {
        const client = makeReadClient(300n) as any;
        const actions = gTokenAuthorizationActions(client);
        const result = await actions.MAX_AUTH_VALIDITY({ token: TOKEN });
        expect(result).toBe(300n);
    });

    it('mySBT reads SBT address', async () => {
        const client = makeReadClient(SBT) as any;
        const actions = gTokenAuthorizationActions(client);
        expect(await actions.mySBT({ token: TOKEN })).toBe(SBT);
    });

    it('factory reads factory address', async () => {
        const client = makeReadClient(FACTORY) as any;
        const actions = gTokenAuthorizationActions(client);
        expect(await actions.factory({ token: TOKEN })).toBe(FACTORY);
    });
});

describe('gTokenAuthorizationActions — write methods', () => {
    let client: ReturnType<typeof makeWriteClient>;
    let actions: ReturnType<typeof gTokenAuthorizationActions>;

    beforeEach(() => {
        client = makeWriteClient() as any;
        actions = gTokenAuthorizationActions(client as any);
    });

    it('transferWithAuthorization passes args in correct order', async () => {
        await actions.transferWithAuthorization({
            token: TOKEN, from: ALICE, to: BOB,
            value: 100n, validAfter: 0n, validBefore: 300n,
            nonce: NONCE, xPNTsToken: FACTORY, signature: SIG,
        });
        expect(client.writeContract).toHaveBeenCalledWith(expect.objectContaining({
            functionName: 'transferWithAuthorization',
            args: [ALICE, BOB, 100n, 0n, 300n, NONCE, FACTORY, SIG],
        }));
    });

    it('receiveWithAuthorization passes args in correct order', async () => {
        await actions.receiveWithAuthorization({
            token: TOKEN, from: ALICE, to: BOB,
            value: 50n, validAfter: 0n, validBefore: 240n,
            nonce: NONCE, xPNTsToken: FACTORY, signature: SIG,
            account: BOB,
        });
        expect(client.writeContract).toHaveBeenCalledWith(expect.objectContaining({
            functionName: 'receiveWithAuthorization',
            args: [ALICE, BOB, 50n, 0n, 240n, NONCE, FACTORY, SIG],
            account: BOB,
        }));
    });

    it('cancelAuthorization passes authorizer + nonce + signature', async () => {
        await actions.cancelAuthorization({
            token: TOKEN, authorizer: ALICE, nonce: NONCE, signature: SIG,
        });
        expect(client.writeContract).toHaveBeenCalledWith(expect.objectContaining({
            functionName: 'cancelAuthorization',
            args: [ALICE, NONCE, SIG],
        }));
    });

    it('setMySBT passes SBT address', async () => {
        await actions.setMySBT({ token: TOKEN, mySBT: SBT });
        expect(client.writeContract).toHaveBeenCalledWith(expect.objectContaining({
            functionName: 'setMySBT',
            args: [SBT],
        }));
    });
});
