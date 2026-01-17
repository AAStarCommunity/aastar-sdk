> **TokenActions** = `object`

Defined in: [packages/core/src/actions/tokens.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L7)

## Properties

### addAutoApprovedSpender()

> **addAutoApprovedSpender**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L67)

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

***

### allowance()

> **allowance**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L14)

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

***

### approve()

> **approve**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L13)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### spender

`Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### autoApprovedSpenders()

> **autoApprovedSpenders**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/tokens.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L61)

#### Parameters

##### args

###### spender

`Address`

###### token

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### balanceOf()

> **balanceOf**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L10)

#### Parameters

##### args

###### account

`Address`

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### burn()

> **burn**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L18)

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

***

### burnFrom()

> **burnFrom**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L19)

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

***

### burnFromWithOpHash()

> **burnFromWithOpHash**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L35)

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

***

### communityENS()

> **communityENS**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/tokens.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L53)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`string`\>

***

### communityName()

> **communityName**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/tokens.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L54)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`string`\>

***

### communityOwner()

> **communityOwner**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/tokens.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L37)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`Address`\>

***

### cumulativeSpent()

> **cumulativeSpent**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L47)

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

***

### debts()

> **debts**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L33)

#### Parameters

##### args

###### token

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### decimals()

> **decimals**: (`args`) => `Promise`\<`number`\>

Defined in: [packages/core/src/actions/tokens.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L24)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`number`\>

***

### DEFAULT\_SPENDING\_LIMIT\_APNTS()

> **DEFAULT\_SPENDING\_LIMIT\_APNTS**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L49)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### DOMAIN\_SEPARATOR()

> **DOMAIN\_SEPARATOR**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L59)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### eip712Domain()

> **eip712Domain**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/tokens.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L63)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`any`\>

***

### exchangeRate()

> **exchangeRate**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L32)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### FACTORY()

> **FACTORY**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/tokens.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L73)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`Address`\>

***

### getDebt()

> **getDebt**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L41)

#### Parameters

##### args

###### token

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getDefaultSpendingLimitXPNTs()

> **getDefaultSpendingLimitXPNTs**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L50)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getMetadata()

> **getMetadata**: (`args`) => `Promise`\<\{ `ens`: `string`; `logo`: `string`; `name`: `string`; `owner`: `Address`; `symbol`: `string`; \}\>

Defined in: [packages/core/src/actions/tokens.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L55)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<\{ `ens`: `string`; `logo`: `string`; `name`: `string`; `owner`: `Address`; `symbol`: `string`; \}\>

***

### isAutoApprovedSpender()

> **isAutoApprovedSpender**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/tokens.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L69)

#### Parameters

##### args

###### spender

`Address`

###### token

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### mint()

> **mint**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L17)

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

***

### name()

> **name**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/tokens.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L22)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`string`\>

***

### needsApproval()

> **needsApproval**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/tokens.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L62)

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

***

### nonces()

> **nonces**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L60)

#### Parameters

##### args

###### owner

`Address`

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### owner()

> **owner**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/tokens.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L27)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`Address`\>

***

### permit()

> **permit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L64)

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

***

### recordDebt()

> **recordDebt**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L34)

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

***

### removeAutoApprovedSpender()

> **removeAutoApprovedSpender**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L68)

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

***

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L29)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### repayDebt()

> **repayDebt**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L42)

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

***

### setPaymasterLimit()

> **setPaymasterLimit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L48)

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

***

### setSuperPaymasterAddress()

> **setSuperPaymasterAddress**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L39)

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

***

### spendingLimits()

> **spendingLimits**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L46)

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

***

### SUPERPAYMASTER\_ADDRESS()

> **SUPERPAYMASTER\_ADDRESS**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/tokens.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L72)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`Address`\>

***

### symbol()

> **symbol**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/tokens.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L23)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`string`\>

***

### totalSupply()

> **totalSupply**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L9)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### transfer()

> **transfer**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L11)

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

***

### transferAndCall()

> **transferAndCall**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L43)

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

***

### transferCommunityOwnership()

> **transferCommunityOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L38)

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

***

### transferFrom()

> **transferFrom**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L12)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### from

`Address`

###### to

`Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L28)

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

***

### updateExchangeRate()

> **updateExchangeRate**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L40)

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

***

### usedOpHashes()

> **usedOpHashes**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/tokens.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L36)

#### Parameters

##### args

###### opHash

[`Hex`](https://viem.sh/docs/index.html)

###### token

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### version()

> **version**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/tokens.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/f3911a6f6e88b2f77186db63ad0182c2cfe13b9d/packages/core/src/actions/tokens.ts#L56)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`string`\>
