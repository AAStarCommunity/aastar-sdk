> **X402ClientConfig** = `object`

Defined in: [packages/x402/src/X402Client.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/x402/src/X402Client.ts#L21)

## Properties

### chainId

> **chainId**: `number`

Defined in: [packages/x402/src/X402Client.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/x402/src/X402Client.ts#L25)

***

### facilitator?

> `optional` **facilitator**: [`FacilitatorConfig`](FacilitatorConfig.md)

Defined in: [packages/x402/src/X402Client.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/x402/src/X402Client.ts#L27)

Facilitator endpoint (default: self-facilitated via SuperPaymaster)

***

### maxAmountPerRequest?

> `optional` **maxAmountPerRequest**: `bigint`

Defined in: [packages/x402/src/X402Client.ts:32](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/x402/src/X402Client.ts#L32)

Payment policy: max amount per request (in atomic units)

***

### publicClient

> **publicClient**: [`PublicClient`](https://viem.sh/docs/index.html)

Defined in: [packages/x402/src/X402Client.ts:22](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/x402/src/X402Client.ts#L22)

***

### superPaymasterAddress

> **superPaymasterAddress**: `Address`

Defined in: [packages/x402/src/X402Client.ts:24](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/x402/src/X402Client.ts#L24)

***

### tokenName?

> `optional` **tokenName**: `string`

Defined in: [packages/x402/src/X402Client.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/x402/src/X402Client.ts#L29)

EIP-712 domain for asset token (defaults: USDC / version "2")

***

### tokenVersion?

> `optional` **tokenVersion**: `string`

Defined in: [packages/x402/src/X402Client.ts:30](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/x402/src/X402Client.ts#L30)

***

### walletClient

> **walletClient**: [`WalletClient`](https://viem.sh/docs/index.html)

Defined in: [packages/x402/src/X402Client.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/x402/src/X402Client.ts#L23)
