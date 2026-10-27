import { describe, expect, it } from 'vitest';
import {
    SUPER_PAYMASTER_FLAGS,
    SUPER_PAYMASTER_PMD_OFFSETS,
    decodeSuperPaymasterData,
    encodeSuperPaymasterData,
    superPaymasterGenerationFromVersion,
} from './superPaymasterData.js';

/**
 * Expectations here are written out by hand from the CONTRACT's parsing code, not produced by the
 * encoder under test:
 *
 *   SuperPaymaster v5.5.0-rc.4, contracts/src/paymasters/superpaymaster/v3/
 *     SuperPaymasterStorage.sol:176  PAYMASTER_DATA_OFFSET = 52   (operator = pmd[52:72])
 *     SuperPaymasterStorage.sol:177  RATE_OFFSET           = 72   (maxRate  = abi.decode(pmd[72:104]))
 *     SuperPaymasterStorage.sol:178  POSTOP_GAS_OFFSET     = 36   (postOpGas = uint128(bytes16(pmd[36:52])))
 *     SuperPaymasterStorage.sol:179  TOKEN_OFFSET          = 104  (token    = address(bytes20(pmd[104:124])))
 *     SuperPaymasterStorage.sol:180  FLAGS_OFFSET          = 124  (flags    = pmd.length > 124 ? pmd[124] : 0)
 *     SuperPaymasterStorage.sol:181-182  FLAG_SP_RENEW = 1, FLAG_ACCOUNT_RENEW = 2
 *     SuperPaymaster.sol:292  pmd.length < TOKEN_OFFSET + 20 -> sigFail
 *     SuperPaymaster.sol:295  flags byte optional
 *     SuperPaymaster.sol:296  both renew bits -> sigFail
 *     SuperPaymaster.sol:489  operator = address(bytes20(pmd[PAYMASTER_DATA_OFFSET : +20]))
 *   SuperPaymaster v5.4.2, SuperPaymaster.sol:78 RATE_OFFSET = 72, :1200 reads maxRate iff length >= 104
 *   ERC-4337 v0.7: pmd[0:20] paymaster, [20:36] paymasterVerificationGasLimit, [36:52] paymasterPostOpGasLimit
 */

const PM = '0x1111111111111111111111111111111111111111';
const OP = '0x2222222222222222222222222222222222222222';
const TOKEN = '0x3333333333333333333333333333333333333333';

// Hand-written segments (hex chars, no 0x).
const SEG_PM = '1111111111111111111111111111111111111111';
const SEG_VERIF_250K = '0000000000000000000000000003d090'; // 250_000 = 0x3d090, uint128
const SEG_POSTOP_200K = '00000000000000000000000000030d40'; // 200_000 = 0x30d40, uint128
const SEG_OP = '2222222222222222222222222222222222222222';
const SEG_RATE_1E18 = '0000000000000000000000000000000000000000000000000de0b6b3a7640000'; // 1e18
const SEG_TOKEN = '3333333333333333333333333333333333333333';

/** Read the bytes a Solidity calldata slice pmd[start:end] would read. */
const sliceBytes = (hex: string, start: number, end: number) => hex.slice(2 + start * 2, 2 + end * 2);

