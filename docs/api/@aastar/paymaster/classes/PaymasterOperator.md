Defined in: [V4/PaymasterOperator.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterOperator.ts#L8)

PaymasterOperator
Focus: Deployment, Configuration, Maintenance, Keeper Bots.

## Constructors

### Constructor

> **new PaymasterOperator**(): `PaymasterOperator`

#### Returns

`PaymasterOperator`

## Methods

### addDeposit()

> `static` **addDeposit**(`wallet`, `address`, `amount`): `Promise`\<`any`\>

Defined in: [V4/PaymasterOperator.ts:107](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterOperator.ts#L107)

#### Parameters

##### wallet

`any`

##### address

`` `0x${string}` ``

##### amount

`bigint`

#### Returns

`Promise`\<`any`\>

***

### addGasToken()

> `static` **addGasToken**(`wallet`, `address`, `token`): `Promise`\<`any`\>

Defined in: [V4/PaymasterOperator.ts:117](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterOperator.ts#L117)

#### Parameters

##### wallet

`any`

##### address

`` `0x${string}` ``

##### token

`` `0x${string}` ``

#### Returns

`Promise`\<`any`\>

***

### addStake()

> `static` **addStake**(`wallet`, `address`, `amount`, `unstakeDelaySec`): `Promise`\<`any`\>

Defined in: [V4/PaymasterOperator.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterOperator.ts#L96)

#### Parameters

##### wallet

`any`

##### address

`` `0x${string}` ``

##### amount

`bigint`

##### unstakeDelaySec

`number`

#### Returns

`Promise`\<`any`\>

***

### checkGaslessReadiness()

> `static` **checkGaslessReadiness**(`publicClient`, `entryPoint`, `paymasterAddress`, `user`, `token`): `Promise`\<[`GaslessReadinessReport`](../type-aliases/GaslessReadinessReport.md)\>

Defined in: [V4/PaymasterOperator.ts:169](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterOperator.ts#L169)

#### Parameters

##### publicClient

`any`

##### entryPoint

`` `0x${string}` ``

##### paymasterAddress

`` `0x${string}` ``

##### user

`` `0x${string}` ``

##### token

`` `0x${string}` ``

#### Returns

`Promise`\<[`GaslessReadinessReport`](../type-aliases/GaslessReadinessReport.md)\>

***

### ensurePriceInitialized()

> `static` **ensurePriceInitialized**(`wallet`, `publicClient`, `address`): `Promise`\<`boolean`\>

Defined in: [V4/PaymasterOperator.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterOperator.ts#L87)

#### Parameters

##### wallet

`any`

##### publicClient

`any`

##### address

`` `0x${string}` ``

#### Returns

`Promise`\<`boolean`\>

***

### getCachedPrice()

> `static` **getCachedPrice**(`publicClient`, `address`): `Promise`\<\{ `price`: `bigint`; `updatedAt`: `bigint`; \}\>

Defined in: [V4/PaymasterOperator.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterOperator.ts#L36)

#### Parameters

##### publicClient

`any`

##### address

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `price`: `bigint`; `updatedAt`: `bigint`; \}\>

***

### getDepositedBalance()

> `static` **getDepositedBalance**(`publicClient`, `address`, `user`, `token`): `Promise`\<`bigint`\>

Defined in: [V4/PaymasterOperator.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterOperator.ts#L69)

#### Parameters

##### publicClient

`any`

##### address

`` `0x${string}` ``

##### user

`` `0x${string}` ``

##### token

`` `0x${string}` ``

#### Returns

`Promise`\<`bigint`\>

***

### getTokenPrice()

> `static` **getTokenPrice**(`publicClient`, `address`, `token`): `Promise`\<`bigint`\>

Defined in: [V4/PaymasterOperator.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterOperator.ts#L54)

#### Parameters

##### publicClient

`any`

##### address

`` `0x${string}` ``

##### token

`` `0x${string}` ``

#### Returns

`Promise`\<`bigint`\>

***

### prepareGaslessEnvironment()

> `static` **prepareGaslessEnvironment**(`operatorWallet`, `publicClient`, `entryPoint`, `paymasterAddress`, `token`, `options`): `Promise`\<`object`[]\>

Defined in: [V4/PaymasterOperator.ts:229](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterOperator.ts#L229)

#### Parameters

##### operatorWallet

`any`

##### publicClient

`any`

##### entryPoint

`` `0x${string}` ``

##### paymasterAddress

`` `0x${string}` ``

##### token

`` `0x${string}` ``

##### options

###### minDeposit?

`bigint`

###### minStake?

`bigint`

###### tokenPriceUSD?

`bigint`

#### Returns

`Promise`\<`object`[]\>

***

### removeGasToken()

> `static` **removeGasToken**(`wallet`, `address`, `token`): `Promise`\<`any`\>

Defined in: [V4/PaymasterOperator.ts:127](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterOperator.ts#L127)

#### Parameters

##### wallet

`any`

##### address

`` `0x${string}` ``

##### token

`` `0x${string}` ``

#### Returns

`Promise`\<`any`\>

***

### setMaxGasCostCap()

> `static` **setMaxGasCostCap**(`wallet`, `address`, `cap`): `Promise`\<`any`\>

Defined in: [V4/PaymasterOperator.ts:147](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterOperator.ts#L147)

#### Parameters

##### wallet

`any`

##### address

`` `0x${string}` ``

##### cap

`bigint`

#### Returns

`Promise`\<`any`\>

***

### setServiceFeeRate()

> `static` **setServiceFeeRate**(`wallet`, `address`, `rate`): `Promise`\<`any`\>

Defined in: [V4/PaymasterOperator.ts:137](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterOperator.ts#L137)

#### Parameters

##### wallet

`any`

##### address

`` `0x${string}` ``

##### rate

`bigint`

#### Returns

`Promise`\<`any`\>

***

### setTokenPrice()

> `static` **setTokenPrice**(`wallet`, `address`, `token`, `priceUSD`): `Promise`\<`any`\>

Defined in: [V4/PaymasterOperator.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterOperator.ts#L26)

Set the token price (in 8 decimals, e.g., 1e8 = $1 USD).

#### Parameters

##### wallet

`any`

##### address

`` `0x${string}` ``

##### token

`` `0x${string}` ``

##### priceUSD

`bigint`

#### Returns

`Promise`\<`any`\>

***

### updatePrice()

> `static` **updatePrice**(`wallet`, `address`): `Promise`\<`any`\>

Defined in: [V4/PaymasterOperator.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterOperator.ts#L14)

Update the cached ETH/USD price from Chainlink Oracle.
Must be called if cachedPrice is 0 (uninitialized).

#### Parameters

##### wallet

`any`

##### address

`` `0x${string}` ``

#### Returns

`Promise`\<`any`\>

***

### withdrawPNT()

> `static` **withdrawPNT**(`wallet`, `address`, `to`, `token`, `amount`): `Promise`\<`any`\>

Defined in: [V4/PaymasterOperator.ts:157](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/paymaster/src/V4/PaymasterOperator.ts#L157)

#### Parameters

##### wallet

`any`

##### address

`` `0x${string}` ``

##### to

`` `0x${string}` ``

##### token

`` `0x${string}` ``

##### amount

`bigint`

#### Returns

`Promise`\<`any`\>
