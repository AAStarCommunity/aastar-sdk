> **AggregatorActions** = `object`

Defined in: [packages/core/src/actions/aggregator.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/aggregator.ts#L4)

## Properties

### getBLSThreshold()

> **getBLSThreshold**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/aggregator.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/aggregator.ts#L7)

#### Parameters

##### args

###### address

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### registerBLSPublicKey()

> **registerBLSPublicKey**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/aggregator.ts#L5)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### address

`Address`

###### publicKey

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setBLSThreshold()

> **setBLSThreshold**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/aggregator.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/aggregator.ts#L6)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### address

`Address`

###### threshold

`number`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
