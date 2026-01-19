> **XPNTsTokenActions** = [`ERC20Actions`](ERC20Actions.md) & `object`

Defined in: [packages/core/src/actions/tokens.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/tokens.ts#L33)

## Type Declaration

### addAutoApprovedSpender()

> **addAutoApprovedSpender**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### spender

`Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### autoApprovedSpenders()

> **autoApprovedSpenders**: (`args`) => `Promise`\<`boolean`\>

#### Parameters

##### args

###### spender

`Address`

###### token

`Address`

#### Returns

`Promise`\<`boolean`\>

### burn()

> **burn**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### burnFrom()

> **burnFrom**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### from

`Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### burnFromWithOpHash()

> **burnFromWithOpHash**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### from

`Address`

###### token

`Address`

###### userOpHash

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### communityENS()

> **communityENS**: (`args`) => `Promise`\<`string`\>

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`string`\>

### communityName()

> **communityName**: (`args`) => `Promise`\<`string`\>

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`string`\>

### communityOwner()

> **communityOwner**: (`args`) => `Promise`\<`Address`\>

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`Address`\>

### cumulativeSpent()

> **cumulativeSpent**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

##### args

###### owner

`Address`

###### spender

`Address`

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

### debts()

> **debts**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

##### args

###### token

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

### DEFAULT\_SPENDING\_LIMIT\_APNTS()

> **DEFAULT\_SPENDING\_LIMIT\_APNTS**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

### DOMAIN\_SEPARATOR()

> **DOMAIN\_SEPARATOR**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

### eip712Domain()

> **eip712Domain**: (`args`) => `Promise`\<`any`\>

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`any`\>

### exchangeRate()

> **exchangeRate**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

### FACTORY()

> **FACTORY**: (`args`) => `Promise`\<`Address`\>

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`Address`\>

### getDebt()

> **getDebt**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

##### args

###### token

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

### getDefaultSpendingLimitXPNTs()

> **getDefaultSpendingLimitXPNTs**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

### getMetadata()

> **getMetadata**: (`args`) => `Promise`\<\{ `communityENS`: `string`; `communityName`: `string`; `communityOwner`: `Address`; `name`: `string`; `symbol`: `string`; \}\>

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<\{ `communityENS`: `string`; `communityName`: `string`; `communityOwner`: `Address`; `name`: `string`; `symbol`: `string`; \}\>

### mint()

> **mint**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### to

`Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### needsApproval()

> **needsApproval**: (`args`) => `Promise`\<`boolean`\>

#### Parameters

##### args

###### amount

`bigint`

###### owner

`Address`

###### spender

`Address`

###### token

`Address`

#### Returns

`Promise`\<`boolean`\>

### nonces()

> **nonces**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

##### args

###### owner

`Address`

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

### permit()

> **permit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### deadline

`bigint`

###### owner

`Address`

###### r

[`Hex`](https://viem.sh/docs/index.html)

###### s

[`Hex`](https://viem.sh/docs/index.html)

###### spender

`Address`

###### token

`Address`

###### v

`number`

###### value

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### recordDebt()

> **recordDebt**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amountXPNTs

`bigint`

###### token

`Address`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### removeAutoApprovedSpender()

> **removeAutoApprovedSpender**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### spender

`Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### repayDebt()

> **repayDebt**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### setPaymasterLimit()

> **setPaymasterLimit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### limit

`bigint`

###### spender

`Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### setSuperPaymasterAddress()

> **setSuperPaymasterAddress**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### spAddress

`Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### spendingLimits()

> **spendingLimits**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

##### args

###### owner

`Address`

###### spender

`Address`

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

### SUPERPAYMASTER\_ADDRESS()

> **SUPERPAYMASTER\_ADDRESS**: (`args`) => `Promise`\<`Address`\>

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`Address`\>

### transferAndCall()

> **transferAndCall**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### data?

[`Hex`](https://viem.sh/docs/index.html)

###### to

`Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### transferCommunityOwnership()

> **transferCommunityOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newOwner

`Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### updateExchangeRate()

> **updateExchangeRate**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### newRate

`bigint`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### usedOpHashes()

> **usedOpHashes**: (`args`) => `Promise`\<`boolean`\>

#### Parameters

##### args

###### opHash

[`Hex`](https://viem.sh/docs/index.html)

###### token

`Address`

#### Returns

`Promise`\<`boolean`\>

### version()

> **version**: (`args`) => `Promise`\<`string`\>

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`string`\>
