Defined in: [packages/airaccount/src/server/services/bls-signature-service.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/bls-signature-service.ts#L36)

Raised when a DVT node (aNode YetAnotherAA-Validator ≥ v1.3.0, running with
`CONFIRM_ENABLED=true`) withholds its co-signature on a high-value op pending
out-of-band approval. The node returns `{ status: "pending_confirmation",
userOpHash }` instead of a signature; the withheld co-sign is released by
`POST /signature/confirm { userOpHash, token }` once the user approves over an
independent channel (single-use token, TTL, fail-closed). The SDK surfaces this
as a typed error rather than silently dropping the node so callers can drive the
confirm flow. Default-off nodes never emit this (behaviour == v1.2.0).

## Extends

- `Error`

## Constructors

### Constructor

> **new DvtPendingConfirmationError**(`userOpHash`, `nodeEndpoint`): `DvtPendingConfirmationError`

Defined in: [packages/airaccount/src/server/services/bls-signature-service.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/bls-signature-service.ts#L37)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userOpHash` | `string` |
| `nodeEndpoint` | `string` |

#### Returns

`DvtPendingConfirmationError`

#### Overrides

`Error.constructor`

## Properties

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

### nodeEndpoint

> `readonly` **nodeEndpoint**: `string`

Defined in: [packages/airaccount/src/server/services/bls-signature-service.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/bls-signature-service.ts#L39)

***

### stack?

> `optional` **stack**: `string`

Defined in: node\_modules/.pnpm/typescript@5.6.3/node\_modules/typescript/lib/lib.es5.d.ts:1078

#### Inherited from

`Error.stack`

***

### userOpHash

> `readonly` **userOpHash**: `string`

Defined in: [packages/airaccount/src/server/services/bls-signature-service.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/bls-signature-service.ts#L38)

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
