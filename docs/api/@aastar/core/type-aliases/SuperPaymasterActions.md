> **SuperPaymasterActions** = `object`

Defined in: [packages/core/src/actions/superPaymaster.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/superPaymaster.ts#L4)

## Properties

### depositAPNTs()

> **depositAPNTs**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/superPaymaster.ts#L5)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### depositETH()

> **depositETH**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/superPaymaster.ts#L8)

#### Parameters

##### args

###### account?

`Address`

###### value

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getAvailableCredit()

> **getAvailableCredit**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/superPaymaster.ts#L12)

#### Parameters

##### args

###### token

`Address`

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### getETHDeposit()

> **getETHDeposit**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/superPaymaster.ts#L10)

#### Returns

`Promise`\<`bigint`\>

***

### getOperatorInfo()

> **getOperatorInfo**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/superPaymaster.ts#L11)

#### Parameters

##### args

###### operator

`Address`

#### Returns

`Promise`\<`any`\>

***

### getXPNTsFactory()

> **getXPNTsFactory**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/superPaymaster.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/superPaymaster.ts#L14)

#### Returns

`Promise`\<`Address`\>

***

### requestSponsorship()

> **requestSponsorship**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/superPaymaster.ts#L7)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### operator

`Address`

###### userOp

`any`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setXPNTsFactory()

> **setXPNTsFactory**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/superPaymaster.ts#L13)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### factory

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### withdrawAPNTs()

> **withdrawAPNTs**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/superPaymaster.ts#L6)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### withdrawETHStake()

> **withdrawETHStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/superPaymaster.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/actions/superPaymaster.ts#L9)

#### Parameters

##### args

###### account?

`Address`

###### to

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
