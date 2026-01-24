> **AggregatorActions** = `object`

Defined in: [packages/core/src/actions/aggregator.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L6)

## Properties

### aggregatedSignatures()

> **aggregatedSignatures**: (`args`) => `Promise`\<\{ `aggregatedSig`: [`Hex`](https://viem.sh/docs/index.html); `messageHash`: [`Hex`](https://viem.sh/docs/index.html); `timestamp`: `bigint`; `verified`: `boolean`; \}\>

Defined in: [packages/core/src/actions/aggregator.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L24)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; \} |
| `args.index` | `bigint` |

#### Returns

`Promise`\<\{ `aggregatedSig`: [`Hex`](https://viem.sh/docs/index.html); `messageHash`: [`Hex`](https://viem.sh/docs/index.html); `timestamp`: `bigint`; `verified`: `boolean`; \}\>

***

### blsPublicKeys()

> **blsPublicKeys**: (`args`) => `Promise`\<\{ `isActive`: `boolean`; `publicKey`: [`Hex`](https://viem.sh/docs/index.html); \}\>

Defined in: [packages/core/src/actions/aggregator.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `validator`: `Address`; \} |
| `args.validator` | `Address` |

#### Returns

`Promise`\<\{ `isActive`: `boolean`; `publicKey`: [`Hex`](https://viem.sh/docs/index.html); \}\>

***

### defaultThreshold()

> **defaultThreshold**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/aggregator.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L14)

#### Returns

`Promise`\<`bigint`\>

***

### DVT\_VALIDATOR()

> **DVT\_VALIDATOR**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/aggregator.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L29)

#### Returns

`Promise`\<`Address`\>

***

### executedProposals()

> **executedProposals**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/aggregator.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L20)

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

Defined in: [packages/core/src/actions/aggregator.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L18)

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

### MAX\_VALIDATORS()

> **MAX\_VALIDATORS**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/aggregator.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L34)

#### Returns

`Promise`\<`bigint`\>

***

### minThreshold()

> **minThreshold**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/aggregator.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L15)

#### Returns

`Promise`\<`bigint`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/aggregator.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L37)

#### Returns

`Promise`\<`Address`\>

***

### proposalNonces()

> **proposalNonces**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/aggregator.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L21)

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

Defined in: [packages/core/src/actions/aggregator.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L8)

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

Defined in: [packages/core/src/actions/aggregator.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L31)

#### Returns

`Promise`\<`Address`\>

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L39)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setDefaultThreshold()

> **setDefaultThreshold**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L12)

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

Defined in: [packages/core/src/actions/aggregator.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L27)

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

Defined in: [packages/core/src/actions/aggregator.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L13)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newThreshold`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newThreshold` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setSuperPaymaster()

> **setSuperPaymaster**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L28)

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

Defined in: [packages/core/src/actions/aggregator.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L30)

#### Returns

`Promise`\<`Address`\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L38)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newOwner`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newOwner` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### verifyAndExecute()

> **verifyAndExecute**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L19)

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

Defined in: [packages/core/src/actions/aggregator.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/core/src/actions/aggregator.ts#L42)

#### Returns

`Promise`\<`string`\>
