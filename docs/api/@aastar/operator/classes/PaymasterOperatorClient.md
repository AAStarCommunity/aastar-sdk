Defined in: [operator/src/PaymasterOperatorClient.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L20)

Client for Paymaster Operators (ROLE_PAYMASTER_SUPER)

## Extends

- [`BaseClient`](../../sdk/classes/BaseClient.md)

## Extended by

- [`OperatorLifecycle`](OperatorLifecycle.md)

## Constructors

### Constructor

> **new PaymasterOperatorClient**(`config`): `PaymasterOperatorClient`

Defined in: [operator/src/PaymasterOperatorClient.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L26)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`OperatorClientConfig`](../interfaces/OperatorClientConfig.md) |

#### Returns

`PaymasterOperatorClient`

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

### ethUsdPriceFeed

> **ethUsdPriceFeed**: `` `0x${string}` ``

Defined in: [operator/src/PaymasterOperatorClient.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L23)

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

### superPaymasterAddress

> **superPaymasterAddress**: `` `0x${string}` ``

Defined in: [operator/src/PaymasterOperatorClient.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L21)

***

### tokenAddress?

> `optional` **tokenAddress**: `` `0x${string}` ``

Defined in: [operator/src/PaymasterOperatorClient.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L22)

***

### xpntsFactory

> **xpntsFactory**: `` `0x${string}` ``

Defined in: [operator/src/PaymasterOperatorClient.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L24)

## Methods

### addGasToken()

> **addGasToken**(`token`, `price`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:409](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L409)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `token` | `` `0x${string}` `` |
| `price` | `bigint` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### configureOperator()

> **configureOperator**(`xPNTsToken?`, `treasury?`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:324](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L324)

Configure operator parameters (Token, Treasury).
Exchange rate is now read live from xPNTsToken.exchangeRate() at runtime.
If parameters are undefined, existing values are preserved.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `xPNTsToken?` | `` `0x${string}` `` |
| `treasury?` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### deployAndRegisterPaymasterV4()

> **deployAndRegisterPaymasterV4**(`params?`, `options?`): `Promise`\<\{ `deployHash`: `` `0x${string}` ``; `paymasterAddress`: `` `0x${string}` ``; `registerHash`: `` `0x${string}` ``; \}\>

Defined in: [operator/src/PaymasterOperatorClient.ts:142](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L142)

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
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) | Transaction options |

#### Returns

`Promise`\<\{ `deployHash`: `` `0x${string}` ``; `paymasterAddress`: `` `0x${string}` ``; `registerHash`: `` `0x${string}` ``; \}\>

Object containing new paymaster address and transaction hashes

***

### depositCollateral()

> **depositCollateral**(`amount`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:283](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L283)

Deposit collateral (aPNTs/GToken) to SuperPaymaster.
This is a helper method used by registerAsSuperPaymasterOperator.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `amount` | `bigint` |
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

### getOperatorDetails()

> **getOperatorDetails**(`operator?`): `Promise`\<`any`\>

Defined in: [operator/src/PaymasterOperatorClient.ts:372](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L372)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `operator?` | `` `0x${string}` `` |

#### Returns

`Promise`\<`any`\>

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

### getTokenPrice()

> **getTokenPrice**(`token`): `Promise`\<`bigint`\>

Defined in: [operator/src/PaymasterOperatorClient.ts:422](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L422)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `token` | `` `0x${string}` `` |

#### Returns

`Promise`\<`bigint`\>

***

### initiateExit()

> **initiateExit**(`options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:382](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L382)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### isOperator()

> **isOperator**(`operator`): `Promise`\<`boolean`\>

Defined in: [operator/src/PaymasterOperatorClient.ts:362](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L362)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `operator` | `` `0x${string}` `` |

#### Returns

`Promise`\<`boolean`\>

***

### registerAsSuperPaymasterOperator()

> **registerAsSuperPaymasterOperator**(`params?`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L50)

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
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) | Transaction options |

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

### setupPaymasterDeposit()

> **setupPaymasterDeposit**(`params`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:431](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L431)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `amount`: `bigint`; `paymaster`: `` `0x${string}` ``; `token`: `` `0x${string}` ``; `user`: `` `0x${string}` ``; \} |
| `params.amount` | `bigint` |
| `params.paymaster?` | `` `0x${string}` `` |
| `params.token?` | `` `0x${string}` `` |
| `params.user?` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### withdrawCollateral()

> **withdrawCollateral**(`to`, `amount`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:349](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L349)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `to` | `` `0x${string}` `` |
| `amount` | `bigint` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### withdrawStake()

> **withdrawStake**(`to`, `options?`): `Promise`\<`` `0x${string}` ``\>

Defined in: [operator/src/PaymasterOperatorClient.ts:393](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/operator/src/PaymasterOperatorClient.ts#L393)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `to` | `` `0x${string}` `` |
| `options?` | [`TransactionOptions`](../../sdk/interfaces/TransactionOptions.md) |

#### Returns

`Promise`\<`` `0x${string}` ``\>
