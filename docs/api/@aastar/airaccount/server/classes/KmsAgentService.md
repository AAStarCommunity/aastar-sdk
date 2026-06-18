Defined in: [packages/airaccount/src/server/services/kms-agent-service.ts:111](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-agent-service.ts#L111)

Agent-key lifecycle service for the AAStar TEE KMS (v0.20.0).

An "agent key" is a TEE-JWT credential minted under a human key, used for
gasless ERC-4337 sponsorship without re-prompting the human for each signature.
Lifecycle:
  1. [createAgentKey](#createagentkey)        — human mints the agent key (WebAuthn-gated)
  2. [signAgent](#signagent)             — agent signs userOpHashes (Bearer JWT auth)
  3. [refreshAgentCredential](#refreshagentcredential)— re-mint before expiry (Bearer JWT + WebAuthn)
  4. [revokeAgentCredential](#revokeagentcredential) — human revokes the agent key (WebAuthn-gated)

Wraps a shared [KmsHttpClient](KmsHttpClient.md) — obtain it via [KmsManager.httpClient](KmsManager.md#httpclient)
so this service reuses the same connection config and auth headers.

## Constructors

### Constructor

> **new KmsAgentService**(`http`): `KmsAgentService`

Defined in: [packages/airaccount/src/server/services/kms-agent-service.ts:112](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-agent-service.ts#L112)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `http` | [`KmsHttpClient`](KmsHttpClient.md) |

#### Returns

`KmsAgentService`

## Methods

### createAgentKey()

> **createAgentKey**(`params`): `Promise`\<[`KmsCreateAgentKeyResponse`](../interfaces/KmsCreateAgentKeyResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-agent-service.ts:121](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-agent-service.ts#L121)

Mint a new agent key under an existing human key (WebAuthn-gated).

The WebAuthn challenge is obtained from a generic
[KmsManager.beginAuthentication](KmsManager.md#beginauthentication) ceremony (purpose="authentication");
the caller supplies the resulting assertion in the request.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`KmsCreateAgentKeyRequest`](../interfaces/KmsCreateAgentKeyRequest.md) |

#### Returns

`Promise`\<[`KmsCreateAgentKeyResponse`](../interfaces/KmsCreateAgentKeyResponse.md)\>

***

### createAgentKeyWithCeremony()

> **createAgentKeyWithCeremony**(`params`, `signer`, `options?`): `Promise`\<[`KmsCreateAgentKeyResponse`](../interfaces/KmsCreateAgentKeyResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-agent-service.ts:187](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-agent-service.ts#L187)

Mint an agent key, running the challenge-binding ceremony internally.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | `Omit`\<[`KmsCreateAgentKeyRequest`](../interfaces/KmsCreateAgentKeyRequest.md), `"webAuthnAssertion"` \| `"passkeyAssertion"`\> |
| `signer` | [`PasskeyCeremonySigner`](../interfaces/PasskeyCeremonySigner.md) |
| `options?` | `Omit`\<[`RunCeremonyOptions`](../interfaces/RunCeremonyOptions.md), `"signer"`\> |

#### Returns

`Promise`\<[`KmsCreateAgentKeyResponse`](../interfaces/KmsCreateAgentKeyResponse.md)\>

***

### refreshAgentCredential()

> **refreshAgentCredential**(`params`, `jwt`): `Promise`\<[`KmsRefreshAgentCredentialResponse`](../interfaces/KmsRefreshAgentCredentialResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-agent-service.ts:148](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-agent-service.ts#L148)

Refresh (re-mint) an agent credential before it expires. Authenticated with
the existing credential (`jwt`, Bearer) plus a human WebAuthn / passkey
assertion in the request.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`KmsRefreshAgentCredentialRequest`](../interfaces/KmsRefreshAgentCredentialRequest.md) |
| `jwt` | `string` |

#### Returns

`Promise`\<[`KmsRefreshAgentCredentialResponse`](../interfaces/KmsRefreshAgentCredentialResponse.md)\>

***

### refreshAgentCredentialWithCeremony()

> **refreshAgentCredentialWithCeremony**(`params`, `humanKeyId`, `jwt`, `signer`, `options?`): `Promise`\<[`KmsRefreshAgentCredentialResponse`](../interfaces/KmsRefreshAgentCredentialResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-agent-service.ts:207](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-agent-service.ts#L207)

Refresh an agent credential, running the challenge-binding ceremony
internally. `humanKeyId` is the owning human key challenged by the ceremony
(distinct from the agent `keyId` in `params`); `jwt` is the existing credential.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | `Omit`\<[`KmsRefreshAgentCredentialRequest`](../interfaces/KmsRefreshAgentCredentialRequest.md), `"webAuthnAssertion"` \| `"passkeyAssertion"`\> |
| `humanKeyId` | `string` |
| `jwt` | `string` |
| `signer` | [`PasskeyCeremonySigner`](../interfaces/PasskeyCeremonySigner.md) |
| `options?` | `Omit`\<[`RunCeremonyOptions`](../interfaces/RunCeremonyOptions.md), `"signer"`\> |

#### Returns

`Promise`\<[`KmsRefreshAgentCredentialResponse`](../interfaces/KmsRefreshAgentCredentialResponse.md)\>

***

### revokeAgentCredential()

> **revokeAgentCredential**(`params`): `Promise`\<[`KmsRevokeAgentCredentialResponse`](../interfaces/KmsRevokeAgentCredentialResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-agent-service.ts:168](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-agent-service.ts#L168)

Revoke an agent's credential (WebAuthn-gated).

The WebAuthn challenge is obtained from a generic
[KmsManager.beginAuthentication](KmsManager.md#beginauthentication) ceremony (purpose="authentication");
the caller supplies the resulting assertion in the request.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`KmsRevokeAgentCredentialRequest`](../interfaces/KmsRevokeAgentCredentialRequest.md) |

#### Returns

`Promise`\<[`KmsRevokeAgentCredentialResponse`](../interfaces/KmsRevokeAgentCredentialResponse.md)\>

***

### revokeAgentCredentialWithCeremony()

> **revokeAgentCredentialWithCeremony**(`params`, `humanKeyId`, `signer`, `options?`): `Promise`\<[`KmsRevokeAgentCredentialResponse`](../interfaces/KmsRevokeAgentCredentialResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-agent-service.ts:224](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-agent-service.ts#L224)

Revoke an agent credential, running the challenge-binding ceremony internally.
`humanKeyId` is the owning human key challenged by the ceremony (distinct from
the agent `keyId` in `params`).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | `Omit`\<[`KmsRevokeAgentCredentialRequest`](../interfaces/KmsRevokeAgentCredentialRequest.md), `"webAuthnAssertion"` \| `"passkeyAssertion"`\> |
| `humanKeyId` | `string` |
| `signer` | [`PasskeyCeremonySigner`](../interfaces/PasskeyCeremonySigner.md) |
| `options?` | `Omit`\<[`RunCeremonyOptions`](../interfaces/RunCeremonyOptions.md), `"signer"`\> |

#### Returns

`Promise`\<[`KmsRevokeAgentCredentialResponse`](../interfaces/KmsRevokeAgentCredentialResponse.md)\>

***

### signAgent()

> **signAgent**(`params`, `jwt`): `Promise`\<[`KmsSignAgentResponse`](../interfaces/KmsSignAgentResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-agent-service.ts:134](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-agent-service.ts#L134)

Sign a userOpHash with an agent key, authenticated by the agent's TEE-JWT
credential (`jwt`, the `agentCredential` from [createAgentKey](#createagentkey)).
Returns the 106-byte packed signature for ERC-4337 sponsorship.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`KmsSignAgentRequest`](../interfaces/KmsSignAgentRequest.md) |
| `jwt` | `string` |

#### Returns

`Promise`\<[`KmsSignAgentResponse`](../interfaces/KmsSignAgentResponse.md)\>
