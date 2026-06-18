Defined in: [packages/x402/src/facilitator.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/x402/src/facilitator.ts#L16)

HTTP Facilitator Client — standard x402 v2 facilitator API.
Compatible with Coinbase hosted facilitator and self-hosted instances.

Ref: coinbase/x402 HTTPFacilitatorClient pattern

## Constructors

### Constructor

> **new FacilitatorClient**(`config`): `FacilitatorClient`

Defined in: [packages/x402/src/facilitator.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/x402/src/facilitator.ts#L20)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`FacilitatorConfig`](../type-aliases/FacilitatorConfig.md) |

#### Returns

`FacilitatorClient`

## Methods

### settle()

> **settle**(`paymentPayload`, `paymentRequirements`): `Promise`\<[`SettleResponse`](../type-aliases/SettleResponse.md)\>

Defined in: [packages/x402/src/facilitator.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/x402/src/facilitator.ts#L57)

POST /settle — execute on-chain settlement (~2s on Base).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `paymentPayload` | [`PaymentPayload`](../type-aliases/PaymentPayload.md) |
| `paymentRequirements` | [`PaymentRequirements`](../type-aliases/PaymentRequirements.md) |

#### Returns

`Promise`\<[`SettleResponse`](../type-aliases/SettleResponse.md)\>

***

### supported()

> **supported**(): `Promise`\<[`FacilitatorSupported`](../type-aliases/FacilitatorSupported.md)\>

Defined in: [packages/x402/src/facilitator.ts:79](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/x402/src/facilitator.ts#L79)

GET /supported — query facilitator capabilities.

#### Returns

`Promise`\<[`FacilitatorSupported`](../type-aliases/FacilitatorSupported.md)\>

***

### verify()

> **verify**(`paymentPayload`, `paymentRequirements`): `Promise`\<[`VerifyResponse`](../type-aliases/VerifyResponse.md)\>

Defined in: [packages/x402/src/facilitator.ts:35](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/x402/src/facilitator.ts#L35)

POST /verify — validate payment signature off-chain (~100ms).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `paymentPayload` | [`PaymentPayload`](../type-aliases/PaymentPayload.md) |
| `paymentRequirements` | [`PaymentRequirements`](../type-aliases/PaymentRequirements.md) |

#### Returns

`Promise`\<[`VerifyResponse`](../type-aliases/VerifyResponse.md)\>