describe('encodeSuperPaymasterData — 5.5.0 layout (byte-exact vs SP contract offsets)', () => {
    const pmd = encodeSuperPaymasterData({
        paymaster: PM,
        operator: OP,
        verificationGasLimit: 250_000n,
        postOpGasLimit: 200_000n,
        maxRate: 10n ** 18n,
        token: TOKEN,
        flags: 0,
    });

    it('is exactly [pm 20][verifGas 16][postOpGas 16][operator 20][maxRate 32][token 20][flags 1] = 125 bytes', () => {
        expect(pmd).toBe(`0x${SEG_PM}${SEG_VERIF_250K}${SEG_POSTOP_200K}${SEG_OP}${SEG_RATE_1E18}${SEG_TOKEN}00`);
        expect((pmd.length - 2) / 2).toBe(125);
    });

    it('each field sits at the offset the contract reads it from', () => {
        expect(sliceBytes(pmd, 0, 20)).toBe(SEG_PM);
        expect(sliceBytes(pmd, 36, 52)).toBe(SEG_POSTOP_200K); // POSTOP_GAS_OFFSET = 36
        expect(sliceBytes(pmd, 52, 72)).toBe(SEG_OP); // PAYMASTER_DATA_OFFSET = 52
        expect(sliceBytes(pmd, 72, 104)).toBe(SEG_RATE_1E18); // RATE_OFFSET = 72
        expect(sliceBytes(pmd, 104, 124)).toBe(SEG_TOKEN); // TOKEN_OFFSET = 104
        expect(sliceBytes(pmd, 124, 125)).toBe('00'); // FLAGS_OFFSET = 124
    });

    it('the exported offsets equal the contract constants', () => {
        expect(SUPER_PAYMASTER_PMD_OFFSETS.POSTOP_GAS).toBe(36);
        expect(SUPER_PAYMASTER_PMD_OFFSETS.OPERATOR).toBe(52);
        expect(SUPER_PAYMASTER_PMD_OFFSETS.MAX_RATE).toBe(72);
        expect(SUPER_PAYMASTER_PMD_OFFSETS.TOKEN).toBe(104);
        expect(SUPER_PAYMASTER_PMD_OFFSETS.FLAGS).toBe(124);
        expect(SUPER_PAYMASTER_FLAGS.SP_RENEW).toBe(1);
        expect(SUPER_PAYMASTER_FLAGS.ACCOUNT_RENEW).toBe(2);
    });

    it('a 5.4.2 reader (length >= 104, reads only [0:104]) sees the same head as the legacy layout', () => {
        const legacy = encodeSuperPaymasterData({
            paymaster: PM, operator: OP, verificationGasLimit: 250_000n, postOpGasLimit: 200_000n, maxRate: 10n ** 18n,
        });
        expect(legacy).toBe(`0x${SEG_PM}${SEG_VERIF_250K}${SEG_POSTOP_200K}${SEG_OP}${SEG_RATE_1E18}`);
        expect((legacy.length - 2) / 2).toBe(104);
        expect(sliceBytes(pmd, 0, 104)).toBe(legacy.slice(2));
    });

    it('flags bit0 / bit1 land in byte 124', () => {
        const sp = encodeSuperPaymasterData({ paymaster: PM, operator: OP, verificationGasLimit: 1n, postOpGasLimit: 1n, token: TOKEN, flags: SUPER_PAYMASTER_FLAGS.SP_RENEW });
        const acct = encodeSuperPaymasterData({ paymaster: PM, operator: OP, verificationGasLimit: 1n, postOpGasLimit: 1n, token: TOKEN, flags: SUPER_PAYMASTER_FLAGS.ACCOUNT_RENEW });
        expect(sliceBytes(sp, 124, 125)).toBe('01');
        expect(sliceBytes(acct, 124, 125)).toBe('02');
    });

    it('emitFlagsByte:false with flags=0 yields the 124-byte form the contract also accepts (:295)', () => {
        const short = encodeSuperPaymasterData({ paymaster: PM, operator: OP, verificationGasLimit: 250_000n, postOpGasLimit: 200_000n, maxRate: 10n ** 18n, token: TOKEN, emitFlagsByte: false });
        expect(short).toBe(`0x${SEG_PM}${SEG_VERIF_250K}${SEG_POSTOP_200K}${SEG_OP}${SEG_RATE_1E18}${SEG_TOKEN}`);
    });

    it('default maxRate is type(uint256).max (no rate commitment)', () => {
        const d = encodeSuperPaymasterData({ paymaster: PM, operator: OP, verificationGasLimit: 1n, postOpGasLimit: 1n, token: TOKEN });
        expect(sliceBytes(d, 72, 104)).toBe('f'.repeat(64));
    });
});

