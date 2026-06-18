> `const` **BLS\_POP\_DST**: `"BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_"` = `'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_'`

Defined in: [packages/core/src/crypto/hashToField.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/crypto/hashToField.ts#L16)

Frozen cross-repo DST (Domain Separation Tag) for the BLS-signature
Proof-of-Possession (POP) scheme. This MUST be byte-identical across:
  - SuperPaymaster        contracts/src/utils/BLS.sol            (dstPrime)
  - AAStar SDK            this file
  - YetAnotherAA-Validator src/utils/bls.util.ts                (BLS_DST)

NOTE: @noble/curves's `bls.G2.defaults.DST` is the `_NUL_` variant
("BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_NUL_"); we deliberately override
it with the `_POP_` variant to match the on-chain contract.
