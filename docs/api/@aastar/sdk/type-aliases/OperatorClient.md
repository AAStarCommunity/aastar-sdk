> **OperatorClient** = [`Client`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html), [`Account`](https://viem.sh/docs/index.html) \| `undefined`\> & [`PublicActions`](https://viem.sh/docs/index.html)\<[`Transport`](https://viem.sh/docs/index.html), [`Chain`](https://viem.sh/docs/index.html), [`Account`](https://viem.sh/docs/index.html) \| `undefined`\> & [`WalletActions`](https://viem.sh/docs/index.html)\<[`Chain`](https://viem.sh/docs/index.html), [`Account`](https://viem.sh/docs/index.html) \| `undefined`\> & [`RegistryActions`](RegistryActions.md) & [`SuperPaymasterActions`](SuperPaymasterActions.md) & [`PaymasterActions`](PaymasterActions.md) & [`StakingActions`](StakingActions.md) & `object`

Defined in: [packages/sdk/src/clients/operator.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/sdk/src/clients/operator.ts#L25)

## Type Declaration

### configureOperator()

> **configureOperator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `treasury`: `Address`; `xPNTsToken`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.treasury` | `Address` |
| `args.xPNTsToken` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### deployPaymasterV4()

> **deployPaymasterV4**: (`args?`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args?` | \{ `initData?`: [`Hex`](https://viem.sh/docs/index.html); `version?`: `string`; \} |
| `args.initData?` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.version?` | `string` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

### getOperatorStatus()

> **getOperatorStatus**: (`accountAddress`) => `Promise`\<\{ `paymasterV4`: \{ `address`: `Address`; `balance`: `bigint`; \} \| `null`; `superPaymaster`: \{ `balance`: `bigint`; `exchangeRate`: `bigint`; `hasRole`: `boolean`; `isConfigured`: `boolean`; `treasury`: `Address`; \} \| `null`; `type`: `"super"` \| `"v4"` \| `null`; \}\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `accountAddress` | `Address` |

#### Returns

`Promise`\<\{ `paymasterV4`: \{ `address`: `Address`; `balance`: `bigint`; \} \| `null`; `superPaymaster`: \{ `balance`: `bigint`; `exchangeRate`: `bigint`; `hasRole`: `boolean`; `isConfigured`: `boolean`; `treasury`: `Address`; \} \| `null`; `type`: `"super"` \| `"v4"` \| `null`; \}\>

### onboardOperator()

> **onboardOperator**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)[]\>

Orchestrates the full onboarding flow:
1. Approve GToken (Stake)
2. Register Role (Stake Lock)
3. Approve aPNTs (Deposit)
4. Deposit aPNTs (SuperPaymaster)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `depositAmount`: `bigint`; `roleData?`: [`Hex`](https://viem.sh/docs/index.html); `roleId`: [`Hex`](https://viem.sh/docs/index.html); `stakeAmount`: `bigint`; \} |
| `args.depositAmount` | `bigint` |
| `args.roleData?` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.stakeAmount` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)[]\>

### ~~onboardToSuperPaymaster()~~

> **onboardToSuperPaymaster**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)[]\>

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `depositAmount`: `bigint`; `roleId`: [`Hex`](https://viem.sh/docs/index.html); `stakeAmount`: `bigint`; \} |
| `args.depositAmount` | `bigint` |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.stakeAmount` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)[]\>

#### Deprecated

Use onboardOperator

### setup()

> **setup**: (`args`) => `Promise`\<\{ `txs`: [`Hash`](https://viem.sh/docs/index.html)[]; \}\>

High-level API: Setup operator with automatic funding and onboarding

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `depositAmount`: `bigint`; `roleData?`: [`Hex`](https://viem.sh/docs/index.html); `roleId`: [`Hex`](https://viem.sh/docs/index.html); `stakeAmount`: `bigint`; \} |
| `args.depositAmount` | `bigint` |
| `args.roleData?` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.roleId` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.stakeAmount` | `bigint` |

#### Returns

`Promise`\<\{ `txs`: [`Hash`](https://viem.sh/docs/index.html)[]; \}\>
