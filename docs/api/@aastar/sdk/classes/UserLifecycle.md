Defined in: [packages/enduser/src/UserLifecycle.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L40)

UserLifecycle - L3 Pattern

Responsibilities:
1. Managing the complete lifecycle of an End User (Onboard -> Operate -> Exit)
2. Providing a unified interface for Gasless operations
3. Abstracting underlying contract interactions via L2 Actions

## Extends

- [`BaseClient`](BaseClient.md)

## Constructors

### Constructor

> **new UserLifecycle**(`config`): `UserLifecycle`

Defined in: [packages/enduser/src/UserLifecycle.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L51)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`UserLifecycleConfig`](../interfaces/UserLifecycleConfig.md) |

#### Returns

`UserLifecycle`

#### Overrides

[`BaseClient`](BaseClient.md).[`constructor`](BaseClient.md#constructor)

## Properties

### accountAddress

> **accountAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserLifecycle.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L41)

***

### client

> **client**: [`WalletClient`](../interfaces/WalletClient.md)

Defined in: [packages/core/src/clients/BaseClient.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/clients/BaseClient.ts#L6)

#### Inherited from

[`BaseClient`](BaseClient.md).[`client`](BaseClient.md#client)

***

### config

> **config**: [`UserLifecycleConfig`](../interfaces/UserLifecycleConfig.md)

Defined in: [packages/enduser/src/UserLifecycle.ts:49](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L49)

***

### entryPointAddress

> **entryPointAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserLifecycle.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L46)

#### Overrides

[`BaseClient`](BaseClient.md).[`entryPointAddress`](BaseClient.md#entrypointaddress)

***

### gaslessConfig?

> `optional` **gaslessConfig**: [`GaslessConfig`](../interfaces/GaslessConfig.md)

Defined in: [packages/enduser/src/UserLifecycle.ts:47](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L47)

***

### gTokenAddress

> **gTokenAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserLifecycle.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L44)

#### Overrides

[`BaseClient`](BaseClient.md).[`gTokenAddress`](BaseClient.md#gtokenaddress)

***

### gTokenStakingAddress

> **gTokenStakingAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserLifecycle.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L45)

#### Overrides

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

Defined in: [packages/enduser/src/UserLifecycle.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L42)

#### Overrides

[`BaseClient`](BaseClient.md).[`registryAddress`](BaseClient.md#registryaddress)

***

### sbtAddress

> **sbtAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/UserLifecycle.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L43)

## Methods

### checkEligibility()

> **checkEligibility**(`community`): `Promise`\<`boolean`\>

Defined in: [packages/enduser/src/UserLifecycle.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L71)

Check if user is eligible to join a community

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `community` | `` `0x${string}` `` | Address of the community |

#### Returns

`Promise`\<`boolean`\>

***

### claimSBT()

> **claimSBT**(`roleId`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/enduser/src/UserLifecycle.ts:170](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L170)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `roleId` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### enableGasless()

> **enableGasless**(`config`): `Promise`\<`void`\>

Defined in: [packages/enduser/src/UserLifecycle.ts:123](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L123)

Enable or update Gasless configuration

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`GaslessConfig`](../interfaces/GaslessConfig.md) |

#### Returns

`Promise`\<`void`\>

***

### executeGaslessTx()

> **executeGaslessTx**(`params`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/enduser/src/UserLifecycle.ts:135](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L135)

Execute a transaction effectively using Gasless configuration if available

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `data`: `` `0x${string}` ``; `operator?`: `` `0x${string}` ``; `target`: `` `0x${string}` ``; `value`: `bigint`; \} |
| `params.data` | `` `0x${string}` `` |
| `params.operator?` | `` `0x${string}` `` |
| `params.target` | `` `0x${string}` `` |
| `params.value` | `bigint` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### exitRole()

> **exitRole**(`roleId`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/enduser/src/UserLifecycle.ts:217](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L217)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `roleId` | `` `0x${string}` `` |
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

### getCreditLimit()

> **getCreditLimit**(): `Promise`\<`bigint`\>

Defined in: [packages/enduser/src/UserLifecycle.ts:199](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L199)

#### Returns

`Promise`\<`bigint`\>

***

### getMyReputation()

> **getMyReputation**(): `Promise`\<[`ReputationData`](../interfaces/ReputationData.md)\>

Defined in: [packages/enduser/src/UserLifecycle.ts:183](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L183)

#### Returns

`Promise`\<[`ReputationData`](../interfaces/ReputationData.md)\>

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

### leaveCommunity()

> **leaveCommunity**(`community`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/enduser/src/UserLifecycle.ts:208](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L208)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `community` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### onboard()

> **onboard**(`community`, `stakeAmount`): `Promise`\<[`OnboardResult`](../interfaces/OnboardResult.md)\>

Defined in: [packages/enduser/src/UserLifecycle.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L84)

One-click Onboarding: Approve -> Stake -> Register -> Mint SBT

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `community` | `` `0x${string}` `` | Address of the community to join |
| `stakeAmount` | `bigint` | Amount of GToken to stake (default 0.4 GT) |

#### Returns

`Promise`\<[`OnboardResult`](../interfaces/OnboardResult.md)\>

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

### unstakeAll()

> **unstakeAll**(`roleId`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/enduser/src/UserLifecycle.ts:226](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/UserLifecycle.ts#L226)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `roleId` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>
