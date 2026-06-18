> **PaymentPayload** = `object`

Defined in: [packages/x402/src/types.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/types.ts#L64)

Client payment payload — PAYMENT-SIGNATURE header.
Client sends this on retry request.

## Properties

### accepted

> **accepted**: [`PaymentRequirements`](PaymentRequirements.md)

Defined in: [packages/x402/src/types.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/types.ts#L67)

***

### extensions?

> `optional` **extensions**: `Record`\<`string`, `unknown`\>

Defined in: [packages/x402/src/types.ts:72](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/types.ts#L72)

***

### payload

> **payload**: `object`

Defined in: [packages/x402/src/types.ts:68](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/types.ts#L68)

#### authorization

> **authorization**: [`EIP3009Authorization`](EIP3009Authorization.md)

#### signature

> **signature**: [`Hex`](https://viem.sh/docs/index.html)

***

### resource?

> `optional` **resource**: [`ResourceInfo`](ResourceInfo.md)

Defined in: [packages/x402/src/types.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/types.ts#L66)

***

### x402Version

> **x402Version**: `2`

Defined in: [packages/x402/src/types.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/types.ts#L65)
