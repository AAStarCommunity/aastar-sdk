Defined in: [packages/admin/src/ProtocolGovernance.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/admin/src/ProtocolGovernance.ts#L20)

ProtocolGovernance - L3 Pattern

Responsibilities:
1. Global Protocol Parameter Management (Registry, EntryPoint)
2. High-level Governance Operations (DAO Transfer, Upgrades)
3. SuperPaymaster & Module Approval

## Extends

- [`BaseClient`](BaseClient.md)

## Constructors

### Constructor

> **new ProtocolGovernance**(`config`): `ProtocolGovernance`

Defined in: [packages/admin/src/ProtocolGovernance.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/admin/src/ProtocolGovernance.ts#L24)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`ClientConfig`](../interfaces/ClientConfig.md) & `object` |

#### Returns

`ProtocolGovernance`

#### Overrides

[`BaseClient`](BaseClient.md).[`constructor`](BaseClient.md#constructor)

## Properties

### client

> **client**: [`WalletClient`](../interfaces/WalletClient.md)

Defined in: [packages/core/src/clients/BaseClient.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/clients/BaseClient.ts#L6)

#### Inherited from

[`BaseClient`](BaseClient.md).[`client`](BaseClient.md#client)

***

### entryPointAddress

> **entryPointAddress**: `` `0x${string}` ``

Defined in: [packages/admin/src/ProtocolGovernance.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/admin/src/ProtocolGovernance.ts#L22)

#### Overrides

[`BaseClient`](BaseClient.md).[`entryPointAddress`](BaseClient.md#entrypointaddress)

***

### gTokenAddress?

> `protected` `optional` **gTokenAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/clients/BaseClient.ts#L9)

#### Inherited from

[`BaseClient`](BaseClient.md).[`gTokenAddress`](BaseClient.md#gtokenaddress)

***

### gTokenStakingAddress?

> `protected` `optional` **gTokenStakingAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/clients/BaseClient.ts#L10)

#### Inherited from

[`BaseClient`](BaseClient.md).[`gTokenStakingAddress`](BaseClient.md#gtokenstakingaddress)

***

### paymasterFactoryAddress?

> `protected` `optional` **paymasterFactoryAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/clients/BaseClient.ts#L11)

#### Inherited from

[`BaseClient`](BaseClient.md).[`paymasterFactoryAddress`](BaseClient.md#paymasterfactoryaddress)

***

### publicClient?

> `optional` **publicClient**: [`PublicClient`](../interfaces/PublicClient.md)

Defined in: [packages/core/src/clients/BaseClient.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/clients/BaseClient.ts#L7)

#### Inherited from

[`BaseClient`](BaseClient.md).[`publicClient`](BaseClient.md#publicclient)

***

### registryAddress

> **registryAddress**: `` `0x${string}` ``

Defined in: [packages/admin/src/ProtocolGovernance.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/admin/src/ProtocolGovernance.ts#L21)

#### Overrides

[`BaseClient`](BaseClient.md).[`registryAddress`](BaseClient.md#registryaddress)

## Methods

### configureRole()

> **configureRole**(`params`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/admin/src/ProtocolGovernance.ts:95](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/admin/src/ProtocolGovernance.ts#L95)

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
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### getAddress()

> **getAddress**(): `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/clients/BaseClient.ts#L34)

Get the account address of the connected wallet

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](BaseClient.md).[`getAddress`](BaseClient.md#getaddress)

***

### getProtocolParams()

> **getProtocolParams**(): `Promise`\<[`ProtocolParams`](../interfaces/ProtocolParams.md)\>

Defined in: [packages/admin/src/ProtocolGovernance.ts:137](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/admin/src/ProtocolGovernance.ts#L137)

#### Returns

`Promise`\<[`ProtocolParams`](../interfaces/ProtocolParams.md)\>

***

### getStartPublicClient()

> **getStartPublicClient**(): [`PublicClient`](../interfaces/PublicClient.md) \| [`WalletClient`](../interfaces/WalletClient.md)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`\>

Defined in: [packages/core/src/clients/BaseClient.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/clients/BaseClient.ts#L41)

Helper to ensure public client exists or fallback to wallet client (if it supports read)

#### Returns

[`PublicClient`](../interfaces/PublicClient.md) \| [`WalletClient`](../interfaces/WalletClient.md)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`\>

#### Inherited from

[`BaseClient`](BaseClient.md).[`getStartPublicClient`](BaseClient.md#getstartpublicclient)

***

### requireEntryPoint()

> `protected` **requireEntryPoint**(): `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/clients/BaseClient.ts#L73)

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](BaseClient.md).[`requireEntryPoint`](BaseClient.md#requireentrypoint)

***

### requireGToken()

> `protected` **requireGToken**(): `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/clients/BaseClient.ts#L52)

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](BaseClient.md).[`requireGToken`](BaseClient.md#requiregtoken)

***

### requireGTokenStaking()

> `protected` **requireGTokenStaking**(): `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/clients/BaseClient.ts#L59)

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](BaseClient.md).[`requireGTokenStaking`](BaseClient.md#requiregtokenstaking)

***

### requirePaymasterFactory()

> `protected` **requirePaymasterFactory**(): `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/clients/BaseClient.ts#L66)

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](BaseClient.md).[`requirePaymasterFactory`](BaseClient.md#requirepaymasterfactory)

***

### requireRegistry()

> `protected` **requireRegistry**(): `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/clients/BaseClient.ts#L45)

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](BaseClient.md).[`requireRegistry`](BaseClient.md#requireregistry)

***

### setStaking()

> **setStaking**(`staking`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/admin/src/ProtocolGovernance.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/admin/src/ProtocolGovernance.ts#L82)

Set the Staking contract address

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `staking` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### setSuperPaymaster()

> **setSuperPaymaster**(`paymaster`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/admin/src/ProtocolGovernance.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/admin/src/ProtocolGovernance.ts#L71)

Approve a new SuperPaymaster contract address

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `paymaster` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### setTreasury()

> **setTreasury**(`treasury`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/admin/src/ProtocolGovernance.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/admin/src/ProtocolGovernance.ts#L40)

Update the Global Treasury Address where protocol fees are collected

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `treasury` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### transferToDAO()

> **transferToDAO**(`daoAddress`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/admin/src/ProtocolGovernance.ts:125](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/admin/src/ProtocolGovernance.ts#L125)

Transfer Protocol Ownership to a DAO (Multisig/Timelock)
This is the final step of "Protocol Admin" lifecycle.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `daoAddress` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### updateEntryPoint()

> **updateEntryPoint**(`entryPoint`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/admin/src/ProtocolGovernance.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/admin/src/ProtocolGovernance.ts#L57)

Update the supported EntryPoint address

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `entryPoint` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>
