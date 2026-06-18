Defined in: [packages/airaccount/src/server/services/kms-session-service.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-session-service.ts#L88)

Manages the lifecycle of a P-256 session key minted under a human key for
ERC-4337 UserOp signing (AAStar TEE KMS v0.20.0).

A session key is created under a root (human) key, used to sign UserOps via a
TEE-issued bearer JWT (the `agentCredential`), and eventually revoked. The
per-UserOp signature is the 149-byte P256 session-key wire format.

Relationship to [KmsManager.signP256GrantSession](KmsManager.md#signp256grantsession): that method signs the
GRANT_P256_SESSION_V2 authorization needed to *install* this key on-chain
(granting the session key its on-chain scope/policies). This service instead
manages the session key's own lifecycle (create / sign / revoke) once granted.

Create and revoke are WebAuthn-gated: the challenge originates from a generic
[KmsManager.beginAuthentication](KmsManager.md#beginauthentication) ceremony and the caller supplies the
resulting assertion. Per-UserOp signing authenticates with the bearer JWT.

Wraps a shared [KmsHttpClient](KmsHttpClient.md) — pass `KmsManager.httpClient`.

## Constructors

### Constructor

> **new KmsSessionService**(`http`): `KmsSessionService`

Defined in: [packages/airaccount/src/server/services/kms-session-service.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-session-service.ts#L89)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `http` | [`KmsHttpClient`](KmsHttpClient.md) |

#### Returns

`KmsSessionService`

## Methods

### createP256SessionKey()

> **createP256SessionKey**(`params`): `Promise`\<[`CreateP256SessionKeyResponse`](../interfaces/CreateP256SessionKeyResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-session-service.ts:99](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-session-service.ts#L99)

Create a P-256 session key under a human key (WebAuthn-gated).

`POST /kms/create-p256-session-key`. The `webAuthnAssertion` challenge comes
from a generic [KmsManager.beginAuthentication](KmsManager.md#beginauthentication) ceremony supplied by
the caller. Returns the session key's public key plus an `agentCredential`
JWT used to authenticate subsequent [signP256UserOp](#signp256userop) calls.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`CreateP256SessionKeyRequest`](../interfaces/CreateP256SessionKeyRequest.md) |

#### Returns

`Promise`\<[`CreateP256SessionKeyResponse`](../interfaces/CreateP256SessionKeyResponse.md)\>

***

### createP256SessionKeyWithCeremony()

> **createP256SessionKeyWithCeremony**(`params`, `signer`, `options?`): `Promise`\<[`CreateP256SessionKeyResponse`](../interfaces/CreateP256SessionKeyResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-session-service.ts:155](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-session-service.ts#L155)

Create a P-256 session key, running the challenge-binding ceremony internally.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | `Omit`\<[`CreateP256SessionKeyRequest`](../interfaces/CreateP256SessionKeyRequest.md), `"webAuthnAssertion"`\> |
| `signer` | [`PasskeyCeremonySigner`](../interfaces/PasskeyCeremonySigner.md) |
| `options?` | `Omit`\<[`RunCeremonyOptions`](../interfaces/RunCeremonyOptions.md), `"signer"`\> |

#### Returns

`Promise`\<[`CreateP256SessionKeyResponse`](../interfaces/CreateP256SessionKeyResponse.md)\>

***

### revokeP256SessionKey()

> **revokeP256SessionKey**(`params`): `Promise`\<[`RevokeP256SessionKeyResponse`](../interfaces/RevokeP256SessionKeyResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-session-service.ts:137](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-session-service.ts#L137)

Revoke a P-256 session key (WebAuthn-gated, idempotent).

`POST /kms/revoke-p256-session-key`. The `webAuthnAssertion` challenge comes
from a generic [KmsManager.beginAuthentication](KmsManager.md#beginauthentication) ceremony supplied by
the caller. Idempotent: revoking an already-revoked key still resolves.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`RevokeP256SessionKeyRequest`](../interfaces/RevokeP256SessionKeyRequest.md) |

#### Returns

`Promise`\<[`RevokeP256SessionKeyResponse`](../interfaces/RevokeP256SessionKeyResponse.md)\>

***

### revokeP256SessionKeyWithCeremony()

> **revokeP256SessionKeyWithCeremony**(`params`, `humanKeyId`, `signer`, `options?`): `Promise`\<[`RevokeP256SessionKeyResponse`](../interfaces/RevokeP256SessionKeyResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-session-service.ts:175](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-session-service.ts#L175)

Revoke a P-256 session key, running the challenge-binding ceremony internally.
`humanKeyId` is the owning human key challenged by the ceremony (distinct from
the session `keyId` in `params`).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | `Omit`\<[`RevokeP256SessionKeyRequest`](../interfaces/RevokeP256SessionKeyRequest.md), `"webAuthnAssertion"`\> |
| `humanKeyId` | `string` |
| `signer` | [`PasskeyCeremonySigner`](../interfaces/PasskeyCeremonySigner.md) |
| `options?` | `Omit`\<[`RunCeremonyOptions`](../interfaces/RunCeremonyOptions.md), `"signer"`\> |

#### Returns

`Promise`\<[`RevokeP256SessionKeyResponse`](../interfaces/RevokeP256SessionKeyResponse.md)\>

***

### signP256UserOp()

> **signP256UserOp**(`params`, `jwt`): `Promise`\<[`SignP256UserOpResponse`](../interfaces/SignP256UserOpResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-session-service.ts:117](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/kms-session-service.ts#L117)

Sign an ERC-4337 UserOp hash with a P-256 session key (Bearer JWT auth).

`POST /kms/sign-p256-user-op`, authenticated with the `agentCredential` JWT
returned by [createP256SessionKey](#createp256sessionkey). Returns the 149-byte P256
session-key wire-format signature.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`SignP256UserOpRequest`](../interfaces/SignP256UserOpRequest.md) |
| `jwt` | `string` |

#### Returns

`Promise`\<[`SignP256UserOpResponse`](../interfaces/SignP256UserOpResponse.md)\>
