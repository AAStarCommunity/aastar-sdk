> **EOAWalletClient** = [`WalletClient`](https://viem.sh/docs/index.html) & `object`

Defined in: [packages/account/src/eoa.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/account/src/eoa.ts#L4)

## Type Declaration

### getAddress()

> **getAddress**: () => `Address`

#### Returns

`Address`

### sendTransaction()

> **sendTransaction**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

##### args

###### data?

[`Hex`](https://viem.sh/docs/index.html)

###### to

`Address`

###### value?

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
