Defined in: [packages/airaccount/src/server/services/kms-payment-signer.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-payment-signer.ts#L69)

Convenience signers for SuperPaymaster payment flows (v0.20.0 P2).

Each method maps to a fixed EIP-712 domain + type that the KMS builds host-side
and signs inside the TEE; the SDK only forwards the structured parameters. Every
endpoint accepts EITHER a one-time `webAuthnAssertion` in the body OR an agent
Bearer JWT — see [KmsPaymentAuth](../type-aliases/KmsPaymentAuth.md).

Wraps a shared [KmsHttpClient](KmsHttpClient.md); reuse the same instance across the agent /
session / payment / monitor services.

## Constructors

### Constructor

> **new KmsPaymentSigner**(`http`): `KmsPaymentSigner`

Defined in: [packages/airaccount/src/server/services/kms-payment-signer.ts:70](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-payment-signer.ts#L70)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `http` | [`KmsHttpClient`](KmsHttpClient.md) |

#### Returns

`KmsPaymentSigner`

## Methods

### signGTokenAuthorization()

> **signGTokenAuthorization**(`params`, `auth`): `Promise`\<[`KmsPaymentSignatureResponse`](../interfaces/KmsPaymentSignatureResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-payment-signer.ts:106](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-payment-signer.ts#L106)

Sign an EIP-3009 TransferWithAuthorization for a GToken transfer
via `POST /kms/SignGTokenAuthorization`. `from` MUST equal the derived address.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`KmsSignGTokenAuthorizationRequest`](../interfaces/KmsSignGTokenAuthorizationRequest.md) |
| `auth` | [`KmsPaymentAuth`](../type-aliases/KmsPaymentAuth.md) |

#### Returns

`Promise`\<[`KmsPaymentSignatureResponse`](../interfaces/KmsPaymentSignatureResponse.md)\>

***

### signMicropaymentVoucher()

> **signMicropaymentVoucher**(`params`, `auth`): `Promise`\<[`KmsPaymentSignatureResponse`](../interfaces/KmsPaymentSignatureResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-payment-signer.ts:94](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-payment-signer.ts#L94)

Sign a MicroPaymentChannel voucher (cumulative-amount EIP-712 message)
via `POST /kms/SignMicropaymentVoucher`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`KmsSignMicropaymentVoucherRequest`](../interfaces/KmsSignMicropaymentVoucherRequest.md) |
| `auth` | [`KmsPaymentAuth`](../type-aliases/KmsPaymentAuth.md) |

#### Returns

`Promise`\<[`KmsPaymentSignatureResponse`](../interfaces/KmsPaymentSignatureResponse.md)\>

***

### signX402Payment()

> **signX402Payment**(`params`, `auth`): `Promise`\<[`KmsPaymentSignatureResponse`](../interfaces/KmsPaymentSignatureResponse.md)\>

Defined in: [packages/airaccount/src/server/services/kms-payment-signer.ts:117](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/kms-payment-signer.ts#L117)

Sign an x402 payment authorization via `POST /kms/SignX402Payment`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`KmsSignX402PaymentRequest`](../interfaces/KmsSignX402PaymentRequest.md) |
| `auth` | [`KmsPaymentAuth`](../type-aliases/KmsPaymentAuth.md) |

#### Returns

`Promise`\<[`KmsPaymentSignatureResponse`](../interfaces/KmsPaymentSignatureResponse.md)\>
