> **extractPaymentRequired**(`response`): [`PaymentRequired`](../type-aliases/PaymentRequired.md) \| `null`

Defined in: [packages/x402/src/payment-header.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/payment-header.ts#L77)

Extract PaymentRequired from a 402 Response.
Tries v2 header first, falls back to v1.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `response` | `Response` |

## Returns

[`PaymentRequired`](../type-aliases/PaymentRequired.md) \| `null`
