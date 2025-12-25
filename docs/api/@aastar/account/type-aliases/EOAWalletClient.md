> **EOAWalletClient** = [`WalletClient`](https://viem.sh/docs/index.html) & `object`

Defined in: [packages/account/src/eoa.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/4d5be576edce490d7405a108d648a390d96f3eb5/packages/account/src/eoa.ts#L4)

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
