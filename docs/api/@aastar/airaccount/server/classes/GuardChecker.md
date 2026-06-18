Defined in: [packages/airaccount/src/server/services/guard-checker.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/guard-checker.ts#L39)

Pre-checks transactions against GlobalGuard before submitting on-chain.
Avoids wasted gas from predictable reverts.

## Constructors

### Constructor

> **new GuardChecker**(`ethereum`, `logger?`): `GuardChecker`

Defined in: [packages/airaccount/src/server/services/guard-checker.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/guard-checker.ts#L42)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `ethereum` | [`EthereumProvider`](EthereumProvider.md) |
| `logger?` | [`ILogger`](../interfaces/ILogger.md) |

#### Returns

`GuardChecker`

## Methods

### fetchGuardStatus()

> **fetchGuardStatus**(`accountAddress`): `Promise`\<[`GuardStatus`](../../interfaces/GuardStatus.md)\>

Defined in: [packages/airaccount/src/server/services/guard-checker.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/guard-checker.ts#L61)

Fetch guard status from the account's GlobalGuard.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `accountAddress` | `string` |

#### Returns

`Promise`\<[`GuardStatus`](../../interfaces/GuardStatus.md)\>

***

### fetchTierConfig()

> **fetchTierConfig**(`accountAddress`): `Promise`\<[`TierConfig`](../../interfaces/TierConfig.md)\>

Defined in: [packages/airaccount/src/server/services/guard-checker.ts:52](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/guard-checker.ts#L52)

Fetch tier limits from an AirAccount contract.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `accountAddress` | `string` |

#### Returns

`Promise`\<[`TierConfig`](../../interfaces/TierConfig.md)\>

***

### preCheck()

> **preCheck**(`accountAddress`, `value`): `Promise`\<[`PreCheckResult`](../../interfaces/PreCheckResult.md)\>

Defined in: [packages/airaccount/src/server/services/guard-checker.ts:97](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/guard-checker.ts#L97)

Pre-check a transaction: determine tier, check guard limits and algorithm approval.
Returns errors array (empty = OK to proceed).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `accountAddress` | `string` |
| `value` | `bigint` |

#### Returns

`Promise`\<[`PreCheckResult`](../../interfaces/PreCheckResult.md)\>
