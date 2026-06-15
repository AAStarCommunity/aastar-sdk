import { describe, it, expect } from 'vitest';
import type { Hex } from 'viem';
import { hashToFieldU0U1, BLS_POP_DST } from '../../src/crypto/hashToField';

/**
 * Cross-repo BLS golden-vector assertion (DVT closure criterion #2):
 * three places — node / SDK / on-chain verifier — must agree byte-for-byte on
 * the same `hash_to_field(msg, DST, count=2) -> (u0, u1)` golden vector.
 *
 * The expected u0/u1 split-bytes32 values below are copied verbatim from the
 * authoritative on-chain test:
 *   SuperPaymaster/contracts/test/modules/BLSGoldenVectors.t.sol
 *
 * Frozen DST: "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_".
 */

interface GoldenVec {
    label: string;
    message: Hex;
    u0c0a: Hex;
    u0c0b: Hex;
    u0c1a: Hex;
    u0c1b: Hex;
    u1c0a: Hex;
    u1c0b: Hex;
    u1c1a: Hex;
    u1c1b: Hex;
}

const GOLDEN_VECTORS: GoldenVec[] = [
    {
        // Vector 1: canonical msg = 0x11 * 32.
        label: 'canonical_0x11x32',
        message: `0x${'11'.repeat(32)}`,
        u0c0a: '0x0000000000000000000000000000000012e25bd78f6e72f2ec5255886b16fcb6',
        u0c0b: '0x092ddd2abd63803d14b3d6bda5aa8700d4c853da0dd342d66c22db44860a357b',
        u0c1a: '0x0000000000000000000000000000000012311112ab2764d8f3d560c7aa00b2e7',
        u0c1b: '0x4c5169b5645e7f737a8c78a0d4244b7035fe3d78fea995b99aaa3d4b8a24e7e1',
        u1c0a: '0x0000000000000000000000000000000018cb15f0b29c9e8fc82f2c02b0944de9',
        u1c0b: '0xca00e55395db980e90617f034ee1f0c5767b81c7f8f3bb417e1b664959f497cd',
        u1c1a: '0x000000000000000000000000000000000f3b654969e998e3bd1d56c3ca5adaec',
        u1c1b: '0x6e6d3f5933652f29e115614adf3b6349daa43cb5d0e91d25a2e155b91d5491ff',
    },
    {
        // Vector 2: empty message (0 bytes).
        label: 'empty',
        message: '0x',
        u0c0a: '0x00000000000000000000000000000000003051213109bd3c0a95ffa570521504',
        u0c0b: '0x7851ce352016f2c3da53ecb70e8aafefa9891d4f6c362732c767b0efa52c8a54',
        u0c1a: '0x000000000000000000000000000000000c5c6c7c1496c6de9c50065dd8323a2a',
        u0c1b: '0x9a7f17a1506fb3f5b15b49f4155775f47c5f6fa01b64cffddb17ccc9d7cc5de1',
        u1c0a: '0x00000000000000000000000000000000098bc5a5c85b0e923446e56f4dc1ee3c',
        u1c0b: '0x346fa7099054bdfa6e0c578f20d629fe8759a065678b83dca77de02c48a4e3ec',
        u1c1a: '0x0000000000000000000000000000000003b899e75c2c1a5b76ff772172f6e256',
        u1c1b: '0x61df5e919d286683f30dc6c2eb6650168a8842105de910dd919153f35f1daf9a',
    },
    {
        // Vector 3: single byte 'a' (0x61).
        label: 'one_byte_a',
        message: '0x61',
        u0c0a: '0x00000000000000000000000000000000069e35a606fd5b6ab78032b40cf97ac6',
        u0c0b: '0x8b346fdb86eb42134f9b5054f3e00548518cffb3998160ebee1f2562732ff449',
        u0c1a: '0x000000000000000000000000000000000de9514ea5d617ffb7908ff6e92cbd54',
        u0c1b: '0x4946e43a554d569a0c6fa1dc16b5767933249f89bf0a1de72f7a7c3c7e214112',
        u1c0a: '0x00000000000000000000000000000000117b61bea357237f969c06799ed38e25',
        u1c0b: '0xcde0c8140c81ed5c908e5e6d65891b4f44a590b33416e76487bea869bfbf9e6f',
        u1c1a: '0x000000000000000000000000000000001755f1694d58fa28b71e5d5d534e5dd8',
        u1c1b: '0x41a5a4c56775c14765aee363f6098ac90d9b900c4339db5a6912c1ff90ba82fc',
    },
    {
        // Vector 4: 96-byte message = 0xab * 96.
        label: 'ninetysix_0xab',
        message: `0x${'ab'.repeat(96)}`,
        u0c0a: '0x0000000000000000000000000000000003572117dbead03e23b31045168010a6',
        u0c0b: '0x683f7043cf6a8946bdcb18b52d30cf83942e9c7a00bdafd9689304e25265fc82',
        u0c1a: '0x0000000000000000000000000000000017818e3eedaa30e739617e7d17fa57c8',
        u0c1b: '0x2fd8be53536dfcbb6068f8be48e0be00a1cae0f239d3994daeb508b622a6ba77',
        u1c0a: '0x000000000000000000000000000000001976496ac05e431e2552e76906d0de33',
        u1c0b: '0xcc5425a510fc85f20224d10b63e1622f818be743a5d7c2e04bb243369cdb8b6a',
        u1c1a: '0x0000000000000000000000000000000004175a4ec245f45edf5725bd37e18216',
        u1c1b: '0xd0e4a39c0e3a456986d5caf6c3fcd4b5c98c14e3e209679eeb6c30f57b33575a',
    },
    {
        // Vector 5: 32-byte userOpHash-like = 0xdeadbeef * 8.
        label: 'userophash_like',
        message: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        u0c0a: '0x0000000000000000000000000000000012c3ee56935350cea84c79c02e1df53d',
        u0c0b: '0x1d8b8b636cebec35fca9b1558efe6317fb7a49dfe9335911c655c6c4ad035b14',
        u0c1a: '0x00000000000000000000000000000000137a692b4382584f5bc17e5552753ff9',
        u0c1b: '0xaaaaa540eb7876b4d12ce32547eb838ee25575cf27830d26029c4e2b91e51cf0',
        u1c0a: '0x0000000000000000000000000000000004e1e1b268b8e5b2e112980c65f92480',
        u1c0b: '0x62e0f7ab848599686ee92be4fdf3a3efc7e03c769f0256ad1955c03a6a20cf64',
        u1c1a: '0x00000000000000000000000000000000086302e0e0c5f0400b18182259da8497',
        u1c1b: '0x1b774c3b35a9a43ab4126dc978599d1bf3e43aa57d91e71d291ead1e15516a11',
    },
];

