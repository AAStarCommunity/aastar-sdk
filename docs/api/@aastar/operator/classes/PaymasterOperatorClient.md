Defined in: [operator/src/PaymasterOperatorClient.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L20)

Client for Paymaster Operators (ROLE_PAYMASTER_SUPER)

## Extends

- [`BaseClient`](../../core/classes/BaseClient.md)

## Extended by

- [`OperatorLifecycle`](OperatorLifecycle.md)

## Constructors

### Constructor

> **new PaymasterOperatorClient**(`config`): `PaymasterOperatorClient`

Defined in: [operator/src/PaymasterOperatorClient.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L26)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`OperatorClientConfig`](../interfaces/OperatorClientConfig.md) |

#### Returns

`PaymasterOperatorClient`

#### Overrides

[`BaseClient`](../../core/classes/BaseClient.md).[`constructor`](../../core/classes/BaseClient.md#constructor)

## Properties

### client

> **client**: [`WalletClient`](../../core/interfaces/WalletClient.md)

Defined in: core/dist/clients/BaseClient.d.ts:5

#### Inherited from

[`BaseClient`](../../core/classes/BaseClient.md).[`client`](../../core/classes/BaseClient.md#client)

***

### entryPointAddress?

> `protected` `optional` **entryPointAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:11

#### Inherited from

[`BaseClient`](../../core/classes/BaseClient.md).[`entryPointAddress`](../../core/classes/BaseClient.md#entrypointaddress)

***

### ethUsdPriceFeed

> **ethUsdPriceFeed**: `` `0x${string}` ``

Defined in: [operator/src/PaymasterOperatorClient.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L23)

***

### gTokenAddress?

> `protected` `optional` **gTokenAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:8

#### Inherited from

[`BaseClient`](../../core/classes/BaseClient.md).[`gTokenAddress`](../../core/classes/BaseClient.md#gtokenaddress)

***

### gTokenStakingAddress?

> `protected` `optional` **gTokenStakingAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:9

#### Inherited from

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

> `protected` `optional` **registryAddress**: `` `0x${string}` ``

Defined in: core/dist/clients/BaseClient.d.ts:7

#### Inherited from

[`BaseClient`](../../core/classes/BaseClient.md).[`registryAddress`](../../core/classes/BaseClient.md#registryaddress)

***

### superPaymasterAddress

> **superPaymasterAddress**: `` `0x${string}` ``

Defined in: [operator/src/PaymasterOperatorClient.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L21)

***

### tokenAddress?

> `optional` **tokenAddress**: `` `0x${string}` ``

Defined in: [operator/src/PaymasterOperatorClient.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L22)

***

### xpntsFactory

> **xpntsFactory**: `` `0x${string}` ``

Defined in: [operator/src/PaymasterOperatorClient.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L24)

## Methods

### addGasToken()

> **addGasToken**(`token`, `price`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:415](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L415)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `token` | `` `0x${string}` `` |
| `price` | `bigint` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### configureOperator()

> **configureOperator**(`xPNTsToken?`, `treasury?`, `exchangeRate?`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:327](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L327)

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

***

### deployAndRegisterPaymasterV4()

> **deployAndRegisterPaymasterV4**(`params?`, `options?`): `Promise`\<\{ `deployHash`: `` `0x${string}` ``; `paymasterAddress`: `` `0x${string}` ``; `registerHash`: `` `0x${string}` ``; \}\>

Defined in: [operator/src/PaymasterOperatorClient.ts:142](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L142)

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

***

### depositCollateral()

> **depositCollateral**(`amount`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:283](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L283)

Deposit collateral (aPNTs/GToken) to SuperPaymaster.
This is a helper method used by registerAsSuperPaymasterOperator.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `amount` | `bigint` |
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

### getOperatorDetails()

> **getOperatorDetails**(`operator?`): `Promise`\<`any`\>

Defined in: [operator/src/PaymasterOperatorClient.ts:378](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L378)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `operator?` | `` `0x${string}` `` |

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

[`BaseClient`](../../core/classes/BaseClient.md).[`getStartPublicClient`](../../core/classes/BaseClient.md#getstartpublicclient)

***

### getTokenPrice()

> **getTokenPrice**(`token`): `Promise`\<`bigint`\>

Defined in: [operator/src/PaymasterOperatorClient.ts:428](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L428)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `token` | `` `0x${string}` `` |

#### Returns

`Promise`\<`bigint`\>

***

### initiateExit()

> **initiateExit**(`options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:388](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L388)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### isOperator()

> **isOperator**(`operator`): `Promise`\<`boolean`\>

Defined in: [operator/src/PaymasterOperatorClient.ts:368](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L368)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `operator` | `` `0x${string}` `` |

#### Returns

`Promise`\<`boolean`\>

***

### registerAsSuperPaymasterOperator()

> **registerAsSuperPaymasterOperator**(`params?`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L50)

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

### setupPaymasterDeposit()

> **setupPaymasterDeposit**(`params`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:437](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L437)

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

***

### updateExchangeRate()

> **updateExchangeRate**(`exchangeRate`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:319](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L319)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `exchangeRate` | `bigint` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### withdrawCollateral()

> **withdrawCollateral**(`to`, `amount`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:355](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L355)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `to` | `` `0x${string}` `` |
| `amount` | `bigint` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### withdrawStake()

> **withdrawStake**(`to`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:399](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/operator/src/PaymasterOperatorClient.ts#L399)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `to` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../core/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>
