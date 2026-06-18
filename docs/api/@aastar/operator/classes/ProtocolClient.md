Defined in: [operator/src/ProtocolClient.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/operator/src/ProtocolClient.ts#L25)

Client for Protocol Governors and Validators (Infrastructure)

## Extends

- [`BaseClient`](../../sdk/classes/BaseClient.md)

## Constructors

### Constructor

> **new ProtocolClient**(`config`): `ProtocolClient`

Defined in: [operator/src/ProtocolClient.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/operator/src/ProtocolClient.ts#L30)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`ProtocolClientConfig`](../interfaces/ProtocolClientConfig.md) |

#### Returns

`ProtocolClient`

#### Overrides

[`BaseClient`](../../sdk/classes/BaseClient.md).[`constructor`](../../sdk/classes/BaseClient.md#constructor)

## Properties

### blsAggregatorAddress?

> `optional` **blsAggregatorAddress**: `` `0x${string}` ``

Defined in: [operator/src/ProtocolClient.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/operator/src/ProtocolClient.ts#L27)

***

### client

> **client**: [`WalletClient`](../../sdk/interfaces/WalletClient.md)

Defined in: core/dist/clients/BaseClient.d.ts:5

#### Inherited from

[`BaseClient`](../../sdk/classes/BaseClient.md).[`client`](../../sdk/classes/BaseClient.md#client)

***

### dvtValidatorAddress

> **dvtValidatorAddress**: `` `0x${string}` ``

Defined in: [operator/src/ProtocolClient.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/operator/src/ProtocolClient.ts#L26)

***

### entryPointAddress?

> `protected` `optional` **entryPointAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:11

#### Inherited from

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

### registryAddress?

> `protected` `optional` **registryAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:7

#### Inherited from

[`BaseClient`](../../sdk/classes/BaseClient.md).[`registryAddress`](../../sdk/classes/BaseClient.md#registryaddress)

***

### superPaymasterAddress?

> `optional` **superPaymasterAddress**: `` `0x${string}` ``

Defined in: [operator/src/ProtocolClient.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/operator/src/ProtocolClient.ts#L28)

## Methods

### createProposal()

> **createProposal**(`target`, `calldata`, `description`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/ProtocolClient.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/operator/src/ProtocolClient.ts#L44)

Create a new proposal

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `target` | `` `0x${string}` `` |
| `calldata` | `` `0x${string}` `` |
| `description` | `string` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### executeWithProof()

> **executeWithProof**(`proposalId`, `signatures`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/ProtocolClient.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/operator/src/ProtocolClient.ts#L78)

Execute a proposal with collected signatures

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `proposalId` | `bigint` |
| `signatures` | `` `0x${string}` ``[] |
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

### getStartPublicClient()

> **getStartPublicClient**(): [`PublicClient`](../../sdk/interfaces/PublicClient.md) \| [`WalletClient`](../../sdk/interfaces/WalletClient.md)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`\>

Defined in: core/dist/clients/BaseClient.d.ts:20

Helper to ensure public client exists or fallback to wallet client (if it supports read)

#### Returns

[`PublicClient`](../../sdk/interfaces/PublicClient.md) \| [`WalletClient`](../../sdk/interfaces/WalletClient.md)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`\>

#### Inherited from

[`BaseClient`](../../sdk/classes/BaseClient.md).[`getStartPublicClient`](../../sdk/classes/BaseClient.md#getstartpublicclient)

***

### registerBLSKey()

> **registerBLSKey**(`publicKey`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/ProtocolClient.ts:101](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/operator/src/ProtocolClient.ts#L101)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `publicKey` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

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

### setProtocolFee()

> **setProtocolFee**(`bps`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/ProtocolClient.ts:123](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/operator/src/ProtocolClient.ts#L123)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `bps` | `bigint` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### setTreasury()

> **setTreasury**(`treasury`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/ProtocolClient.ts:139](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/operator/src/ProtocolClient.ts#L139)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `treasury` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### signProposal()

> **signProposal**(`proposalId`, `signature`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/ProtocolClient.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/operator/src/ProtocolClient.ts#L62)

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `proposalId` | `bigint` | `undefined` |
| `signature` | `` `0x${string}` `` | `'0x'` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) | `undefined` |

#### Returns

`Promise`\<`` `0x${string}` ``\>
