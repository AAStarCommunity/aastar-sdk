Defined in: [operator/src/OperatorLifecycle.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/OperatorLifecycle.ts#L19)

OperatorLifecycle - L3 Pattern

Responsibilities:
1. Managing the complete lifecycle of a Paymaster Operator
2. Unifying setup (onboard), operation (config), and exit (withdraw)

## Extends

- [`PaymasterOperatorClient`](PaymasterOperatorClient.md)

## Constructors

### Constructor

> **new OperatorLifecycle**(`config`): `OperatorLifecycle`

Defined in: [operator/src/OperatorLifecycle.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/OperatorLifecycle.ts#L21)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`OperatorClientConfig`](../interfaces/OperatorClientConfig.md) |

#### Returns

`OperatorLifecycle`

#### Overrides

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`constructor`](PaymasterOperatorClient.md#constructor)

## Properties

### client

> **client**: [`WalletClient`](../../core/interfaces/WalletClient.md)

Defined in: core/dist/clients/BaseClient.d.ts:5

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`client`](PaymasterOperatorClient.md#client)

***

### entryPointAddress?

> `protected` `optional` **entryPointAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:11

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`entryPointAddress`](PaymasterOperatorClient.md#entrypointaddress)

***

### ethUsdPriceFeed

> **ethUsdPriceFeed**: `` `0x${string}` ``

Defined in: [operator/src/PaymasterOperatorClient.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/PaymasterOperatorClient.ts#L23)

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`ethUsdPriceFeed`](PaymasterOperatorClient.md#ethusdpricefeed)

***

### gTokenAddress?

> `protected` `optional` **gTokenAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:8

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`gTokenAddress`](PaymasterOperatorClient.md#gtokenaddress)

***

### gTokenStakingAddress?

> `protected` `optional` **gTokenStakingAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:9

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`gTokenStakingAddress`](PaymasterOperatorClient.md#gtokenstakingaddress)

***

### paymasterFactoryAddress?

> `protected` `optional` **paymasterFactoryAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:10

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`paymasterFactoryAddress`](PaymasterOperatorClient.md#paymasterfactoryaddress)

***

### publicClient?

> `optional` **publicClient**: [`PublicClient`](../../core/interfaces/PublicClient.md)

Defined in: core/dist/clients/BaseClient.d.ts:6

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`publicClient`](PaymasterOperatorClient.md#publicclient)

***

### registryAddress?

> `protected` `optional` **registryAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:7

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`registryAddress`](PaymasterOperatorClient.md#registryaddress)

***

### superPaymasterAddress

> **superPaymasterAddress**: `` `0x${string}` ``

Defined in: [operator/src/PaymasterOperatorClient.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/PaymasterOperatorClient.ts#L21)

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`superPaymasterAddress`](PaymasterOperatorClient.md#superpaymasteraddress)

***

### tokenAddress?

> `optional` **tokenAddress**: `` `0x${string}` ``

Defined in: [operator/src/PaymasterOperatorClient.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/PaymasterOperatorClient.ts#L22)

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`tokenAddress`](PaymasterOperatorClient.md#tokenaddress)

***

### xpntsFactory

> **xpntsFactory**: `` `0x${string}` ``

Defined in: [operator/src/PaymasterOperatorClient.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/PaymasterOperatorClient.ts#L24)

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`xpntsFactory`](PaymasterOperatorClient.md#xpntsfactory)

## Methods

### addGasToken()

> **addGasToken**(`token`, `price`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:415](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/PaymasterOperatorClient.ts#L415)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `token` | `` `0x${string}` `` |
| `price` | `bigint` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`addGasToken`](PaymasterOperatorClient.md#addgastoken)

***

### checkReadiness()

> **checkReadiness**(): `Promise`\<[`OperatorStatus`](../interfaces/OperatorStatus.md)\>

Defined in: [operator/src/OperatorLifecycle.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/OperatorLifecycle.ts#L33)

Check if the account is ready to become an operator
(e.g., has GToken, has ROLE_COMMUNITY, etc.)

#### Returns

`Promise`\<[`OperatorStatus`](../interfaces/OperatorStatus.md)\>

***

### configureOperator()

> **configureOperator**(`xPNTsToken?`, `treasury?`, `exchangeRate?`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:327](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/PaymasterOperatorClient.ts#L327)

Configure operator parameters (Token, Treasury, Exchange Rate).
If parameters are undefined, existing values are preserved.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `xPNTsToken?` | `` `0x${string}` `` |
| `treasury?` | `` `0x${string}` `` |
| `exchangeRate?` | `bigint` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`configureOperator`](PaymasterOperatorClient.md#configureoperator)

***

### deployAndRegisterPaymasterV4()

> **deployAndRegisterPaymasterV4**(`params?`, `options?`): `Promise`\<\{ `deployHash`: `` `0x${string}` ``; `paymasterAddress`: `` `0x${string}` ``; `registerHash`: `` `0x${string}` ``; \}\>

Defined in: [operator/src/PaymasterOperatorClient.ts:142](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/PaymasterOperatorClient.ts#L142)

Deploy a new Paymaster V4 and Register as AOA Operator (one-stop API).
This method handles:
1. Checks prerequisites (ROLE_COMMUNITY)
2. Predicts new Paymaster address
3. Deploys Paymaster V4 via Factory
4. Registers ROLE_PAYMASTER_AOA with staking

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `params?` | \{ `priceFeed?`: `` `0x${string}` ``; `salt?`: `bigint`; `stakeAmount?`: `bigint`; `version?`: `string`; \} | Deployment parameters |
| `params.priceFeed?` | `` `0x${string}` `` | - |
| `params.salt?` | `bigint` | - |
| `params.stakeAmount?` | `bigint` | - |
| `params.version?` | `string` | - |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) | Transaction options |

#### Returns

`Promise`\<\{ `deployHash`: `` `0x${string}` ``; `paymasterAddress`: `` `0x${string}` ``; `registerHash`: `` `0x${string}` ``; \}\>

Object containing new paymaster address and transaction hashes

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`deployAndRegisterPaymasterV4`](PaymasterOperatorClient.md#deployandregisterpaymasterv4)

***

### depositCollateral()

> **depositCollateral**(`amount`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:283](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/PaymasterOperatorClient.ts#L283)

Deposit collateral (aPNTs/GToken) to SuperPaymaster.
This is a helper method used by registerAsSuperPaymasterOperator.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `amount` | `bigint` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`depositCollateral`](PaymasterOperatorClient.md#depositcollateral)

***

### getAddress()

> **getAddress**(): `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:16

Get the account address of the connected wallet

#### Returns

`` `0x${string}` ``

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`getAddress`](PaymasterOperatorClient.md#getaddress)

***

### getOperatorDetails()

> **getOperatorDetails**(`operator?`): `Promise`\<`any`\>

Defined in: [operator/src/PaymasterOperatorClient.ts:378](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/PaymasterOperatorClient.ts#L378)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `operator?` | `` `0x${string}` `` |

#### Returns

`Promise`\<`any`\>

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`getOperatorDetails`](PaymasterOperatorClient.md#getoperatordetails)

***

### getOperatorStats()

> **getOperatorStats**(): `Promise`\<`any`\>

Defined in: [operator/src/OperatorLifecycle.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/OperatorLifecycle.ts#L94)

#### Returns

`Promise`\<`any`\>

***

### getStartPublicClient()

> **getStartPublicClient**(): [`PublicClient`](../../core/interfaces/PublicClient.md) \| [`WalletClient`](../../core/interfaces/WalletClient.md)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`\>

Defined in: core/dist/clients/BaseClient.d.ts:20

Helper to ensure public client exists or fallback to wallet client (if it supports read)

#### Returns

[`PublicClient`](../../core/interfaces/PublicClient.md) \| [`WalletClient`](../../core/interfaces/WalletClient.md)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html) \| `undefined`, [`Account`](https://viem.sh/docs/index.html) \| `undefined`\>

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`getStartPublicClient`](PaymasterOperatorClient.md#getstartpublicclient)

***

### getTokenPrice()

> **getTokenPrice**(`token`): `Promise`\<`bigint`\>

Defined in: [operator/src/PaymasterOperatorClient.ts:428](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/PaymasterOperatorClient.ts#L428)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `token` | `` `0x${string}` `` |

#### Returns

`Promise`\<`bigint`\>

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`getTokenPrice`](PaymasterOperatorClient.md#gettokenprice)

***

### initiateExit()

> **initiateExit**(`options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/OperatorLifecycle.ts:105](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/OperatorLifecycle.ts#L105)

Start the exit process: Unstake from Registry/SuperPaymaster and Unlock funds

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

#### Overrides

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`initiateExit`](PaymasterOperatorClient.md#initiateexit)

***

### isOperator()

> **isOperator**(`operator`): `Promise`\<`boolean`\>

Defined in: [operator/src/PaymasterOperatorClient.ts:368](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/PaymasterOperatorClient.ts#L368)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `operator` | `` `0x${string}` `` |

#### Returns

`Promise`\<`boolean`\>

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`isOperator`](PaymasterOperatorClient.md#isoperator)

***

### registerAsSuperPaymasterOperator()

> **registerAsSuperPaymasterOperator**(`params?`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/PaymasterOperatorClient.ts#L50)

Register as SuperPaymaster Operator (one-stop API).
This method handles all necessary steps:
1. Checks prerequisites (must have ROLE_COMMUNITY)
2. Checks and approves GToken to GTokenStaking
3. Registers ROLE_PAYMASTER_SUPER
4. Optionally deposits collateral to SuperPaymaster

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `params?` | \{ `depositAmount?`: `bigint`; `stakeAmount?`: `bigint`; \} | Registration parameters |
| `params.depositAmount?` | `bigint` | - |
| `params.stakeAmount?` | `bigint` | - |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) | Transaction options |

#### Returns

`Promise`\<`` `0x${string}` ``\>

Transaction hash of role registration

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`registerAsSuperPaymasterOperator`](PaymasterOperatorClient.md#registerassuperpaymasteroperator)

***

### requireEntryPoint()

> `protected` **requireEntryPoint**(): `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:25

#### Returns

`` `0x${string}` ``

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`requireEntryPoint`](PaymasterOperatorClient.md#requireentrypoint)

***

### requireGToken()

> `protected` **requireGToken**(): `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:22

#### Returns

`` `0x${string}` ``

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`requireGToken`](PaymasterOperatorClient.md#requiregtoken)

***

### requireGTokenStaking()

> `protected` **requireGTokenStaking**(): `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:23

#### Returns

`` `0x${string}` ``

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`requireGTokenStaking`](PaymasterOperatorClient.md#requiregtokenstaking)

***

### requirePaymasterFactory()

> `protected` **requirePaymasterFactory**(): `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:24

#### Returns

`` `0x${string}` ``

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`requirePaymasterFactory`](PaymasterOperatorClient.md#requirepaymasterfactory)

***

### requireRegistry()

> `protected` **requireRegistry**(): `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:21

#### Returns

`` `0x${string}` ``

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`requireRegistry`](PaymasterOperatorClient.md#requireregistry)

***

### setupNode()

> **setupNode**(`params`, `options?`): `Promise`\<`` `0x${string}` ``[]\>

Defined in: [operator/src/OperatorLifecycle.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/OperatorLifecycle.ts#L50)

One-click Setup: Register + Deposit + Deploy Node
Wraps existing registerAsSuperPaymasterOperator or deployAndRegisterPaymasterV4

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `depositAmount?`: `bigint`; `stakeAmount?`: `bigint`; `type`: `"V4"` \| `"SUPER"`; \} |
| `params.depositAmount?` | `bigint` |
| `params.stakeAmount?` | `bigint` |
| `params.type?` | `"V4"` \| `"SUPER"` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``[]\>

***

### setupPaymasterDeposit()

> **setupPaymasterDeposit**(`params`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:437](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/PaymasterOperatorClient.ts#L437)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `amount`: `bigint`; `paymaster`: `` `0x${string}` ``; `token`: `` `0x${string}` ``; `user`: `` `0x${string}` ``; \} |
| `params.amount` | `bigint` |
| `params.paymaster?` | `` `0x${string}` `` |
| `params.token?` | `` `0x${string}` `` |
| `params.user?` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`setupPaymasterDeposit`](PaymasterOperatorClient.md#setuppaymasterdeposit)

***

### updateExchangeRate()

> **updateExchangeRate**(`exchangeRate`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:319](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/PaymasterOperatorClient.ts#L319)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `exchangeRate` | `bigint` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`updateExchangeRate`](PaymasterOperatorClient.md#updateexchangerate)

***

### withdrawAllFunds()

> **withdrawAllFunds**(`to?`, `options?`): `Promise`\<`` `0x${string}` ``[]\>

Defined in: [operator/src/OperatorLifecycle.ts:113](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/OperatorLifecycle.ts#L113)

Finalize exit: Withdraw all funds (Collateral + Rewards)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `to?` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``[]\>

***

### withdrawCollateral()

> **withdrawCollateral**(`to`, `amount`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:355](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/PaymasterOperatorClient.ts#L355)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `to` | `` `0x${string}` `` |
| `amount` | `bigint` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`withdrawCollateral`](PaymasterOperatorClient.md#withdrawcollateral)

***

### withdrawStake()

> **withdrawStake**(`to`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:399](https://github.com/AAStarCommunity/aastar-sdk/blob/9c654bccf291bedf59c180131227065a5460e904/packages/operator/src/PaymasterOperatorClient.ts#L399)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `to` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

#### Inherited from

[`PaymasterOperatorClient`](PaymasterOperatorClient.md).[`withdrawStake`](PaymasterOperatorClient.md#withdrawstake)