describe('hashToFieldU0U1 — cross-repo BLS golden vectors', () => {
    it('uses the frozen POP DST (must match SuperPaymaster BLS.sol)', () => {
        expect(BLS_POP_DST).toBe('BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_');
    });

    for (const v of GOLDEN_VECTORS) {
        it(`reproduces SP golden vector byte-for-byte: ${v.label}`, () => {
            const got = hashToFieldU0U1(v.message);
            // Compare every bytes32 (lowercased) against the authoritative .sol values.
            expect(got.u0c0a.toLowerCase()).toBe(v.u0c0a.toLowerCase());
            expect(got.u0c0b.toLowerCase()).toBe(v.u0c0b.toLowerCase());
            expect(got.u0c1a.toLowerCase()).toBe(v.u0c1a.toLowerCase());
            expect(got.u0c1b.toLowerCase()).toBe(v.u0c1b.toLowerCase());
            expect(got.u1c0a.toLowerCase()).toBe(v.u1c0a.toLowerCase());
            expect(got.u1c0b.toLowerCase()).toBe(v.u1c0b.toLowerCase());
            expect(got.u1c1a.toLowerCase()).toBe(v.u1c1a.toLowerCase());
            expect(got.u1c1b.toLowerCase()).toBe(v.u1c1b.toLowerCase());
        });
    }

    it('distinct messages yield distinct fields (guards degenerate output)', () => {
        const a = hashToFieldU0U1('0x00');
        const b = hashToFieldU0U1('0x01');
        expect(a.u0c0b).not.toBe(b.u0c0b);
    });
});
