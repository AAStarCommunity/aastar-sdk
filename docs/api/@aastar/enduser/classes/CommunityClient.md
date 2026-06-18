Defined in: [enduser/src/CommunityClient.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/CommunityClient.ts#L27)

Client for Community Managers (`ROLE_COMMUNITY`)

## Extends

- [`BaseClient`](../../sdk/classes/BaseClient.md)

## Constructors

### Constructor

> **new CommunityClient**(`config`): `CommunityClient`

Defined in: [enduser/src/CommunityClient.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/CommunityClient.ts#L32)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`CommunityClientConfig`](../interfaces/CommunityClientConfig.md) |

#### Returns

`CommunityClient`

#### Overrides

[`BaseClient`](../../sdk/classes/BaseClient.md).[`constructor`](../../sdk/classes/BaseClient.md#constructor)

## Properties

### client

> **client**: [`WalletClient`](../../sdk/interfaces/WalletClient.md)

Defined in: core/dist/clients/BaseClient.d.ts:5

#### Inherited from

[`BaseClient`](../../sdk/classes/BaseClient.md).[`client`](../../sdk/classes/BaseClient.md#client)

***

### entryPointAddress?

> `protected` `optional` **entryPointAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:11

#### Inherited from

[`BaseClient`](../../sdk/classes/BaseClient.md).[`entryPointAddress`](../../sdk/classes/BaseClient.md#entrypointaddress)

***

### factoryAddress?

> `optional` **factoryAddress**: `` `0x${string}` ``

Defined in: [enduser/src/CommunityClient.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/CommunityClient.ts#L29)

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

### reputationAddress?

> `optional` **reputationAddress**: `` `0x${string}` ``

Defined in: [enduser/src/CommunityClient.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/CommunityClient.ts#L30)

***

### sbtAddress?

> `optional` **sbtAddress**: `` `0x${string}` ``

Defined in: [enduser/src/CommunityClient.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/CommunityClient.ts#L28)

## Methods

### airdropSBT()

> **airdropSBT**(`users`, `roleId`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/CommunityClient.ts:309](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/CommunityClient.ts#L309)

Airdrop SBTs to users to make them members

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `users` | `` `0x${string}` ``[] |
| `roleId` | `bigint` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### createCommunityToken()

> **createCommunityToken**(`params`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/CommunityClient.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/CommunityClient.ts#L50)

Create a new Community Token (xPNTs) and register it.
Note: In the current architecture, creating a community often involves:
1. Registering the ROLE_COMMUNITY on Registry (if not exists) -> usually manual or self-register
2. Deploying a Token (xPNTs) via Factory
3. Linking the Token to the Community in Registry

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`CreateCommunityParams`](../interfaces/CreateCommunityParams.md) |
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

### getCommunityInfo()

> **getCommunityInfo**(`communityAddress?`): `Promise`\<\{ `description`: `string`; `ensName`: `string`; `logoURI`: `string`; `name`: `string`; `stakeAmount`: `bigint`; `website`: `string`; \}\>

Defined in: [enduser/src/CommunityClient.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/CommunityClient.ts#L76)

Get Community Details (Decodes Role Metadata)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `communityAddress?` | `` `0x${string}` `` | The address of the community manager (defaults to self) |

#### Returns

`Promise`\<\{ `description`: `string`; `ensName`: `string`; `logoURI`: `string`; `name`: `string`; `stakeAmount`: `bigint`; `website`: `string`; \}\>

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

### registerAsCommunity()

> **registerAsCommunity**(`params`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/CommunityClient.ts:166](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/CommunityClient.ts#L166)

Register self as a Community Manager.
This method handles all necessary steps:
1. Checks and approves GToken to GTokenStaking
2. Encodes CommunityRoleData with provided parameters
3. Calls registerRoleSelf on Registry

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `params` | \{ `description?`: `string`; `ensName?`: `string`; `logoURI?`: `string`; `name`: `string`; `stakeAmount?`: `bigint`; `website?`: `string`; \} | Community registration parameters |
| `params.description?` | `string` | - |
| `params.ensName?` | `string` | - |
| `params.logoURI?` | `string` | - |
| `params.name?` | `string` | - |
| `params.stakeAmount?` | `bigint` | - |
| `params.website?` | `string` | - |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) | Transaction options |

#### Returns

`Promise`\<`` `0x${string}` ``\>

Transaction hash

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

### revokeMembership()

> **revokeMembership**(`userAddr`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/CommunityClient.ts:360](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/CommunityClient.ts#L360)

Revoke membership (Burn SBT)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userAddr` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### setReputationRule()

> **setReputationRule**(`ruleId`, `ruleConfig`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/CommunityClient.ts:336](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/CommunityClient.ts#L336)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `ruleId` | `bigint` |
| `ruleConfig` | `any` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### setupCommunity()

> **setupCommunity**(`params`, `options?`): `Promise`\<\{ `hashes`: `` `0x${string}` ``[]; `tokenAddress`: `` `0x${string}` ``; \}\>

Defined in: [enduser/src/CommunityClient.ts:234](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/CommunityClient.ts#L234)

One-click Setup: Register Community + Deploy Token
Orchestrates the complete community initialization flow.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `description?`: `string`; `logoURI?`: `string`; `name`: `string`; `stakeAmount?`: `bigint`; `tokenName`: `string`; `tokenSymbol`: `string`; `website?`: `string`; \} |
| `params.description?` | `string` |
| `params.logoURI?` | `string` |
| `params.name?` | `string` |
| `params.stakeAmount?` | `bigint` |
| `params.tokenName?` | `string` |
| `params.tokenSymbol?` | `string` |
| `params.website?` | `string` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<\{ `hashes`: `` `0x${string}` ``[]; `tokenAddress`: `` `0x${string}` ``; \}\>

***

### transferCommunityTokenOwnership()

> **transferCommunityTokenOwnership**(`tokenAddress`, `newOwner`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [enduser/src/CommunityClient.ts:377](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/enduser/src/CommunityClient.ts#L377)

Transfer ownership of the Community Token

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `tokenAddress` | `` `0x${string}` `` |
| `newOwner` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>
