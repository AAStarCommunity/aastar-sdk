> **TokenActions** = `object`

Defined in: [packages/core/src/actions/tokens.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L5)

## Properties

### tokenAddAutoApprovedSpender()

> **tokenAddAutoApprovedSpender**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L38)

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

### tokenAllowance()

> **tokenAllowance**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L14)

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

### tokenApprove()

> **tokenApprove**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L13)

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

### tokenAutoApprovedSpenders()

> **tokenAutoApprovedSpenders**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/tokens.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L66)

#### Parameters

##### args

###### spender

`Address`

###### token

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### tokenBalanceOf()

> **tokenBalanceOf**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L8)

#### Parameters

##### args

###### account

`Address`

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### tokenBurn()

> **tokenBurn**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L18)

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

### tokenBurnFrom()

> **tokenBurnFrom**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L19)

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

### tokenBurnFromWithOpHash()

> **tokenBurnFromWithOpHash**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L67)

#### Parameters

##### args

###### account

`Address`

###### amount

`bigint`

###### opHash

[`Hex`](https://viem.sh/docs/index.html)

###### token

`Address`

###### userOpAccount?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### tokenCap()

> **tokenCap**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L9)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### tokenCommunityENS()

> **tokenCommunityENS**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/tokens.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L52)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`string`\>

***

### tokenCommunityName()

> **tokenCommunityName**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/tokens.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L51)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`string`\>

***

### tokenCommunityOwner()

> **tokenCommunityOwner**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/tokens.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L68)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`Address`\>

***

### tokenCumulativeSpent()

> **tokenCumulativeSpent**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:56](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L56)

#### Parameters

##### args

###### token

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### tokenDebts()

> **tokenDebts**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L57)

#### Parameters

##### args

###### token

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### tokenDecimals()

> **tokenDecimals**: (`args`) => `Promise`\<`number`\>

Defined in: [packages/core/src/actions/tokens.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L24)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`number`\>

***

### tokenDEFAULT\_SPENDING\_LIMIT\_APNTS()

> **tokenDEFAULT\_SPENDING\_LIMIT\_APNTS**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L74)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### tokenDefaultSpendingLimitXPNTs()

> **tokenDefaultSpendingLimitXPNTs**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L55)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### tokenDOMAIN\_SEPARATOR()

> **tokenDOMAIN\_SEPARATOR**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L61)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### tokenEip712Domain()

> **tokenEip712Domain**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/tokens.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L69)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`any`\>

***

### tokenExchangeRate()

> **tokenExchangeRate**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L53)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### tokenFACTORY()

> **tokenFACTORY**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/tokens.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L44)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`Address`\>

***

### tokenGetDebt()

> **tokenGetDebt**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L33)

#### Parameters

##### args

###### token

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### tokenGetDefaultSpendingLimitXPNTs()

> **tokenGetDefaultSpendingLimitXPNTs**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L70)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### tokenGetMetadata()

> **tokenGetMetadata**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/tokens.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L71)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`string`\>

***

### tokenIsAutoApprovedSpender()

> **tokenIsAutoApprovedSpender**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/tokens.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L40)

#### Parameters

##### args

###### spender

`Address`

###### token

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### tokenMint()

> **tokenMint**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L17)

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

### tokenName()

> **tokenName**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/tokens.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L22)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`string`\>

***

### tokenNeedsApproval()

> **tokenNeedsApproval**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/tokens.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L72)

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

### tokenNonces()

> **tokenNonces**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L62)

#### Parameters

##### args

###### owner

`Address`

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### tokenOwner()

> **tokenOwner**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/tokens.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L27)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`Address`\>

***

### tokenPermit()

> **tokenPermit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L63)

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

### tokenRecordDebt()

> **tokenRecordDebt**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L73)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### token

`Address`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### tokenRemainingMintableSupply()

> **tokenRemainingMintableSupply**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L10)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### tokenRemoveAutoApprovedSpender()

> **tokenRemoveAutoApprovedSpender**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L39)

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

### tokenRenounceOwnership()

> **tokenRenounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L29)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### tokenRepayDebt()

> **tokenRepayDebt**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L34)

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

### tokenSetPaymasterLimit()

> **tokenSetPaymasterLimit**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L77)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### limit

`bigint`

###### token

`Address`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### tokenSetSuperPaymasterAddress()

> **tokenSetSuperPaymasterAddress**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L78)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### superPaymaster

`Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### tokenSpendingLimits()

> **tokenSpendingLimits**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:54](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L54)

#### Parameters

##### args

###### token

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### tokenSUPERPAYMASTER\_ADDRESS()

> **tokenSUPERPAYMASTER\_ADDRESS**: (`args`) => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/tokens.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L43)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`Address`\>

***

### tokenSymbol()

> **tokenSymbol**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/tokens.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L23)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`string`\>

***

### tokenTotalSupply()

> **tokenTotalSupply**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L7)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### tokenTransfer()

> **tokenTransfer**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L11)

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

### tokenTransferAndCall()

> **tokenTransferAndCall**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L35)

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

### tokenTransferCommunityOwnership()

> **tokenTransferCommunityOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L48)

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

### tokenTransferFrom()

> **tokenTransferFrom**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L12)

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

### tokenTransferOwnership()

> **tokenTransferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L47)

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

### tokenTransferTokenOwnership()

> **tokenTransferTokenOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L28)

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

### tokenUpdateExchangeRate()

> **tokenUpdateExchangeRate**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L32)

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

### tokenUsedOpHashes()

> **tokenUsedOpHashes**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/tokens.ts:58](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L58)

#### Parameters

##### args

###### hash

[`Hex`](https://viem.sh/docs/index.html)

###### token

`Address`

#### Returns

`Promise`\<`boolean`\>

***

### tokenVersion()

> **tokenVersion**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/tokens.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/actions/tokens.ts#L79)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`string`\>
