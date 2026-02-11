Defined in: [enduser/src/UserClient.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L17)

## Extends

- [`BaseClient`](../../core/classes/BaseClient.md)

## Constructors

### Constructor

> **new UserClient**(`config`): `UserClient`

Defined in: [enduser/src/UserClient.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L26)

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

Defined in: [enduser/src/UserClient.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L18)

***

### bundlerClient?

> `optional` **bundlerClient**: `any`

Defined in: [enduser/src/UserClient.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L24)

***

### client

> **client**: [`WalletClient`](../../core/interfaces/WalletClient.md)

Defined in: core/dist/clients/BaseClient.d.ts:5

#### Inherited from

[`BaseClient`](../../core/classes/BaseClient.md).[`client`](../../core/classes/BaseClient.md#client)

***

### entryPointAddress?

> `optional` **entryPointAddress**: `` `0x${string}` ``

Defined in: [enduser/src/UserClient.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L20)

#### Overrides

[`BaseClient`](../../core/classes/BaseClient.md).[`entryPointAddress`](../../core/classes/BaseClient.md#entrypointaddress)

***

### gTokenAddress?

> `optional` **gTokenAddress**: `` `0x${string}` ``

Defined in: [enduser/src/UserClient.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L23)

#### Overrides

[`BaseClient`](../../core/classes/BaseClient.md).[`gTokenAddress`](../../core/classes/BaseClient.md#gtokenaddress)

***

### gTokenStakingAddress?

> `optional` **gTokenStakingAddress**: `` `0x${string}` ``

Defined in: [enduser/src/UserClient.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L21)

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

Defined in: [enduser/src/UserClient.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L22)

#### Overrides

[`BaseClient`](../../core/classes/BaseClient.md).[`registryAddress`](../../core/classes/BaseClient.md#registryaddress)

***

### sbtAddress?

> `optional` **sbtAddress**: `` `0x${string}` ``

Defined in: [enduser/src/UserClient.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L19)

## Methods

### execute()

> **execute**(`target`, `value`, `data`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/UserClient.ts:155](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L155)

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

Defined in: [enduser/src/UserClient.ts:174](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L174)

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

Defined in: [enduser/src/UserClient.ts:441](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L441)

Execute a transaction with Gasless Sponsorship

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `data`: `` `0x${string}` ``; `maxRate?`: `bigint`; `operator?`: `` `0x${string}` ``; `paymaster`: `` `0x${string}` ``; `paymasterType`: `"V4"` \| `"Super"`; `target`: `` `0x${string}` ``; `value`: `bigint`; \} |
| `params.data` | `` `0x${string}` `` |
| `params.maxRate?` | `bigint` |
| `params.operator?` | `` `0x${string}` `` |
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

Defined in: [enduser/src/UserClient.ts:320](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L320)

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

Defined in: [enduser/src/UserClient.ts:125](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L125)

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

Defined in: [enduser/src/UserClient.ts:143](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L143)

Get the owner of the AA account

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### getSBTBalance()

> **getSBTBalance**(): `Promise`\<`bigint`\>

Defined in: [enduser/src/UserClient.ts:196](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L196)

Get user's SBT balance

#### Returns

`Promise`\<`bigint`\>

***

### getStakedBalance()

> **getStakedBalance**(`roleId`): `Promise`\<`bigint`\>

Defined in: [enduser/src/UserClient.ts:302](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L302)

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

Defined in: [enduser/src/UserClient.ts:248](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L248)

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

Defined in: [enduser/src/UserClient.ts:337](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L337)

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

Defined in: [enduser/src/UserClient.ts:209](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L209)

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

Defined in: [enduser/src/UserClient.ts:358](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L358)

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

Defined in: [enduser/src/UserClient.ts:265](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L265)

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

Defined in: [enduser/src/UserClient.ts:230](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L230)

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

Defined in: [enduser/src/UserClient.ts:282](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L282)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `roleId` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### deployAccount()

> `static` **deployAccount**(`client`, `params`): `Promise`\<\{ `accountAddress`: `` `0x${string}` ``; `hash`: `` `0x${string}` ``; \}\>

Defined in: [enduser/src/UserClient.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/enduser/src/UserClient.ts#L45)

Deploy a new Smart Account (Supports multiple factory types)
Static helper to facilitate onboarding before instantiating the UserClient.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `client` | `any` | WalletClient to sign the deployment transaction |
| `params` | \{ `accountType?`: `string`; `customAbi?`: `any`; `factoryAddress?`: `` `0x${string}` ``; `owner`: `` `0x${string}` ``; `publicClient?`: `any`; `salt?`: `bigint`; \} | Deployment parameters |
| `params.accountType?` | `string` | - |
| `params.customAbi?` | `any` | - |
| `params.factoryAddress?` | `` `0x${string}` `` | - |
| `params.owner` | `` `0x${string}` `` | - |
| `params.publicClient?` | `any` | - |
| `params.salt?` | `bigint` | - |

#### Returns

`Promise`\<\{ `accountAddress`: `` `0x${string}` ``; `hash`: `` `0x${string}` ``; \}\>

Object containing the deployed account address and transaction hash
