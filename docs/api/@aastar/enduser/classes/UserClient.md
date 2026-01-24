Defined in: [enduser/src/UserClient.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L17)

## Extends

- [`BaseClient`](../../core/classes/BaseClient.md)

## Constructors

### Constructor

> **new UserClient**(`config`): `UserClient`

Defined in: [enduser/src/UserClient.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`UserClientConfig`](../interfaces/UserClientConfig.md) |

#### Returns

`UserClient`

#### Overrides

[`BaseClient`](../../core/classes/BaseClient.md).[`constructor`](../../core/classes/BaseClient.md#constructor)

## Properties

### accountAddress

> **accountAddress**: `` `0x${string}` ``

Defined in: [enduser/src/UserClient.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L18)

***

### client

> **client**: [`WalletClient`](../../core/interfaces/WalletClient.md)

Defined in: core/dist/clients/BaseClient.d.ts:5

#### Inherited from

[`BaseClient`](../../core/classes/BaseClient.md).[`client`](../../core/classes/BaseClient.md#client)

***

### entryPointAddress?

> `optional` **entryPointAddress**: `` `0x${string}` ``

Defined in: [enduser/src/UserClient.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L20)

#### Overrides

[`BaseClient`](../../core/classes/BaseClient.md).[`entryPointAddress`](../../core/classes/BaseClient.md#entrypointaddress)

***

### gTokenAddress?

> `optional` **gTokenAddress**: `` `0x${string}` ``

Defined in: [enduser/src/UserClient.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L23)

#### Overrides

[`BaseClient`](../../core/classes/BaseClient.md).[`gTokenAddress`](../../core/classes/BaseClient.md#gtokenaddress)

***

### gTokenStakingAddress?

> `optional` **gTokenStakingAddress**: `` `0x${string}` ``

Defined in: [enduser/src/UserClient.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L21)

#### Overrides

[`BaseClient`](../../core/classes/BaseClient.md).[`gTokenStakingAddress`](../../core/classes/BaseClient.md#gtokenstakingaddress)

***

### paymasterFactoryAddress?

> `protected` `optional` **paymasterFactoryAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:10

#### Inherited from

[`BaseClient`](../../core/classes/BaseClient.md).[`paymasterFactoryAddress`](../../core/classes/BaseClient.md#paymasterfactoryaddress)

***

### publicClient?

> `optional` **publicClient**: [`PublicClient`](../../core/interfaces/PublicClient.md)

Defined in: core/dist/clients/BaseClient.d.ts:6

#### Inherited from

[`BaseClient`](../../core/classes/BaseClient.md).[`publicClient`](../../core/classes/BaseClient.md#publicclient)

***

### registryAddress?

> `optional` **registryAddress**: `` `0x${string}` ``

Defined in: [enduser/src/UserClient.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L22)

#### Overrides

[`BaseClient`](../../core/classes/BaseClient.md).[`registryAddress`](../../core/classes/BaseClient.md#registryaddress)

***

### sbtAddress?

> `optional` **sbtAddress**: `` `0x${string}` ``

Defined in: [enduser/src/UserClient.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L19)

## Methods

### execute()

> **execute**(`target`, `value`, `data`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/UserClient.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L72)

Execute a transaction from the AA account

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `target` | `` `0x${string}` `` |
| `value` | `bigint` |
| `data` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### executeBatch()

> **executeBatch**(`targets`, `values`, `datas`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/UserClient.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L91)

Execute a batch of transactions

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `targets` | `` `0x${string}` ``[] |
| `values` | `bigint`[] |
| `datas` | `` `0x${string}` ``[] |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### executeGasless()

> **executeGasless**(`params`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/UserClient.ts:365](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L365)

Execute a transaction with Gasless Sponsorship

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `data`: `` `0x${string}` ``; `paymaster`: `` `0x${string}` ``; `paymasterType`: `"V4"` \| `"Super"`; `target`: `` `0x${string}` ``; `value`: `bigint`; \} |
| `params.data` | `` `0x${string}` `` |
| `params.paymaster?` | `` `0x${string}` `` |
| `params.paymasterType?` | `"V4"` \| `"Super"` |
| `params.target?` | `` `0x${string}` `` |
| `params.value?` | `bigint` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### exitRole()

> **exitRole**(`roleId`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/UserClient.ts:250](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L250)

Exit a specific role (Cleanup registry status)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `roleId` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### getAddress()

> **getAddress**(): `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:16

Get the account address of the connected wallet

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](../../core/classes/BaseClient.md).[`getAddress`](../../core/classes/BaseClient.md#getaddress)

***

### getNonce()

> **getNonce**(`key`): `Promise`\<`bigint`\>

Defined in: [enduser/src/UserClient.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L42)

Get the nonce of the account from EntryPoint (more reliable for 4337)

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `key` | `bigint` | `0n` |

#### Returns

`Promise`\<`bigint`\>

***

### getOwner()

> **getOwner**(): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/UserClient.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L60)

Get the owner of the AA account

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### getSBTBalance()

> **getSBTBalance**(): `Promise`\<`bigint`\>

Defined in: [enduser/src/UserClient.ts:113](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L113)

Get user's SBT balance

#### Returns

`Promise`\<`bigint`\>

***

### getStakedBalance()

> **getStakedBalance**(`roleId`): `Promise`\<`bigint`\>

Defined in: [enduser/src/UserClient.ts:229](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L229)

Get staked balance for a specific role

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `roleId` | `` `0x${string}` `` |

#### Returns

`Promise`\<`bigint`\>

***

### getStartPublicClient()

> **getStartPublicClient**(): [`WalletClient`](../../core/interfaces/WalletClient.md)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`\> \| [`PublicClient`](../../core/interfaces/PublicClient.md)

Defined in: core/dist/clients/BaseClient.d.ts:20

Helper to ensure public client exists or fallback to wallet client (if it supports read)

#### Returns

[`WalletClient`](../../core/interfaces/WalletClient.md)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`\> \| [`PublicClient`](../../core/interfaces/PublicClient.md)

#### Inherited from

[`BaseClient`](../../core/classes/BaseClient.md).[`getStartPublicClient`](../../core/classes/BaseClient.md#getstartpublicclient)

***

### getTokenBalance()

> **getTokenBalance**(`token`): `Promise`\<`bigint`\>

Defined in: [enduser/src/UserClient.ts:170](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L170)

Get Token Balance

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `token` | `` `0x${string}` `` |

#### Returns

`Promise`\<`bigint`\>

***

### leaveCommunity()

> **leaveCommunity**(`community`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/UserClient.ts:267](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L267)

Leave a community (Burn SBT and clean up)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `community` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### mintSBT()

> **mintSBT**(`roleId`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/UserClient.ts:129](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L129)

Self-mint SBT for a role (user self-service)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `roleId` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### registerAsEndUser()

> **registerAsEndUser**(`communityAddress`, `stakeAmount`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/UserClient.ts:285](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L285)

Register as EndUser (One-click: Approve + Register)
Handles GToken approval to Staking contract and Role registration.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `communityAddress` | `` `0x${string}` `` |
| `stakeAmount` | `bigint` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### requireEntryPoint()

> `protected` **requireEntryPoint**(): `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:25

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](../../core/classes/BaseClient.md).[`requireEntryPoint`](../../core/classes/BaseClient.md#requireentrypoint)

***

### requireGToken()

> `protected` **requireGToken**(): `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:22

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](../../core/classes/BaseClient.md).[`requireGToken`](../../core/classes/BaseClient.md#requiregtoken)

***

### requireGTokenStaking()

> `protected` **requireGTokenStaking**(): `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:23

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](../../core/classes/BaseClient.md).[`requireGTokenStaking`](../../core/classes/BaseClient.md#requiregtokenstaking)

***

### requirePaymasterFactory()

> `protected` **requirePaymasterFactory**(): `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:24

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](../../core/classes/BaseClient.md).[`requirePaymasterFactory`](../../core/classes/BaseClient.md#requirepaymasterfactory)

***

### requireRegistry()

> `protected` **requireRegistry**(): `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:21

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](../../core/classes/BaseClient.md).[`requireRegistry`](../../core/classes/BaseClient.md#requireregistry)

***

### stakeForRole()

> **stakeForRole**(`roleId`, `amount`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/UserClient.ts:190](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L190)

Delegate stake to a role (Delegate to an operator/community)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `roleId` | `` `0x${string}` `` |
| `amount` | `bigint` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### transferToken()

> **transferToken**(`token`, `to`, `amount`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/UserClient.ts:152](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L152)

Transfer GToken or any ERC20

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `token` | `` `0x${string}` `` |
| `to` | `` `0x${string}` `` |
| `amount` | `bigint` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### unstakeFromRole()

> **unstakeFromRole**(`roleId`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/UserClient.ts:211](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/enduser/src/UserClient.ts#L211)

Unstake from a role

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `roleId` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>
