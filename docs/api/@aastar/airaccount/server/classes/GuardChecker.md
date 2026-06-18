Defined in: [packages/airaccount/src/server/services/guard-checker.ts:33](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/guard-checker.ts#L33)

Pre-checks transactions against GlobalGuard before submitting on-chain.
Avoids wasted gas from predictable reverts.

## Constructors

### Constructor

> **new GuardChecker**(`ethereum`, `logger?`): `GuardChecker`

Defined in: [packages/airaccount/src/server/services/guard-checker.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/guard-checker.ts#L36)

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

Defined in: [packages/airaccount/src/server/services/guard-checker.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/guard-checker.ts#L63)

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

Defined in: [packages/airaccount/src/server/services/guard-checker.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/guard-checker.ts#L46)

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

Defined in: [packages/airaccount/src/server/services/guard-checker.ts:104](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/guard-checker.ts#L104)

Pre-check a transaction: determine tier, check guard limits and algorithm approval.
Returns errors array (empty = OK to proceed).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `accountAddress` | `string` |
| `value` | `bigint` |

#### Returns

`Promise`\<[`PreCheckResult`](../../interfaces/PreCheckResult.md)\>
