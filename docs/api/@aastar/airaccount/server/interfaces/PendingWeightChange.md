Defined in: [packages/airaccount/src/server/services/weighted-signature-service.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/weighted-signature-service.ts#L79)

A pending weight-change proposal awaiting guardian approval + timelock.

## Properties

### approvalBitmap

> **approvalBitmap**: `bigint`

Defined in: [packages/airaccount/src/server/services/weighted-signature-service.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/weighted-signature-service.ts#L85)

Bitmap of guardian indices that have approved (bit i set => guardian i approved).

***

### proposed

> **proposed**: [`WeightConfig`](WeightConfig.md)

Defined in: [packages/airaccount/src/server/services/weighted-signature-service.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/weighted-signature-service.ts#L81)

The proposed new WeightConfig.

***

### proposedAt

> **proposedAt**: `bigint`

Defined in: [packages/airaccount/src/server/services/weighted-signature-service.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/weighted-signature-service.ts#L83)

Unix timestamp when the proposal was created; 0 means no active proposal.
