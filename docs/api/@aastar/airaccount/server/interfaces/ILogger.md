Defined in: [packages/airaccount/src/server/interfaces/logger.ts:5](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/logger.ts#L5)

Optional logger interface for server SDK.
Implement this to integrate with your application's logging framework.

## Methods

### debug()

> **debug**(`message`, ...`args`): `void`

Defined in: [packages/airaccount/src/server/interfaces/logger.ts:6](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/logger.ts#L6)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| ...`args` | `unknown`[] |

#### Returns

`void`

***

### error()

> **error**(`message`, ...`args`): `void`

Defined in: [packages/airaccount/src/server/interfaces/logger.ts:9](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/logger.ts#L9)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| ...`args` | `unknown`[] |

#### Returns

`void`

***

### log()

> **log**(`message`, ...`args`): `void`

Defined in: [packages/airaccount/src/server/interfaces/logger.ts:7](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/logger.ts#L7)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| ...`args` | `unknown`[] |

#### Returns

`void`

***

### warn()

> **warn**(`message`, ...`args`): `void`

Defined in: [packages/airaccount/src/server/interfaces/logger.ts:8](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/interfaces/logger.ts#L8)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| ...`args` | `unknown`[] |

#### Returns

`void`