describe('encodeSuperPaymasterData — refusals', () => {
    const base = { paymaster: PM, operator: OP, verificationGasLimit: 1n, postOpGasLimit: 1n } as const;
    it('refuses SP_RENEW|ACCOUNT_RENEW together (contract sigFails it, SuperPaymaster.sol:296)', () => {
        expect(() => encodeSuperPaymasterData({ ...base, token: TOKEN, flags: 3 })).toThrow(/sigFail/);
    });
    it('refuses unknown flag bits', () => {
        expect(() => encodeSuperPaymasterData({ ...base, token: TOKEN, flags: 4 })).toThrow(/outside/);
    });
    it('refuses flags without token', () => {
        expect(() => encodeSuperPaymasterData({ ...base, flags: 1 })).toThrow(/require token/);
    });
    it('refuses gas limits that do not fit uint128', () => {
        expect(() => encodeSuperPaymasterData({ ...base, verificationGasLimit: 1n << 128n })).toThrow(/out of range/);
        expect(() => encodeSuperPaymasterData({ ...base, postOpGasLimit: -1n })).toThrow(/out of range/);
    });
    it('refuses a non-address token', () => {
        expect(() => encodeSuperPaymasterData({ ...base, token: '0x1234' as any })).toThrow(/not an address/);
    });
});

describe('decodeSuperPaymasterData', () => {
    it('round-trips a 5.5.0 payload hand-assembled from the contract layout', () => {
        const hex = `0x${SEG_PM}${SEG_VERIF_250K}${SEG_POSTOP_200K}${SEG_OP}${SEG_RATE_1E18}${SEG_TOKEN}01` as const;
        const d = decodeSuperPaymasterData(hex);
        expect(d.layout).toBe('v5.5');
        expect(d.verificationGasLimit).toBe(250_000n);
        expect(d.postOpGasLimit).toBe(200_000n);
        expect(d.operator.toLowerCase()).toBe(OP);
        expect(d.maxRate).toBe(10n ** 18n);
        expect(d.token!.toLowerCase()).toBe(TOKEN);
        expect(d.flags).toBe(1);
    });
    it('124 bytes -> flags 0, 104 bytes -> legacy without token', () => {
        expect(decodeSuperPaymasterData(`0x${SEG_PM}${SEG_VERIF_250K}${SEG_POSTOP_200K}${SEG_OP}${SEG_RATE_1E18}${SEG_TOKEN}`).flags).toBe(0);
        const legacy = decodeSuperPaymasterData(`0x${SEG_PM}${SEG_VERIF_250K}${SEG_POSTOP_200K}${SEG_OP}${SEG_RATE_1E18}`);
        expect(legacy.layout).toBe('v5.4');
        expect(legacy.token).toBeUndefined();
    });
});

describe('superPaymasterGenerationFromVersion', () => {
    it('classifies the deployed and the candidate version strings', () => {
        // On-chain Sepolia today (M-11 §0.1) and the tag's SuperPaymaster.sol version().
        expect(superPaymasterGenerationFromVersion('SuperPaymaster-5.4.2')).toBe('v5.4');
        expect(superPaymasterGenerationFromVersion('SuperPaymaster-5.4.0')).toBe('v5.4');
        expect(superPaymasterGenerationFromVersion('SuperPaymaster-5.5.0')).toBe('v5.5');
        expect(superPaymasterGenerationFromVersion('SuperPaymaster-5.5.1')).toBe('v5.5');
    });
    it('refuses to guess for newer or unrecognised versions', () => {
        expect(() => superPaymasterGenerationFromVersion('SuperPaymaster-5.6.0')).toThrow(/newer/);
        expect(() => superPaymasterGenerationFromVersion('SuperPaymaster-6.0.0')).toThrow(/newer/);
        expect(() => superPaymasterGenerationFromVersion('PMV4-Deposit-4.5.1')).toThrow(/Unrecognised/);
    });
});
