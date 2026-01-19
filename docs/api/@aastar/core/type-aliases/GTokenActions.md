> **GTokenActions** = [`ERC20Actions`](ERC20Actions.md) & `object`

Defined in: [packages/core/src/actions/tokens.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/actions/tokens.ts#L20)

## Type Declaration

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

### cap()

> **cap**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

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

### owner()

> **owner**: (`args`) => `Promise`\<`Address`\>

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`Address`\>

### remainingMintableSupply()

> **remainingMintableSupply**: (`args`) => `Promise`\<`bigint`\>

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`bigint`\>

### renounceOwnership()

> **renounceOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### token

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### transferOwnership()

> **transferOwnership**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

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

### version()

> **version**: (`args`) => `Promise`\<`string`\>

#### Parameters

##### args

###### token

`Address`

#### Returns

`Promise`\<`string`\>
