Defined in: [admin/src/ProtocolGovernance.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/admin/src/ProtocolGovernance.ts#L20)

ProtocolGovernance - L3 Pattern

Responsibilities:
1. Global Protocol Parameter Management (Registry, EntryPoint)
2. High-level Governance Operations (DAO Transfer, Upgrades)
3. SuperPaymaster & Module Approval

## Extends

- [`BaseClient`](../../sdk/classes/BaseClient.md)

## Constructors

### Constructor

> **new ProtocolGovernance**(`config`): `ProtocolGovernance`

Defined in: [admin/src/ProtocolGovernance.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/admin/src/ProtocolGovernance.ts#L24)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`ClientConfig`](../../sdk/interfaces/ClientConfig.md) & `object` |

#### Returns

`ProtocolGovernance`

#### Overrides

[`BaseClient`](../../sdk/classes/BaseClient.md).[`constructor`](../../sdk/classes/BaseClient.md#constructor)

## Properties

### client

> **client**: [`WalletClient`](../../sdk/interfaces/WalletClient.md)

Defined in: core/dist/clients/BaseClient.d.ts:5

#### Inherited from

[`BaseClient`](../../sdk/classes/BaseClient.md).[`client`](../../sdk/classes/BaseClient.md#client)

***

### entryPointAddress

> **entryPointAddress**: `` `0x${string}` ``

Defined in: [admin/src/ProtocolGovernance.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/admin/src/ProtocolGovernance.ts#L22)

#### Overrides

[`BaseClient`](../../sdk/classes/BaseClient.md).[`entryPointAddress`](../../sdk/classes/BaseClient.md#entrypointaddress)

***

### gTokenAddress?

> `protected` `optional` **gTokenAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:8

#### Inherited from

[`BaseClient`](../../sdk/classes/BaseClient.md).[`gTokenAddress`](../../sdk/classes/BaseClient.md#gtokenaddress)

***

### gTokenStakingAddress?

> `protected` `optional` **gTokenStakingAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:9

#### Inherited from

[`BaseClient`](../../sdk/classes/BaseClient.md).[`gTokenStakingAddress`](../../sdk/classes/BaseClient.md#gtokenstakingaddress)

***

### paymasterFactoryAddress?

> `protected` `optional` **paymasterFactoryAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:10

#### Inherited from

[`BaseClient`](../../sdk/classes/BaseClient.md).[`paymasterFactoryAddress`](../../sdk/classes/BaseClient.md#paymasterfactoryaddress)

***

### publicClient?

> `optional` **publicClient**: [`PublicClient`](../../sdk/interfaces/PublicClient.md)

Defined in: core/dist/clients/BaseClient.d.ts:6

#### Inherited from

[`BaseClient`](../../sdk/classes/BaseClient.md).[`publicClient`](../../sdk/classes/BaseClient.md#publicclient)

***

### registryAddress

> **registryAddress**: `` `0x${string}` ``

Defined in: [admin/src/ProtocolGovernance.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/admin/src/ProtocolGovernance.ts#L21)

#### Overrides

[`BaseClient`](../../sdk/classes/BaseClient.md).[`registryAddress`](../../sdk/classes/BaseClient.md#registryaddress)

## Methods

### configureRole()

> **configureRole**(`params`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [admin/src/ProtocolGovernance.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/admin/src/ProtocolGovernance.ts#L95)

Configure a Role's parameters (Admin only).
Reads the current on-chain config first, then merges the provided overrides
and writes back the full struct via configureRole.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `exitFeePercent?`: `bigint`; `minExitFee?`: `bigint`; `minStake?`: `bigint`; `roleId`: `` `0x${string}` ``; `ticketPrice?`: `bigint`; \} |
| `params.exitFeePercent?` | `bigint` |
| `params.minExitFee?` | `bigint` |
| `params.minStake?` | `bigint` |
| `params.roleId?` | `` `0x${string}` `` |
| `params.ticketPrice?` | `bigint` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

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

[`BaseClient`](../../sdk/classes/BaseClient.md).[`getAddress`](../../sdk/classes/BaseClient.md#getaddress)

***

### getProtocolParams()

> **getProtocolParams**(): `Promise`\<[`ProtocolParams`](../interfaces/ProtocolParams.md)\>

Defined in: [admin/src/ProtocolGovernance.ts:137](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/admin/src/ProtocolGovernance.ts#L137)

#### Returns

`Promise`\<[`ProtocolParams`](../interfaces/ProtocolParams.md)\>

***

### getStartPublicClient()

> **getStartPublicClient**(): [`WalletClient`](../../sdk/interfaces/WalletClient.md)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`\> \| [`PublicClient`](../../sdk/interfaces/PublicClient.md)

Defined in: core/dist/clients/BaseClient.d.ts:20

Helper to ensure public client exists or fallback to wallet client (if it supports read)

#### Returns

[`WalletClient`](../../sdk/interfaces/WalletClient.md)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`\> \| [`PublicClient`](../../sdk/interfaces/PublicClient.md)

#### Inherited from

[`BaseClient`](../../sdk/classes/BaseClient.md).[`getStartPublicClient`](../../sdk/classes/BaseClient.md#getstartpublicclient)

***

### requireEntryPoint()

> `protected` **requireEntryPoint**(): `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:25

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](../../sdk/classes/BaseClient.md).[`requireEntryPoint`](../../sdk/classes/BaseClient.md#requireentrypoint)

***

### requireGToken()

> `protected` **requireGToken**(): `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:22

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](../../sdk/classes/BaseClient.md).[`requireGToken`](../../sdk/classes/BaseClient.md#requiregtoken)

***

### requireGTokenStaking()

> `protected` **requireGTokenStaking**(): `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:23

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](../../sdk/classes/BaseClient.md).[`requireGTokenStaking`](../../sdk/classes/BaseClient.md#requiregtokenstaking)

***

### requirePaymasterFactory()

> `protected` **requirePaymasterFactory**(): `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:24

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](../../sdk/classes/BaseClient.md).[`requirePaymasterFactory`](../../sdk/classes/BaseClient.md#requirepaymasterfactory)

***

### requireRegistry()

> `protected` **requireRegistry**(): `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:21

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](../../sdk/classes/BaseClient.md).[`requireRegistry`](../../sdk/classes/BaseClient.md#requireregistry)

***

### setStaking()

> **setStaking**(`staking`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [admin/src/ProtocolGovernance.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/admin/src/ProtocolGovernance.ts#L82)

Set the Staking contract address

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `staking` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### setSuperPaymaster()

> **setSuperPaymaster**(`paymaster`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [admin/src/ProtocolGovernance.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/admin/src/ProtocolGovernance.ts#L71)

Approve a new SuperPaymaster contract address

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `paymaster` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### setTreasury()

> **setTreasury**(`treasury`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [admin/src/ProtocolGovernance.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/admin/src/ProtocolGovernance.ts#L40)

Update the Global Treasury Address where protocol fees are collected

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `treasury` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### transferToDAO()

> **transferToDAO**(`daoAddress`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [admin/src/ProtocolGovernance.ts:125](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/admin/src/ProtocolGovernance.ts#L125)

Transfer Protocol Ownership to a DAO (Multisig/Timelock)
This is the final step of "Protocol Admin" lifecycle.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `daoAddress` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### updateEntryPoint()

> **updateEntryPoint**(`entryPoint`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [admin/src/ProtocolGovernance.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/admin/src/ProtocolGovernance.ts#L57)

Update the supported EntryPoint address

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `entryPoint` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>
