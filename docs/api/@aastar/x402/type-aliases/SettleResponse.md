> **SettleResponse** = `object`

Defined in: [packages/x402/src/types.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/types.ts#L79)

Settlement response — PAYMENT-RESPONSE header.
Server returns after facilitator settles.

## Properties

### errorReason?

> `optional` **errorReason**: `string`

Defined in: [packages/x402/src/types.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/types.ts#L84)

***

### extensions?

> `optional` **extensions**: `Record`\<`string`, `unknown`\>

Defined in: [packages/x402/src/types.ts:85](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/types.ts#L85)

***

### network?

> `optional` **network**: [`NetworkId`](NetworkId.md)

Defined in: [packages/x402/src/types.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/types.ts#L82)

***

### payer?

> `optional` **payer**: `Address`

Defined in: [packages/x402/src/types.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/types.ts#L83)

***

### success

> **success**: `boolean`

Defined in: [packages/x402/src/types.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/types.ts#L80)

***

### transaction?

> `optional` **transaction**: `string`

Defined in: [packages/x402/src/types.ts:81](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/types.ts#L81)
