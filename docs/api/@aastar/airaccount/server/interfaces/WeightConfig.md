Defined in: [packages/airaccount/src/server/services/weighted-signature-service.ts:55](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/weighted-signature-service.ts#L55)

WeightConfig — the weighted multi-signature policy for an AAStarAirAccount (algId 0x07).

Each signer type / guardian contributes its weight; a transaction is authorized when the
summed weight of present signatures meets the relevant tier threshold. tier1 is the base
(required, non-zero) threshold; tier2/tier3 gate higher-value operations and, when set,
must be monotonically non-decreasing (tier1 <= tier2 <= tier3).

Field order MUST match the on-chain struct exactly (see AAStarAirAccountV7.json):
passkeyWeight, ecdsaWeight, blsWeight, guardian0Weight, guardian1Weight, guardian2Weight,
_padding, tier1Threshold, tier2Threshold, tier3Threshold.

## Properties

### \_padding

> **\_padding**: `number`

Defined in: [packages/airaccount/src/server/services/weighted-signature-service.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/weighted-signature-service.ts#L69)

Reserved padding byte (storage packing); keep 0.

***

### blsWeight

> **blsWeight**: `number`

Defined in: [packages/airaccount/src/server/services/weighted-signature-service.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/weighted-signature-service.ts#L61)

Weight granted by a valid BLS signature.

***

### ecdsaWeight

> **ecdsaWeight**: `number`

Defined in: [packages/airaccount/src/server/services/weighted-signature-service.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/weighted-signature-service.ts#L59)

Weight granted by a valid ECDSA (secp256k1 owner) signature.

***

### guardian0Weight

> **guardian0Weight**: `number`

Defined in: [packages/airaccount/src/server/services/weighted-signature-service.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/weighted-signature-service.ts#L63)

Weight granted by guardian slot 0.

***

### guardian1Weight

> **guardian1Weight**: `number`

Defined in: [packages/airaccount/src/server/services/weighted-signature-service.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/weighted-signature-service.ts#L65)

Weight granted by guardian slot 1.

***

### guardian2Weight

> **guardian2Weight**: `number`

Defined in: [packages/airaccount/src/server/services/weighted-signature-service.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/weighted-signature-service.ts#L67)

Weight granted by guardian slot 2.

***

### passkeyWeight

> **passkeyWeight**: `number`

Defined in: [packages/airaccount/src/server/services/weighted-signature-service.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/weighted-signature-service.ts#L57)

Weight granted by a valid passkey (P256/WebAuthn) signature.

***

### tier1Threshold

> **tier1Threshold**: `number`

Defined in: [packages/airaccount/src/server/services/weighted-signature-service.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/weighted-signature-service.ts#L71)

Base threshold; must be non-zero and strictly greater than every individual weight.

***

### tier2Threshold

> **tier2Threshold**: `number`

Defined in: [packages/airaccount/src/server/services/weighted-signature-service.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/weighted-signature-service.ts#L73)

Tier-2 threshold (0 = disabled); when set must be >= tier1Threshold.

***

### tier3Threshold

> **tier3Threshold**: `number`

Defined in: [packages/airaccount/src/server/services/weighted-signature-service.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/weighted-signature-service.ts#L75)

Tier-3 threshold (0 = disabled); when set requires tier2 set and must be >= tier2Threshold.
