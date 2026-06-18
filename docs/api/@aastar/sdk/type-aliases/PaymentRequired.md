> **PaymentRequired** = `object`

Defined in: [packages/x402/src/types.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/x402/src/types.ts#L40)

402 response body / PAYMENT-REQUIRED header.
Server sends this to indicate payment is needed.

## Properties

### accepts

> **accepts**: [`PaymentRequirements`](PaymentRequirements.md)[]

Defined in: [packages/x402/src/types.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/x402/src/types.ts#L44)

***

### error?

> `optional` **error**: `string`

Defined in: [packages/x402/src/types.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/x402/src/types.ts#L42)

***

### extensions?

> `optional` **extensions**: `Record`\<`string`, `unknown`\>

Defined in: [packages/x402/src/types.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/x402/src/types.ts#L45)

***

### resource

> **resource**: [`ResourceInfo`](ResourceInfo.md)

Defined in: [packages/x402/src/types.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/x402/src/types.ts#L43)

***

### x402Version

> **x402Version**: `2`

Defined in: [packages/x402/src/types.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/x402/src/types.ts#L41)
