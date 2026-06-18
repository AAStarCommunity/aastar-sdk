> **AggregatorActions** = `object`

Defined in: [packages/core/src/actions/aggregator.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L10)

## Properties

### aggregatedSignatures()

> **aggregatedSignatures**: (`args`) => `Promise`\<\{ `aggregatedSig`: [`Hex`](https://viem.sh/docs/index.html); `messageHash`: [`Hex`](https://viem.sh/docs/index.html); `timestamp`: `bigint`; `verified`: `boolean`; \}\>

Defined in: [packages/core/src/actions/aggregator.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L51)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; \} |
| `args.index` | `bigint` |

#### Returns

`Promise`\<\{ `aggregatedSig`: [`Hex`](https://viem.sh/docs/index.html); `messageHash`: [`Hex`](https://viem.sh/docs/index.html); `timestamp`: `bigint`; `verified`: `boolean`; \}\>

***

### ~~blsPublicKeys()~~

> **blsPublicKeys**: (`args`) => `Promise`\<\{ `isActive`: `boolean`; `publicKey`: [`Hex`](https://viem.sh/docs/index.html); \}\>

Defined in: [packages/core/src/actions/aggregator.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L14)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `validator`: `Address`; \} |
| `args.validator` | `Address` |

#### Returns

`Promise`\<\{ `isActive`: `boolean`; `publicKey`: [`Hex`](https://viem.sh/docs/index.html); \}\>

#### Deprecated

The deployed BLSAggregator ABI has no `blsPublicKeys` mapping getter — this wrapper now reads the ABI-confirmed `getBLSPublicKey` and projects out the slot. Prefer [getBLSPublicKey](#getblspublickey).

***

### buildSignerMask()

> **buildSignerMask**: (`args`) => `Promise`\<\{ `signerMask`: `bigint`; `slots`: `number`[]; \}\>

Defined in: [packages/core/src/actions/aggregator.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L33)

Build the DVT `signerMask` for a set of signer addresses by reading each
signer's on-chain registration slot. bit `s-1` is set for a validator at slot
`s` (see [BLSHelpers.slotsToSignerMask](../variables/BLSHelpers.md#slotstosignermask)). Throws if any signer is not a
registered, active validator, or if two signers map to the same slot.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `signers`: `Address`[]; \} |
| `args.signers` | `Address`[] |

#### Returns

`Promise`\<\{ `signerMask`: `bigint`; `slots`: `number`[]; \}\>

***

### defaultThreshold()

> **defaultThreshold**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/aggregator.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L41)

#### Returns

`Promise`\<`bigint`\>

***

### DVT\_VALIDATOR()

> **DVT\_VALIDATOR**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/aggregator.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L56)

#### Returns

`Promise`\<`Address`\>

***

### executedProposals()

> **executedProposals**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/aggregator.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L47)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `proposalId`: `bigint`; \} |
| `args.proposalId` | `bigint` |

#### Returns

`Promise`\<`boolean`\>

***

### executeProposal()

> **executeProposal**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L45)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `callData`: [`Hex`](https://viem.sh/docs/index.html); `proof`: [`Hex`](https://viem.sh/docs/index.html); `proposalId`: `bigint`; `requiredThreshold`: `bigint`; `target`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.callData` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.proof` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.proposalId` | `bigint` |
| `args.requiredThreshold` | `bigint` |
| `args.target` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getBLSPublicKey()

> **getBLSPublicKey**: (`args`) => `Promise`\<\{ `isActive`: `boolean`; `publicKey`: [`BLSG1Point`](BLSG1Point.md); `slot`: `number`; \}\>

Defined in: [packages/core/src/actions/aggregator.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L16)

Read a validator's registered G1 key + its registration SLOT (1-indexed) + active flag.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `validator`: `Address`; \} |
| `args.validator` | `Address` |

#### Returns

`Promise`\<\{ `isActive`: `boolean`; `publicKey`: [`BLSG1Point`](BLSG1Point.md); `slot`: `number`; \}\>

***

### MAX\_VALIDATORS()

> **MAX\_VALIDATORS**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/aggregator.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L61)

#### Returns

`Promise`\<`bigint`\>

***

### minThreshold()

> **minThreshold**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/aggregator.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L42)

#### Returns

`Promise`\<`bigint`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/aggregator.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L64)

#### Returns

`Promise`\<`Address`\>

***

### permissionlessBLSRegistration()

> **permissionlessBLSRegistration**: () => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/aggregator.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L24)

Whether permissionless BLS key registration is currently enabled (view).

#### Returns

`Promise`\<`boolean`\>

***

### proposalNonces()

> **proposalNonces**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/aggregator.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L48)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `proposalId`: `bigint`; \} |
| `args.proposalId` | `bigint` |

#### Returns

`Promise`\<`bigint`\>

***

### registerBLSPublicKey()

> **registerBLSPublicKey**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L12)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `publicKey`: [`Hex`](https://viem.sh/docs/index.html); `validator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.publicKey` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.validator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/aggregator.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L58)

#### Returns

`Promise`\<`Address`\>

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L66)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### revokeBLSPublicKey()

> **revokeBLSPublicKey**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L20)

Revoke a validator's registered BLS public key (owner-gated). ABI: revokeBLSPublicKey(address validator).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `validator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.validator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setDefaultThreshold()

> **setDefaultThreshold**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L39)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newThreshold`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newThreshold` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setDVTValidator()

> **setDVTValidator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L54)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `dv`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.dv` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setMinThreshold()

> **setMinThreshold**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L40)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newThreshold`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newThreshold` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setPermissionlessBLSRegistration()

> **setPermissionlessBLSRegistration**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L22)

Toggle permissionless (self-service) BLS key registration. ABI: setPermissionlessBLSRegistration(bool enabled).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `enabled`: `boolean`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.enabled` | `boolean` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setSuperPaymaster()

> **setSuperPaymaster**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L55)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `paymaster`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.paymaster` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### SUPERPAYMASTER()

> **SUPERPAYMASTER**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/aggregator.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L57)

#### Returns

`Promise`\<`Address`\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L65)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### validatorAtSlot()

> **validatorAtSlot**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/aggregator.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L18)

Reverse of [getBLSPublicKey](#getblspublickey): the validator address registered at a given slot.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `slot`: `number`; \} |
| `args.slot` | `number` |

#### Returns

`Promise`\<`Address`\>

***

### verify()

> **verify**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/aggregator.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L35)

On-chain aggregate-signature verification (view). `sigBytes` = aggregated sigG2.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `expectedMessageHash`: [`Hex`](https://viem.sh/docs/index.html); `requiredThreshold`: `bigint`; `sigBytes`: [`Hex`](https://viem.sh/docs/index.html); `signerMask`: `bigint`; \} |
| `args.expectedMessageHash` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.requiredThreshold` | `bigint` |
| `args.sigBytes` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.signerMask` | `bigint` |

#### Returns

`Promise`\<`boolean`\>

***

### verifyAndExecute()

> **verifyAndExecute**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L46)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `epoch`: `bigint`; `newScores`: `bigint`[]; `operator`: `Address`; `proof`: [`Hex`](https://viem.sh/docs/index.html); `proposalId`: `bigint`; `repUsers`: `Address`[]; `slashLevel`: `number`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.epoch` | `bigint` |
| `args.newScores` | `bigint`[] |
| `args.operator` | `Address` |
| `args.proof` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.proposalId` | `bigint` |
| `args.repUsers` | `Address`[] |
| `args.slashLevel` | `number` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/aggregator.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/aggregator.ts#L69)

#### Returns

`Promise`\<`string`\>
