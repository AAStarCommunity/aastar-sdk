Defined in: [packages/airaccount/src/server/services/kms-http-client.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-http-client.ts#L29)

Shared low-level HTTP transport for all KMS service classes.

Centralises axios setup (baseURL, x-api-key), the `enabled` gate, and the three
request flavours the KMS uses:
  - plain JSON         → `post` / `get`
  - AWS-KMS framed     → `amzPost` (adds x-amz-target + x-amz-json-1.1 content type)
  - agent/session JWT  → `postWithBearer` (Authorization: Bearer <jwt>)

KmsManager and the composed services (agent / session / payment / monitor) all share
one instance so they reuse the same connection config and auth headers.

## Constructors

### Constructor

> **new KmsHttpClient**(`options`): `KmsHttpClient`

Defined in: [packages/airaccount/src/server/services/kms-http-client.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-http-client.ts#L36)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `options` | [`KmsHttpClientOptions`](../interfaces/KmsHttpClientOptions.md) |

#### Returns

`KmsHttpClient`

## Properties

### enabled

> `readonly` **enabled**: `boolean`

Defined in: [packages/airaccount/src/server/services/kms-http-client.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-http-client.ts#L31)

***

### endpoint

> `readonly` **endpoint**: `string`

Defined in: [packages/airaccount/src/server/services/kms-http-client.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-http-client.ts#L30)

***

### logger

> `readonly` **logger**: [`ILogger`](../interfaces/ILogger.md)

Defined in: [packages/airaccount/src/server/services/kms-http-client.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-http-client.ts#L32)

## Methods

### amzPost()

> **amzPost**\<`T`\>(`path`, `target`, `body`): `Promise`\<`T`\>

Defined in: [packages/airaccount/src/server/services/kms-http-client.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-http-client.ts#L78)

POST with AWS-KMS framing (x-amz-target header) — required for wallet/signing ops.

#### Type Parameters

| Type Parameter |
| ------ |
| `T` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `path` | `string` |
| `target` | `string` |
| `body` | `unknown` |

#### Returns

`Promise`\<`T`\>

***

### ensureEnabled()

> **ensureEnabled**(): `void`

Defined in: [packages/airaccount/src/server/services/kms-http-client.ts:51](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-http-client.ts#L51)

Throw if KMS is not enabled — every operation must call this first.

#### Returns

`void`

***

### get()

> **get**\<`T`\>(`path`, `config?`): `Promise`\<`T`\>

Defined in: [packages/airaccount/src/server/services/kms-http-client.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-http-client.ts#L70)

Plain JSON GET.

#### Type Parameters

| Type Parameter |
| ------ |
| `T` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `path` | `string` |
| `config?` | `AxiosRequestConfig`\<`any`\> |

#### Returns

`Promise`\<`T`\>

***

### post()

> **post**\<`T`\>(`path`, `body?`, `config?`): `Promise`\<`T`\>

Defined in: [packages/airaccount/src/server/services/kms-http-client.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-http-client.ts#L62)

Plain JSON POST. The axios `config` arg is only forwarded when defined, so a
config-less call results in `http.post(path, body)` (2 args) — preserving the
exact call shape the existing unit tests assert against.

#### Type Parameters

| Type Parameter |
| ------ |
| `T` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `path` | `string` |
| `body?` | `unknown` |
| `config?` | `AxiosRequestConfig`\<`any`\> |

#### Returns

`Promise`\<`T`\>

***

### postWithBearer()

> **postWithBearer**\<`T`\>(`path`, `body`, `jwt`): `Promise`\<`T`\>

Defined in: [packages/airaccount/src/server/services/kms-http-client.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-http-client.ts#L88)

POST authenticated with a TEE-issued agent/session JWT (Authorization: Bearer).

#### Type Parameters

| Type Parameter |
| ------ |
| `T` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `path` | `string` |
| `body` | `unknown` |
| `jwt` | `string` |

#### Returns

`Promise`\<`T`\>
