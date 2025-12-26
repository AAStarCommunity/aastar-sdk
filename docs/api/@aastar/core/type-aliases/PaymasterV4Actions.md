> **PaymasterV4Actions** = `object`

Defined in: [packages/core/src/actions/paymasterV4.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L13)

Paymaster V4 Actions

Paymaster V4 uses Token Paymaster model:
- Users must hold supported SBT or Gas Tokens
- Direct token deduction for gas payment
- No signature verification required

## Properties

### addGasToken()

> **addGasToken**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L15)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### address

`Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### addSBT()

> **addSBT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L17)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### address

`Address`

###### sbt

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getMaxGasCostCap()

> **getMaxGasCostCap**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L30)

#### Parameters

##### args

###### address

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getServiceFeeRate()

> **getServiceFeeRate**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L31)

#### Parameters

##### args

###### address

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getSupportedGasTokens()

> **getSupportedGasTokens**: (`args`) => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/paymasterV4.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L26)

#### Parameters

##### args

###### address

`Address`

#### Returns

`Promise`\<`Address`[]\>

***

### getSupportedSBTs()

> **getSupportedSBTs**: (`args`) => `Promise`\<`Address`[]\>

Defined in: [packages/core/src/actions/paymasterV4.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L27)

#### Parameters

##### args

###### address

`Address`

#### Returns

`Promise`\<`Address`[]\>

***

### getTreasury()

> **getTreasury**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L32)

#### Parameters

##### args

###### address

`Address`

#### Returns

`Promise`\<`Address`\>

***

### isGasTokenSupported()

> **isGasTokenSupported**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L28)

#### Parameters

##### args

###### address

`Address`

###### token

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### isPaused()

> **isPaused**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L33)

#### Parameters

##### args

###### address

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### isSBTSupported()

> **isSBTSupported**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/paymasterV4.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L29)

#### Parameters

##### args

###### address

`Address`

###### sbt

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### pause()

> **pause**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L22)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### address

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### removeGasToken()

> **removeGasToken**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L16)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### address

`Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### removeSBT()

> **removeSBT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L18)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### address

`Address`

###### sbt

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setMaxGasCostCap()

> **setMaxGasCostCap**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L19)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### address

`Address`

###### cap

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setServiceFeeRate()

> **setServiceFeeRate**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L20)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### address

`Address`

###### rate

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setTreasury()

> **setTreasury**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L21)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### address

`Address`

###### treasury

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### unpause()

> **unpause**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/paymasterV4.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/paymasterV4.ts#L23)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### address

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
