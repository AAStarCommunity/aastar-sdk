> **ERC20Actions** = `object`

Defined in: [packages/core/src/actions/tokens.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/tokens.ts#L7)

## Properties

### allowance()

> **allowance**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/tokens.ts#L13)

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

Defined in: [packages/core/src/actions/tokens.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/tokens.ts#L12)

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

### balanceOf()

> **balanceOf**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/tokens.ts#L9)

#### Parameters

##### args

###### account

`Address`

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### decimals()

> **decimals**: (`args`) => `Promise`\<`number`\>

Defined in: [packages/core/src/actions/tokens.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/tokens.ts#L16)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`number`\>

***

### name()

> **name**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/tokens.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/tokens.ts#L14)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`string`\>

***

### symbol()

> **symbol**: (`args`) => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/tokens.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/tokens.ts#L15)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`string`\>

***

### totalSupply()

> **totalSupply**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/tokens.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/tokens.ts#L8)

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### transfer()

> **transfer**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/tokens.ts#L10)

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

### transferFrom()

> **transferFrom**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/tokens.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/tokens.ts#L11)

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
