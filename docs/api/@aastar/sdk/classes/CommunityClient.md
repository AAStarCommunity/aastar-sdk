Defined in: [packages/enduser/src/CommunityClient.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/CommunityClient.ts#L27)

Client for Community Managers (`ROLE_COMMUNITY`)

## Extends

- [`BaseClient`](BaseClient.md)

## Constructors

### Constructor

> **new CommunityClient**(`config`): `CommunityClient`

Defined in: [packages/enduser/src/CommunityClient.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/CommunityClient.ts#L32)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`CommunityClientConfig`](../interfaces/CommunityClientConfig.md) |

#### Returns

`CommunityClient`

#### Overrides

[`BaseClient`](BaseClient.md).[`constructor`](BaseClient.md#constructor)

## Properties

### client

> **client**: [`WalletClient`](../interfaces/WalletClient.md)

Defined in: [packages/core/src/clients/BaseClient.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/clients/BaseClient.ts#L6)

#### Inherited from

[`BaseClient`](BaseClient.md).[`client`](BaseClient.md#client)

***

### entryPointAddress?

> `protected` `optional` **entryPointAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/clients/BaseClient.ts#L12)

#### Inherited from

[`BaseClient`](BaseClient.md).[`entryPointAddress`](BaseClient.md#entrypointaddress)

***

### factoryAddress?

> `optional` **factoryAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/CommunityClient.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/CommunityClient.ts#L29)

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

### registryAddress?

> `protected` `optional` **registryAddress**: `` `0x${string}` ``

Defined in: [packages/core/src/clients/BaseClient.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/clients/BaseClient.ts#L8)

#### Inherited from

[`BaseClient`](BaseClient.md).[`registryAddress`](BaseClient.md#registryaddress)

***

### reputationAddress?

> `optional` **reputationAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/CommunityClient.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/CommunityClient.ts#L30)

***

### sbtAddress?

> `optional` **sbtAddress**: `` `0x${string}` ``

Defined in: [packages/enduser/src/CommunityClient.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/CommunityClient.ts#L28)

## Methods

### airdropSBT()

> **airdropSBT**(`users`, `roleId`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/enduser/src/CommunityClient.ts:309](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/CommunityClient.ts#L309)

Airdrop SBTs to users to make them members

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `users` | `` `0x${string}` ``[] |
| `roleId` | `bigint` |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### createCommunityToken()

> **createCommunityToken**(`params`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/enduser/src/CommunityClient.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/CommunityClient.ts#L50)

Create a new Community Token (xPNTs) and register it.
Note: In the current architecture, creating a community often involves:
1. Registering the ROLE_COMMUNITY on Registry (if not exists) -> usually manual or self-register
2. Deploying a Token (xPNTs) via Factory
3. Linking the Token to the Community in Registry

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`CreateCommunityParams`](../interfaces/CreateCommunityParams.md) |
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

### getCommunityInfo()

> **getCommunityInfo**(`communityAddress?`): `Promise`\<\{ `description`: `string`; `ensName`: `string`; `logoURI`: `string`; `name`: `string`; `stakeAmount`: `bigint`; `website`: `string`; \}\>

Defined in: [packages/enduser/src/CommunityClient.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/CommunityClient.ts#L76)

Get Community Details (Decodes Role Metadata)

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `communityAddress?` | `` `0x${string}` `` | The address of the community manager (defaults to self) |

#### Returns

`Promise`\<\{ `description`: `string`; `ensName`: `string`; `logoURI`: `string`; `name`: `string`; `stakeAmount`: `bigint`; `website`: `string`; \}\>

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

### registerAsCommunity()

> **registerAsCommunity**(`params`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/enduser/src/CommunityClient.ts:166](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/CommunityClient.ts#L166)

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
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) | Transaction options |

#### Returns

`Promise`\<`` `0x${string}` ``\>

Transaction hash

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

### revokeMembership()

> **revokeMembership**(`userAddr`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/enduser/src/CommunityClient.ts:360](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/CommunityClient.ts#L360)

Revoke membership (Burn SBT)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userAddr` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### setReputationRule()

> **setReputationRule**(`ruleId`, `ruleConfig`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/enduser/src/CommunityClient.ts:336](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/CommunityClient.ts#L336)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `ruleId` | `bigint` |
| `ruleConfig` | `any` |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### setupCommunity()

> **setupCommunity**(`params`, `options?`): `Promise`\<\{ `hashes`: `` `0x${string}` ``[]; `tokenAddress`: `` `0x${string}` ``; \}\>

Defined in: [packages/enduser/src/CommunityClient.ts:234](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/CommunityClient.ts#L234)

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
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<\{ `hashes`: `` `0x${string}` ``[]; `tokenAddress`: `` `0x${string}` ``; \}\>

***

### transferCommunityTokenOwnership()

> **transferCommunityTokenOwnership**(`tokenAddress`, `newOwner`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/enduser/src/CommunityClient.ts:377](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/enduser/src/CommunityClient.ts#L377)

Transfer ownership of the Community Token

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `tokenAddress` | `` `0x${string}` `` |
| `newOwner` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>
