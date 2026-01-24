Defined in: [index.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/tokens/src/index.ts#L16)

## Constructors

### Constructor

> **new FinanceClient**(`publicClient`, `walletClient`): `FinanceClient`

Defined in: [index.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/tokens/src/index.ts#L22)

Initialize FinanceClient

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `publicClient` | [`PublicClient`](../../core/interfaces/PublicClient.md) | The public client for queries |
| `walletClient` | [`WalletClient`](../../core/interfaces/WalletClient.md) | The wallet client for transactions |

#### Returns

`FinanceClient`

## Methods

### approveAndStake()

> **approveAndStake**(`amount`): `Promise`\<`` `0x${string}` ``\>

Defined in: [index.ts:159](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/tokens/src/index.ts#L159)

One-step stake: Approve (if needed) + Stake

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `amount` | `bigint` | Amount of GToken to stake |

#### Returns

`Promise`\<`` `0x${string}` ``\>

Transaction hash of the stake action

***

### getAPNTsBalance()

> **getAPNTsBalance**(`address`): `Promise`\<`bigint`\>

Defined in: [index.ts:143](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/tokens/src/index.ts#L143)

Get aPNTs balance

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `address` | `` `0x${string}` `` |

#### Returns

`Promise`\<`bigint`\>

***

### getCirculatingSupply()

> **getCirculatingSupply**(): `Promise`\<\{ `circulating`: `bigint`; `locked`: `bigint`; `total`: `bigint`; \}\>

Defined in: [index.ts:197](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/tokens/src/index.ts#L197)

Get circulating supply (total - locked)

#### Returns

`Promise`\<\{ `circulating`: `bigint`; `locked`: `bigint`; `total`: `bigint`; \}\>

***

### getGTokenBalance()

> **getGTokenBalance**(`address`): `Promise`\<`bigint`\>

Defined in: [index.ts:130](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/tokens/src/index.ts#L130)

Get GToken balance

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `address` | `` `0x${string}` `` |

#### Returns

`Promise`\<`bigint`\>

***

### getTokenomicsOverview()

> **getTokenomicsOverview**(): `Promise`\<\{ `circulatingSupply`: `bigint`; `stakingRatio`: `number`; `totalBurned`: `bigint`; `totalStaked`: `bigint`; `totalSupply`: `bigint`; \}\>

Defined in: [index.ts:224](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/tokens/src/index.ts#L224)

Get comprehensive tokenomics data

#### Returns

`Promise`\<\{ `circulatingSupply`: `bigint`; `stakingRatio`: `number`; `totalBurned`: `bigint`; `totalStaked`: `bigint`; `totalSupply`: `bigint`; \}\>

***

### ~~depositToEntryPoint()~~

> `static` **depositToEntryPoint**(`wallet`, `entryPoint`, `paymaster`, `amount`): `Promise`\<`` `0x${string}` ``\>

Defined in: [index.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/tokens/src/index.ts#L82)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | [`WalletClient`](../../core/interfaces/WalletClient.md) |
| `entryPoint` | `` `0x${string}` `` |
| `paymaster` | `` `0x${string}` `` |
| `amount` | `bigint` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

#### Deprecated

Use instance methods instead

***

### ~~depositToPaymaster()~~

> `static` **depositToPaymaster**(`wallet`, `paymaster`, `amount`): `Promise`\<`` `0x${string}` ``\>

Defined in: [index.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/tokens/src/index.ts#L30)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | [`WalletClient`](../../core/interfaces/WalletClient.md) |
| `paymaster` | `` `0x${string}` `` |
| `amount` | `bigint` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

#### Deprecated

Use instance methods instead

***

### ~~depositViaTransferAndCall()~~

> `static` **depositViaTransferAndCall**(`wallet`, `token`, `paymaster`, `amount`): `Promise`\<`` `0x${string}` ``\>

Defined in: [index.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/tokens/src/index.ts#L41)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | [`WalletClient`](../../core/interfaces/WalletClient.md) |
| `token` | `` `0x${string}` `` |
| `paymaster` | `` `0x${string}` `` |
| `amount` | `bigint` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

#### Deprecated

Use instance methods instead

***

### ~~getEntryPointBalance()~~

> `static` **getEntryPointBalance**(`client`, `entryPoint`, `account`): `Promise`\<`bigint`\>

Defined in: [index.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/tokens/src/index.ts#L94)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `client` | `any` |
| `entryPoint` | `` `0x${string}` `` |
| `account` | `` `0x${string}` `` |

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

Use instance methods instead

***

### ~~operatorDeposit()~~

> `static` **operatorDeposit**(`wallet`, `paymaster`, `amount`): `Promise`\<`` `0x${string}` ``\>

Defined in: [index.ts:104](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/tokens/src/index.ts#L104)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | [`WalletClient`](../../core/interfaces/WalletClient.md) |
| `paymaster` | `` `0x${string}` `` |
| `amount` | `bigint` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

#### Deprecated

Use instance methods instead

***

### ~~operatorNotifyDeposit()~~

> `static` **operatorNotifyDeposit**(`wallet`, `paymaster`, `amount`): `Promise`\<`` `0x${string}` ``\>

Defined in: [index.ts:115](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/tokens/src/index.ts#L115)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | [`WalletClient`](../../core/interfaces/WalletClient.md) |
| `paymaster` | `` `0x${string}` `` |
| `amount` | `bigint` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

#### Deprecated

Use instance methods instead

***

### ~~stakeGToken()~~

> `static` **stakeGToken**(`wallet`, `stakingAddr`, `amount`): `Promise`\<`` `0x${string}` ``\>

Defined in: [index.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/tokens/src/index.ts#L60)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | [`WalletClient`](../../core/interfaces/WalletClient.md) |
| `stakingAddr` | `` `0x${string}` `` |
| `amount` | `bigint` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

#### Deprecated

Use instance methods instead

***

### ~~withdrawProtocolRevenue()~~

> `static` **withdrawProtocolRevenue**(`wallet`, `paymaster`, `to`, `amount`): `Promise`\<`` `0x${string}` ``\>

Defined in: [index.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/tokens/src/index.ts#L71)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `wallet` | [`WalletClient`](../../core/interfaces/WalletClient.md) |
| `paymaster` | `` `0x${string}` `` |
| `to` | `` `0x${string}` `` |
| `amount` | `bigint` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

#### Deprecated

Use instance methods instead
