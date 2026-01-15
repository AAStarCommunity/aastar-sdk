> **EntryPointActions** = `object`

Defined in: [packages/core/src/actions/entryPoint.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L9)

## Properties

### addStake()

> **addStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/entryPoint.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L16)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### unstakeDelaySec

`number`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### balanceOf()

> **balanceOf**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/entryPoint.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L10)

#### Parameters

##### args

###### account

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### delegateAndRevert()

> **delegateAndRevert**: (`args`) => `Promise`\<`void`\>

Defined in: [packages/core/src/actions/entryPoint.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L25)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### data

[`Hex`](https://viem.sh/docs/index.html)

###### target

`Address`

#### Returns

`Promise`\<`void`\>

***

### depositTo()

> **depositTo**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/entryPoint.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L11)

#### Parameters

##### args

###### account

`Address`

###### amount

`bigint`

###### txAccount?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### eip712Domain()

> **eip712Domain**: () => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/entryPoint.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L34)

#### Returns

`Promise`\<`any`\>

***

### getCurrentUserOpHash()

> **getCurrentUserOpHash**: () => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/entryPoint.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L35)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getDepositInfo()

> **getDepositInfo**: (`args`) => `Promise`\<\{ `deposit`: `bigint`; `stake`: `bigint`; `staked`: `boolean`; `unstakeDelaySec`: `number`; `withdrawTime`: `number`; \}\>

Defined in: [packages/core/src/actions/entryPoint.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L13)

#### Parameters

##### args

###### account

`Address`

#### Returns

`Promise`\<\{ `deposit`: `bigint`; `stake`: `bigint`; `staked`: `boolean`; `unstakeDelaySec`: `number`; `withdrawTime`: `number`; \}\>

***

### getDomainSeparatorV4()

> **getDomainSeparatorV4**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/entryPoint.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L36)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### getNonce()

> **getNonce**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/entryPoint.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L12)

#### Parameters

##### args

###### key

`bigint`

###### sender

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getPackedUserOpTypeHash()

> **getPackedUserOpTypeHash**: () => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/entryPoint.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L37)

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### getSenderAddress()

> **getSenderAddress**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/entryPoint.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L29)

#### Parameters

##### args

###### initCode

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`Address`\>

***

### getUserOpHash()

> **getUserOpHash**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/entryPoint.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L28)

#### Parameters

##### args

###### op

`any`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### handleAggregatedOps()

> **handleAggregatedOps**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/entryPoint.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L23)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### beneficiary

`Address`

###### opsPerAggregator

`any`[]

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### handleOps()

> **handleOps**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/entryPoint.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L22)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### beneficiary

`Address`

###### ops

`any`[]

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### incrementNonce()

> **incrementNonce**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/entryPoint.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L31)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### key

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### innerHandleOp()

> **innerHandleOp**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/entryPoint.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L24)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### callData

[`Hex`](https://viem.sh/docs/index.html)

###### context

[`Hex`](https://viem.sh/docs/index.html)

###### opInfo

`any`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### nonceSequenceNumber()

> **nonceSequenceNumber**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/entryPoint.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L32)

#### Parameters

##### args

###### key

`bigint`

###### sender

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### senderCreator()

> **senderCreator**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/entryPoint.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L30)

#### Returns

`Promise`\<`Address`\>

***

### supportsInterface()

> **supportsInterface**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/entryPoint.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L33)

#### Parameters

##### args

###### interfaceId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`boolean`\>

***

### unlockStake()

> **unlockStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/entryPoint.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L17)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### version

> **version**: [`EntryPointVersion`](../enumerations/EntryPointVersion.md)

Defined in: [packages/core/src/actions/entryPoint.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L39)

***

### withdrawStake()

> **withdrawStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/entryPoint.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L18)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### withdrawAddress

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### withdrawTo()

> **withdrawTo**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/entryPoint.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/entryPoint.ts#L19)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### withdrawAddress

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
