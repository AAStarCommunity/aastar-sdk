> **X402Actions** = `object`

Defined in: [packages/core/src/actions/x402.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/x402.ts#L46)

## Properties

### facilitatorEarnings()

> **facilitatorEarnings**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/x402.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/x402.ts#L61)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `asset`: `Address`; `operator`: `Address`; \} |
| `args.asset` | `Address` |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### facilitatorFeeBPS()

> **facilitatorFeeBPS**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/x402.ts:60](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/x402.ts#L60)

#### Returns

`Promise`\<`bigint`\>

***

### operatorFacilitatorFees()

> **operatorFacilitatorFees**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/x402.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/x402.ts#L62)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `operator`: `Address`; \} |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`bigint`\>

***

### setFacilitatorFeeBPS()

> **setFacilitatorFeeBPS**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/x402.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/x402.ts#L66)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `fee`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.fee` | `bigint` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setOperatorFacilitatorFee()

> **setOperatorFacilitatorFee**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/x402.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/x402.ts#L67)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `fee`: `bigint`; `operator`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.fee` | `bigint` |
| `args.operator` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### settleX402Payment()

> **settleX402Payment**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/x402.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/x402.ts#L48)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `asset`: `Address`; `from`: `Address`; `nonce`: [`Hex`](https://viem.sh/docs/index.html); `signature`: [`Hex`](https://viem.sh/docs/index.html); `to`: `Address`; `validAfter`: `bigint`; `validBefore`: `bigint`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.asset` | `Address` |
| `args.from` | `Address` |
| `args.nonce` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.signature` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.to` | `Address` |
| `args.validAfter` | `bigint` |
| `args.validBefore` | `bigint` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### settleX402PaymentDirect()

> **settleX402PaymentDirect**: (`args`) => `Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/x402.ts:53](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/x402.ts#L53)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `amount`: `bigint`; `asset`: `Address`; `from`: `Address`; `nonce`: [`Hex`](https://viem.sh/docs/index.html); `to`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.amount` | `bigint` |
| `args.asset` | `Address` |
| `args.from` | `Address` |
| `args.nonce` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.to` | `Address` |

#### Returns

`Promise`\<[`Hex`](https://viem.sh/docs/index.html)\>

***

### withdrawFacilitatorEarnings()

> **withdrawFacilitatorEarnings**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/x402.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/x402.ts#L65)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `asset`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.asset` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### x402SettlementNonces()

> **x402SettlementNonces**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/x402.ts:59](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/actions/x402.ts#L59)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `nonce`: [`Hex`](https://viem.sh/docs/index.html); \} |
| `args.nonce` | [`Hex`](https://viem.sh/docs/index.html) |

#### Returns

`Promise`\<`boolean`\>
