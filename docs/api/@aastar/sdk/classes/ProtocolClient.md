Defined in: [packages/operator/src/ProtocolClient.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/operator/src/ProtocolClient.ts#L25)

Client for Protocol Governors and Validators (Infrastructure)

## Extends

- [`BaseClient`](BaseClient.md)

## Constructors

### Constructor

> **new ProtocolClient**(`config`): `ProtocolClient`

Defined in: [packages/operator/src/ProtocolClient.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/operator/src/ProtocolClient.ts#L30)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`ProtocolClientConfig`](../interfaces/ProtocolClientConfig.md) |

#### Returns

`ProtocolClient`

#### Overrides

[`BaseClient`](BaseClient.md).[`constructor`](BaseClient.md#constructor)

## Properties

### blsAggregatorAddress?

> `optional` **blsAggregatorAddress**: `` `0x${string}` ``

Defined in: [packages/operator/src/ProtocolClient.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/operator/src/ProtocolClient.ts#L27)

***

### client

> **client**: [`WalletClient`](../interfaces/WalletClient.md)

Defined in: [packages/core/src/clients/BaseClient.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/BaseClient.ts#L6)

#### Inherited from

[`BaseClient`](BaseClient.md).[`client`](BaseClient.md#client)

***

### dvtValidatorAddress

> **dvtValidatorAddress**: `` `0x${string}` ``

Defined in: [packages/operator/src/ProtocolClient.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/operator/src/ProtocolClient.ts#L26)

***

### entryPointAddress?

> `protected` `optional` **entryPointAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/BaseClient.ts#L12)

#### Inherited from

[`BaseClient`](BaseClient.md).[`entryPointAddress`](BaseClient.md#entrypointaddress)

***

### gTokenAddress?

> `protected` `optional` **gTokenAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/BaseClient.ts#L9)

#### Inherited from

[`BaseClient`](BaseClient.md).[`gTokenAddress`](BaseClient.md#gtokenaddress)

***

### gTokenStakingAddress?

> `protected` `optional` **gTokenStakingAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:10](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/BaseClient.ts#L10)

#### Inherited from

[`BaseClient`](BaseClient.md).[`gTokenStakingAddress`](BaseClient.md#gtokenstakingaddress)

***

### paymasterFactoryAddress?

> `protected` `optional` **paymasterFactoryAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:11](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/BaseClient.ts#L11)

#### Inherited from

[`BaseClient`](BaseClient.md).[`paymasterFactoryAddress`](BaseClient.md#paymasterfactoryaddress)

***

### publicClient?

> `optional` **publicClient**: [`PublicClient`](../interfaces/PublicClient.md)

Defined in: [packages/core/src/clients/BaseClient.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/BaseClient.ts#L7)

#### Inherited from

[`BaseClient`](BaseClient.md).[`publicClient`](BaseClient.md#publicclient)

***

### registryAddress?

> `protected` `optional` **registryAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/BaseClient.ts#L8)

#### Inherited from

[`BaseClient`](BaseClient.md).[`registryAddress`](BaseClient.md#registryaddress)

***

### superPaymasterAddress?

> `optional` **superPaymasterAddress**: `` `0x${string}` ``

Defined in: [packages/operator/src/ProtocolClient.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/operator/src/ProtocolClient.ts#L28)

## Methods

### createProposal()

> **createProposal**(`target`, `calldata`, `description`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/operator/src/ProtocolClient.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/operator/src/ProtocolClient.ts#L44)

Create a new proposal

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `target` | `` `0x${string}` `` |
| `calldata` | `` `0x${string}` `` |
| `description` | `string` |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### executeWithProof()

> **executeWithProof**(`proposalId`, `signatures`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/operator/src/ProtocolClient.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/operator/src/ProtocolClient.ts#L78)

Execute a proposal with collected signatures

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `proposalId` | `bigint` |
| `signatures` | `` `0x${string}` ``[] |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### getAddress()

> **getAddress**(): `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:34](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/BaseClient.ts#L34)

Get the account address of the connected wallet

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](BaseClient.md).[`getAddress`](BaseClient.md#getaddress)

***

### getStartPublicClient()

> **getStartPublicClient**(): [`PublicClient`](../interfaces/PublicClient.md) \| [`WalletClient`](../interfaces/WalletClient.md)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`\>

Defined in: [packages/core/src/clients/BaseClient.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/BaseClient.ts#L41)

Helper to ensure public client exists or fallback to wallet client (if it supports read)

#### Returns

[`PublicClient`](../interfaces/PublicClient.md) \| [`WalletClient`](../interfaces/WalletClient.md)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`\>

#### Inherited from

[`BaseClient`](BaseClient.md).[`getStartPublicClient`](BaseClient.md#getstartpublicclient)

***

### registerBLSKey()

> **registerBLSKey**(`publicKey`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/operator/src/ProtocolClient.ts:101](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/operator/src/ProtocolClient.ts#L101)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `publicKey` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### requireEntryPoint()

> `protected` **requireEntryPoint**(): `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/BaseClient.ts#L73)

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](BaseClient.md).[`requireEntryPoint`](BaseClient.md#requireentrypoint)

***

### requireGToken()

> `protected` **requireGToken**(): `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/BaseClient.ts#L52)

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](BaseClient.md).[`requireGToken`](BaseClient.md#requiregtoken)

***

### requireGTokenStaking()

> `protected` **requireGTokenStaking**(): `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/BaseClient.ts#L59)

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](BaseClient.md).[`requireGTokenStaking`](BaseClient.md#requiregtokenstaking)

***

### requirePaymasterFactory()

> `protected` **requirePaymasterFactory**(): `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/BaseClient.ts#L66)

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](BaseClient.md).[`requirePaymasterFactory`](BaseClient.md#requirepaymasterfactory)

***

### requireRegistry()

> `protected` **requireRegistry**(): `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/clients/BaseClient.ts#L45)

#### Returns

`` `0x${string}` ``

#### Inherited from

[`BaseClient`](BaseClient.md).[`requireRegistry`](BaseClient.md#requireregistry)

***

### setProtocolFee()

> **setProtocolFee**(`bps`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/operator/src/ProtocolClient.ts:123](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/operator/src/ProtocolClient.ts#L123)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `bps` | `bigint` |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### setTreasury()

> **setTreasury**(`treasury`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/operator/src/ProtocolClient.ts:139](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/operator/src/ProtocolClient.ts#L139)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `treasury` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### signProposal()

> **signProposal**(`proposalId`, `signature`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/operator/src/ProtocolClient.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/operator/src/ProtocolClient.ts#L62)

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `proposalId` | `bigint` | `undefined` |
| `signature` | `` `0x${string}` `` | `'0x'` |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) | `undefined` |

#### Returns

`Promise`\<`` `0x${string}` ``\>
