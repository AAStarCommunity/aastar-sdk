Defined in: [packages/airaccount/src/server/services/paymaster-manager.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/paymaster-manager.ts#L15)

Thrown when a paymaster's on-chain price cache is stale.
Caller should invoke `paymasterManager.updatePrice(paymasterAddress)` before retrying.

## Extends

- `Error`

## Constructors

### Constructor

> **new PaymasterPriceStalenessError**(`paymasterAddress`, `ageSeconds`, `thresholdSeconds`): `PaymasterPriceStalenessError`

Defined in: [packages/airaccount/src/server/services/paymaster-manager.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/paymaster-manager.ts#L16)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `paymasterAddress` | `string` |
| `ageSeconds` | `number` |
| `thresholdSeconds` | `number` |

#### Returns

`PaymasterPriceStalenessError`

#### Overrides

`Error.constructor`

## Properties

### ageSeconds

> `readonly` **ageSeconds**: `number`

Defined in: [packages/airaccount/src/server/services/paymaster-manager.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/paymaster-manager.ts#L18)

***

### message

> **message**: `string`

Defined in: node\_modules/.pnpm/typescript@5.6.3/node\_modules/typescript/lib/lib.es5.d.ts:1077

#### Inherited from

`Error.message`

***

### name

> **name**: `string`

Defined in: node\_modules/.pnpm/typescript@5.6.3/node\_modules/typescript/lib/lib.es5.d.ts:1076

#### Inherited from

`Error.name`

***

### paymasterAddress

> `readonly` **paymasterAddress**: `string`

Defined in: [packages/airaccount/src/server/services/paymaster-manager.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/paymaster-manager.ts#L17)

***

### stack?

> `optional` **stack**: `string`

Defined in: node\_modules/.pnpm/typescript@5.6.3/node\_modules/typescript/lib/lib.es5.d.ts:1078

#### Inherited from

`Error.stack`

***

### thresholdSeconds

> `readonly` **thresholdSeconds**: `number`

Defined in: [packages/airaccount/src/server/services/paymaster-manager.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/paymaster-manager.ts#L19)

***

### prepareStackTrace()?

> `static` `optional` **prepareStackTrace**: (`err`, `stackTraces`) => `any`

Defined in: node\_modules/.pnpm/@types+node@20.11.5/node\_modules/@types/node/globals.d.ts:28

Optional override for formatting stack traces

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `err` | `Error` |
| `stackTraces` | `CallSite`[] |

#### Returns

`any`

#### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

#### Inherited from

`Error.prepareStackTrace`

***

### stackTraceLimit

> `static` **stackTraceLimit**: `number`

Defined in: node\_modules/.pnpm/@types+node@20.11.5/node\_modules/@types/node/globals.d.ts:30

#### Inherited from

`Error.stackTraceLimit`

## Methods

### captureStackTrace()

> `static` **captureStackTrace**(`targetObject`, `constructorOpt?`): `void`

Defined in: node\_modules/.pnpm/@types+node@20.11.5/node\_modules/@types/node/globals.d.ts:21

Create .stack property on a target object

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `targetObject` | `object` |
| `constructorOpt?` | `Function` |

#### Returns

`void`

#### Inherited from

`Error.captureStackTrace`
