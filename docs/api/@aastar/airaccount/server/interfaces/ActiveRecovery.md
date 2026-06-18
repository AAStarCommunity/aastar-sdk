Defined in: [packages/airaccount/src/server/services/recovery-service.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/recovery-service.ts#L61)

Decoded view of the account's `activeRecovery()` struct (RecoveryProposal).

On-chain layout (`AAStarAgentStorageLayout.RecoveryProposal`):
  - newOwner            : proposed new owner (address(0) ⇒ no active recovery)
  - proposedAt          : block.timestamp when the recovery was proposed
  - approvalBitmap      : bit i set ⇒ guardian[i] approved (2-of-3 to execute)
  - cancellationBitmap  : bit i set ⇒ guardian[i] voted to cancel (2-of-3 to cancel)

The remaining fields are SDK-side conveniences derived from those values.

## Properties

### approvalBitmap

> **approvalBitmap**: `bigint`

Defined in: [packages/airaccount/src/server/services/recovery-service.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/recovery-service.ts#L67)

Bitmap of guardian approvals (bit i ⇒ guardian[i] approved).

***

### approvalCount

> **approvalCount**: `number`

Defined in: [packages/airaccount/src/server/services/recovery-service.ts:71](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/recovery-service.ts#L71)

Number of distinct guardian approvals (popcount of `approvalBitmap`).

***

### cancellationBitmap

> **cancellationBitmap**: `bigint`

Defined in: [packages/airaccount/src/server/services/recovery-service.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/recovery-service.ts#L69)

Bitmap of guardian cancel votes (bit i ⇒ guardian[i] voted to cancel).

***

### cancellationCount

> **cancellationCount**: `number`

Defined in: [packages/airaccount/src/server/services/recovery-service.ts:73](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/recovery-service.ts#L73)

Number of distinct guardian cancel votes (popcount of `cancellationBitmap`).

***

### executeAfter

> **executeAfter**: `bigint`

Defined in: [packages/airaccount/src/server/services/recovery-service.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/recovery-service.ts#L75)

Earliest timestamp at which `executeRecovery` may succeed (`proposedAt + timelock`).

***

### isActive

> **isActive**: `boolean`

Defined in: [packages/airaccount/src/server/services/recovery-service.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/recovery-service.ts#L77)

True when a recovery is currently active (`newOwner != address(0)`).

***

### newOwner

> **newOwner**: `string`

Defined in: [packages/airaccount/src/server/services/recovery-service.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/recovery-service.ts#L63)

Proposed new owner. `0x0000…0000` means there is no active recovery.

***

### proposedAt

> **proposedAt**: `bigint`

Defined in: [packages/airaccount/src/server/services/recovery-service.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/services/recovery-service.ts#L65)

`block.timestamp` at which the recovery was proposed (seconds).
