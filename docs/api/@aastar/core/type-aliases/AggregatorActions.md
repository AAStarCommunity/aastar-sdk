> **AggregatorActions** = `object`

Defined in: [packages/core/src/actions/aggregator.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L6)

## Properties

### aggregatedSignatures()

> **aggregatedSignatures**: (`args`) => `Promise`\<\{ `messageHash`: [`Hex`](https://viem.sh/docs/index.html); `signature`: [`Hex`](https://viem.sh/docs/index.html); `timestamp`: `bigint`; `verified`: `boolean`; \}\>

Defined in: [packages/core/src/actions/aggregator.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L26)

#### Parameters

##### args

###### index

`bigint`

#### Returns

`Promise`\<\{ `messageHash`: [`Hex`](https://viem.sh/docs/index.html); `signature`: [`Hex`](https://viem.sh/docs/index.html); `timestamp`: `bigint`; `verified`: `boolean`; \}\>

***

### blsPublicKeys()

> **blsPublicKeys**: (`args`) => `Promise`\<\{ `publicKey`: [`Hex`](https://viem.sh/docs/index.html); `registered`: `boolean`; \}\>

Defined in: [packages/core/src/actions/aggregator.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L9)

#### Parameters

##### args

###### validator

`Address`

#### Returns

`Promise`\<\{ `publicKey`: [`Hex`](https://viem.sh/docs/index.html); `registered`: `boolean`; \}\>

***

### defaultThreshold()

> **defaultThreshold**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/aggregator.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L16)

#### Returns

`Promise`\<`bigint`\>

***

### DVT\_VALIDATOR()

> **DVT\_VALIDATOR**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/aggregator.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L31)

#### Returns

`Promise`\<`Address`\>

***

### executedProposals()

> **executedProposals**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/aggregator.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L22)

#### Parameters

##### args

###### proposalId

`bigint`

#### Returns

`Promise`\<`boolean`\>

***

### executeProposal()

> **executeProposal**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L20)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### callData

[`Hex`](https://viem.sh/docs/index.html)

###### proof

[`Hex`](https://viem.sh/docs/index.html)

###### proposalId

`bigint`

###### requiredThreshold

`bigint`

###### target

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getBLSThreshold()

> **getBLSThreshold**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/aggregator.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L13)

#### Returns

`Promise`\<`bigint`\>

***

### MAX\_VALIDATORS()

> **MAX\_VALIDATORS**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/aggregator.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L36)

#### Returns

`Promise`\<`bigint`\>

***

### minThreshold()

> **minThreshold**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/aggregator.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L17)

#### Returns

`Promise`\<`bigint`\>

***

### owner()

> **owner**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/aggregator.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L39)

#### Returns

`Promise`\<`Address`\>

***

### proposalNonces()

> **proposalNonces**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/aggregator.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L23)

#### Parameters

##### args

###### proposalId

`bigint`

#### Returns

`Promise`\<`bigint`\>

***

### registerBLSPublicKey()

> **registerBLSPublicKey**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L8)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### publicKey

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### REGISTRY()

> **REGISTRY**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/aggregator.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L33)

#### Returns

`Promise`\<`Address`\>

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L41)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setBLSThreshold()

> **setBLSThreshold**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L12)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### threshold

`number`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setDefaultThreshold()

> **setDefaultThreshold**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L14)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newThreshold

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setDVTValidator()

> **setDVTValidator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L29)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### dv

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setMinThreshold()

> **setMinThreshold**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L15)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newThreshold

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setSuperPaymaster()

> **setSuperPaymaster**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L30)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### paymaster

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### SUPERPAYMASTER()

> **SUPERPAYMASTER**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/aggregator.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L32)

#### Returns

`Promise`\<`Address`\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L40)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newOwner

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### verifyAndExecute()

> **verifyAndExecute**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L21)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### epoch

`bigint`

###### newScores

`bigint`[]

###### operator

`Address`

###### proof

[`Hex`](https://viem.sh/docs/index.html)

###### proposalId

`bigint`

###### repUsers

`Address`[]

###### slashLevel

`number`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/aggregator.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/aggregator.ts#L44)

#### Returns

`Promise`\<`string`\>
