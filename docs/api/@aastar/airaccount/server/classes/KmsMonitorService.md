Defined in: [packages/airaccount/src/server/services/kms-monitor-service.ts:117](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-monitor-service.ts#L117)

Infrastructure monitoring + operator admin surface for the AAStar TEE KMS
(v0.20.0, kms.aastar.io).

Wraps a shared [KmsHttpClient](KmsHttpClient.md). Liveness probes (`health`, `version`)
intentionally bypass the `enabled` gate so they work even when the SDK's KMS
feature flag is off; every other method calls `ensureEnabled()` first.

## Constructors

### Constructor

> **new KmsMonitorService**(`http`): `KmsMonitorService`

Defined in: [packages/airaccount/src/server/services/kms-monitor-service.ts:118](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-monitor-service.ts#L118)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `http` | [`KmsHttpClient`](KmsHttpClient.md) |

#### Returns

`KmsMonitorService`

## Methods

### adminPurgeKey()

> **adminPurgeKey**(`params`, `adminToken`): `Promise`\<[`KmsPurgeKeyResponse`](../interfaces/KmsPurgeKeyResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-monitor-service.ts:198](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-monitor-service.ts#L198)

**`Internal`**

WARNING — DESTRUCTIVE, IRREVERSIBLE. Force-purges a key from both the TEE
and the SQLite store with NO passkey/WebAuthn check (`POST /admin/purge-key`,
v0.20.0). Operator-only: authorised solely by the `KMS_ADMIN_TOKEN` operator
secret sent as `Authorization: Bearer <adminToken>`. There is no recovery
once a key is purged.

 Operator/break-glass tooling only — not part of the general SDK surface.
  The endpoint is gated server-side and intentionally omitted from the public KMS
  docs; do not expose it in application-facing flows.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `key_id`: `string`; `reason`: `string`; \} |
| `params.key_id` | `string` |
| `params.reason` | `string` |
| `adminToken` | `string` |

#### Returns

`Promise`\<[`KmsPurgeKeyResponse`](../interfaces/KmsPurgeKeyResponse.md)\>

***

### getAttestation()

> **getAttestation**(`nonce`): `Promise`\<[`KmsAttestationResponse`](../interfaces/KmsAttestationResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-monitor-service.ts:167](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-monitor-service.ts#L167)

TEE remote-attestation evidence bound to a caller nonce (`GET /attestation`,
#37). Public (no auth) — pass a fresh random `nonce` (hex, ≤64 bytes) to bind
the evidence + defeat replay, then verify the returned signed measurement.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `nonce` | `string` |

#### Returns

`Promise`\<[`KmsAttestationResponse`](../interfaces/KmsAttestationResponse.md)\>

***

### getAttestationMeasurements()

> **getAttestationMeasurements**(): `Promise`\<[`KmsAttestationManifestResponse`](../interfaces/KmsAttestationManifestResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-monitor-service.ts:175](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-monitor-service.ts#L175)

Ed25519-signed measurement manifest, version → ta_measurement
(`GET /.well-known/attestation-measurements.json`, #12). Public.

#### Returns

`Promise`\<[`KmsAttestationManifestResponse`](../interfaces/KmsAttestationManifestResponse.md)\>

***

### getAttestationMeasurementsProof()

> **getAttestationMeasurementsProof**(): `Promise`\<[`KmsAttestationProofResponse`](../interfaces/KmsAttestationProofResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-monitor-service.ts:183](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-monitor-service.ts#L183)

Sigsum transparency proof sidecar for the measurement manifest
(`GET /.well-known/attestation-measurements-proof.json`, #87). Public.

#### Returns

`Promise`\<[`KmsAttestationProofResponse`](../interfaces/KmsAttestationProofResponse.md)\>

***

### health()

> **health**(): `Promise`\<[`KmsHealthResponse`](../interfaces/KmsHealthResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-monitor-service.ts:124](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-monitor-service.ts#L124)

Liveness probe (`GET /health`, no auth). Does NOT require the KMS feature
flag to be enabled.

#### Returns

`Promise`\<[`KmsHealthResponse`](../interfaces/KmsHealthResponse.md)\>

***

### queueStatus()

> **queueStatus**(): `Promise`\<[`KmsQueueStatusResponse`](../interfaces/KmsQueueStatusResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-monitor-service.ts:139](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-monitor-service.ts#L139)

Request-queue health and circuit-breaker state (`GET /QueueStatus`).

#### Returns

`Promise`\<[`KmsQueueStatusResponse`](../interfaces/KmsQueueStatusResponse.md)\>

***

### rollbackCounter()

> **rollbackCounter**(): `Promise`\<[`KmsRollbackCounterResponse`](../interfaces/KmsRollbackCounterResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-monitor-service.ts:148](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-monitor-service.ts#L148)

RPMB anti-rollback monotonic counter (`GET /RollbackCounter`, diagnostic,
v0.20.0).

#### Returns

`Promise`\<[`KmsRollbackCounterResponse`](../interfaces/KmsRollbackCounterResponse.md)\>

***

### stats()

> **stats**(): `Promise`\<[`KmsStatsResponse`](../interfaces/KmsStatsResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-monitor-service.ts:157](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-monitor-service.ts#L157)

Machine-readable runtime statistics (`GET /stats`, v0.20.0) — wallets, tx,
queue, warnings.

#### Returns

`Promise`\<[`KmsStatsResponse`](../interfaces/KmsStatsResponse.md)\>

***

### version()

> **version**(): `Promise`\<[`KmsVersionResponse`](../interfaces/KmsVersionResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-monitor-service.ts:132](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-monitor-service.ts#L132)

Version / capability descriptor (`GET /version`, no auth). Does NOT require
the KMS feature flag to be enabled.

#### Returns

`Promise`\<[`KmsVersionResponse`](../interfaces/KmsVersionResponse.md)\>
