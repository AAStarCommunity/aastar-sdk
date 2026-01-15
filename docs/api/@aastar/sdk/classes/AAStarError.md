Defined in: [packages/sdk/src/errors/AAStarError.ts:13](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/sdk/src/errors/AAStarError.ts#L13)

## Extends

- `Error`

## Constructors

### Constructor

```ts
new AAStarError(
   message, 
   code, 
   details?): AAStarError;
```

Defined in: [packages/sdk/src/errors/AAStarError.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/sdk/src/errors/AAStarError.ts#L17)

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `message` | `string` | `undefined` |
| `code` | [`AAStarErrorCode`](../enumerations/AAStarErrorCode.md) | `AAStarErrorCode.UNKNOWN_ERROR` |
| `details?` | `any` | `undefined` |

#### Returns

`AAStarError`

#### Overrides

```ts
Error.constructor
```

## Properties

### cause?

```ts
optional cause: unknown;
```

Defined in: node\_modules/.pnpm/typescript@5.7.2/node\_modules/typescript/lib/lib.es2022.error.d.ts:26

#### Inherited from

```ts
Error.cause
```

***

### code

```ts
readonly code: AAStarErrorCode;
```

Defined in: [packages/sdk/src/errors/AAStarError.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/sdk/src/errors/AAStarError.ts#L14)

***

### details?

```ts
readonly optional details: any;
```

Defined in: [packages/sdk/src/errors/AAStarError.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/sdk/src/errors/AAStarError.ts#L15)

***

### message

```ts
message: string;
```

Defined in: node\_modules/.pnpm/typescript@5.7.2/node\_modules/typescript/lib/lib.es5.d.ts:1077

#### Inherited from

```ts
Error.message
```

***

### name

```ts
name: string;
```

Defined in: node\_modules/.pnpm/typescript@5.7.2/node\_modules/typescript/lib/lib.es5.d.ts:1076

#### Inherited from

```ts
Error.name
```

***

### stack?

```ts
optional stack: string;
```

Defined in: node\_modules/.pnpm/typescript@5.7.2/node\_modules/typescript/lib/lib.es5.d.ts:1078

#### Inherited from

```ts
Error.stack
```

***

### prepareStackTrace()?

```ts
static optional prepareStackTrace: (err, stackTraces) => any;
```

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

```ts
Error.prepareStackTrace
```

***

### stackTraceLimit

```ts
static stackTraceLimit: number;
```

Defined in: node\_modules/.pnpm/@types+node@20.11.5/node\_modules/@types/node/globals.d.ts:30

#### Inherited from

```ts
Error.stackTraceLimit
```

## Methods

### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

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

```ts
Error.captureStackTrace
```
