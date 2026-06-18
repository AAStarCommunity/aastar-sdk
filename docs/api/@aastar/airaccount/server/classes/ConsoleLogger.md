Defined in: [packages/airaccount/src/server/interfaces/logger.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/logger.ts#L15)

Default console logger used when no custom logger is provided.

## Implements

- [`ILogger`](../interfaces/ILogger.md)

## Constructors

### Constructor

> **new ConsoleLogger**(`prefix`): `ConsoleLogger`

Defined in: [packages/airaccount/src/server/interfaces/logger.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/logger.ts#L16)

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `prefix` | `string` | `"[YAAA]"` |

#### Returns

`ConsoleLogger`

## Methods

### debug()

> **debug**(`message`, ...`args`): `void`

Defined in: [packages/airaccount/src/server/interfaces/logger.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/logger.ts#L18)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| ...`args` | `unknown`[] |

#### Returns

`void`

#### Implementation of

[`ILogger`](../interfaces/ILogger.md).[`debug`](../interfaces/ILogger.md#debug)

***

### error()

> **error**(`message`, ...`args`): `void`

Defined in: [packages/airaccount/src/server/interfaces/logger.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/logger.ts#L30)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| ...`args` | `unknown`[] |

#### Returns

`void`

#### Implementation of

[`ILogger`](../interfaces/ILogger.md).[`error`](../interfaces/ILogger.md#error)

***

### log()

> **log**(`message`, ...`args`): `void`

Defined in: [packages/airaccount/src/server/interfaces/logger.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/logger.ts#L22)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| ...`args` | `unknown`[] |

#### Returns

`void`

#### Implementation of

[`ILogger`](../interfaces/ILogger.md).[`log`](../interfaces/ILogger.md#log)

***

### warn()

> **warn**(`message`, ...`args`): `void`

Defined in: [packages/airaccount/src/server/interfaces/logger.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/interfaces/logger.ts#L26)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| ...`args` | `unknown`[] |

#### Returns

`void`

#### Implementation of

[`ILogger`](../interfaces/ILogger.md).[`warn`](../interfaces/ILogger.md#warn)
