> **StakingActions** = `object`

Defined in: [packages/core/src/actions/staking.ts:4](https://github.com/AAStarCommunity/aastar-sdk/blob/77dddacf493396832f1a40715c8e5cda4ba43c65/packages/core/src/actions/staking.ts#L4)

## Properties

### getStakeInfo()

> **getStakeInfo**: (`args`) => `Promise`\<`any`\>

Defined in: [packages/core/src/actions/staking.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/77dddacf493396832f1a40715c8e5cda4ba43c65/packages/core/src/actions/staking.ts#L7)

#### Parameters

##### args

###### operator

`Address`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

#### Returns

`Promise`\<`any`\>

***

### getStakingBalance()

> **getStakingBalance**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/staking.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/77dddacf493396832f1a40715c8e5cda4ba43c65/packages/core/src/actions/staking.ts#L8)

#### Parameters

##### args

###### user

`Address`

#### Returns

`Promise`\<`bigint`\>

***

### lockStake()

> **lockStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/77dddacf493396832f1a40715c8e5cda4ba43c65/packages/core/src/actions/staking.ts#L5)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### entryBurn

`bigint`

###### payer

`Address`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### stakeAmount

`bigint`

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setAuthorizedSlasher()

> **setAuthorizedSlasher**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/77dddacf493396832f1a40715c8e5cda4ba43c65/packages/core/src/actions/staking.ts#L10)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### authorized

`boolean`

###### slasher

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### slashByDVT()

> **slashByDVT**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/77dddacf493396832f1a40715c8e5cda4ba43c65/packages/core/src/actions/staking.ts#L9)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### amount

`bigint`

###### reason

`string`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### unlockStake()

> **unlockStake**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/staking.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/77dddacf493396832f1a40715c8e5cda4ba43c65/packages/core/src/actions/staking.ts#L6)

#### Parameters

##### args

###### account?

[`Account`](https://viem.sh/docs/index.html) \| `Address`

###### roleId

[`Hex`](https://viem.sh/docs/index.html)

###### user

`Address`

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
