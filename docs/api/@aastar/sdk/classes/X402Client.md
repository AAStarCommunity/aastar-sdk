Defined in: [packages/x402/src/X402Client.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/X402Client.ts#L40)

## Constructors

### Constructor

> **new X402Client**(`config`): `X402Client`

Defined in: [packages/x402/src/X402Client.ts:45](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/X402Client.ts#L45)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`X402ClientConfig`](../type-aliases/X402ClientConfig.md) |

#### Returns

`X402Client`

## Methods

### checkNonce()

> **checkNonce**(`nonce`): `Promise`\<`boolean`\>

Defined in: [packages/x402/src/X402Client.ts:154](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/X402Client.ts#L154)

Check if a nonce has been used.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `nonce` | `` `0x${string}` `` |

#### Returns

`Promise`\<`boolean`\>

***

### createPayment()

> **createPayment**(`params`): `Promise`\<\{ `encoded`: `string`; `nonce`: `` `0x${string}` ``; `payload`: [`PaymentPayload`](../type-aliases/PaymentPayload.md); \}\>

Defined in: [packages/x402/src/X402Client.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/X402Client.ts#L61)

Create a signed payment payload (EIP-3009 TransferWithAuthorization).
Returns a base64-encoded PaymentPayload ready for PAYMENT-SIGNATURE header.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`X402PaymentParams`](../type-aliases/X402PaymentParams.md) |

#### Returns

`Promise`\<\{ `encoded`: `string`; `nonce`: `` `0x${string}` ``; `payload`: [`PaymentPayload`](../type-aliases/PaymentPayload.md); \}\>

***

### getQuote()

> **getQuote**(): `Promise`\<\{ `feeBPS`: `bigint`; \}\>

Defined in: [packages/x402/src/X402Client.ts:146](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/X402Client.ts#L146)

Get facilitator fee quote from on-chain contract.

#### Returns

`Promise`\<\{ `feeBPS`: `bigint`; \}\>

***

### settleDirectOnChain()

> **settleDirectOnChain**(`params`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/x402/src/X402Client.ts:134](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/X402Client.ts#L134)

Settle payment on-chain via direct transfer (for xPNTs and pre-approved tokens).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `amount`: `bigint`; `asset`: `` `0x${string}` ``; `from`: `` `0x${string}` ``; `nonce`: `` `0x${string}` ``; `to`: `` `0x${string}` ``; \} |
| `params.amount` | `bigint` |
| `params.asset` | `` `0x${string}` `` |
| `params.from` | `` `0x${string}` `` |
| `params.nonce` | `` `0x${string}` `` |
| `params.to` | `` `0x${string}` `` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### settleOnChain()

> **settleOnChain**(`params`): `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/x402/src/X402Client.ts:121](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/X402Client.ts#L121)

Settle payment on-chain via SuperPaymaster (self-facilitated).
Uses EIP-3009 transferWithAuthorization path.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | \{ `amount`: `bigint`; `asset`: `` `0x${string}` ``; `from`: `` `0x${string}` ``; `nonce`: `` `0x${string}` ``; `signature`: `` `0x${string}` ``; `to`: `` `0x${string}` ``; `validAfter`: `bigint`; `validBefore`: `bigint`; \} |
| `params.amount` | `bigint` |
| `params.asset` | `` `0x${string}` `` |
| `params.from` | `` `0x${string}` `` |
| `params.nonce` | `` `0x${string}` `` |
| `params.signature` | `` `0x${string}` `` |
| `params.to` | `` `0x${string}` `` |
| `params.validAfter` | `bigint` |
| `params.validBefore` | `bigint` |

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### settleViaFacilitator()

> **settleViaFacilitator**(`payload`, `requirements`): `Promise`\<[`SettleResponse`](../type-aliases/SettleResponse.md)\>

Defined in: [packages/x402/src/X402Client.ts:162](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/X402Client.ts#L162)

Settle via external facilitator (Coinbase, self-hosted, etc.).
Requires facilitator config in constructor.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `payload` | [`PaymentPayload`](../type-aliases/PaymentPayload.md) |
| `requirements` | [`PaymentRequirements`](../type-aliases/PaymentRequirements.md) |

#### Returns

`Promise`\<[`SettleResponse`](../type-aliases/SettleResponse.md)\>

***

### x402Fetch()

> **x402Fetch**(`url`, `init?`): `Promise`\<`Response`\>

Defined in: [packages/x402/src/X402Client.ts:182](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/x402/src/X402Client.ts#L182)

x402-aware fetch wrapper.
Automatically handles 402 → sign → retry flow per x402 v2 spec.

Pattern from: @x402/fetch wrapFetchWithPayment

Flow:
1. Make initial request
2. If 402, extract PaymentRequired from PAYMENT-REQUIRED header
3. Select best payment option (applies policy: max amount check)
4. Sign EIP-3009 authorization
5. Retry with PAYMENT-SIGNATURE header

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `url` | `string` |
| `init?` | `RequestInit` |

#### Returns

`Promise`\<`Response`\>
