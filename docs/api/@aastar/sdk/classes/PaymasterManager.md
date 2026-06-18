Defined in: [packages/paymaster/src/PaymasterManager.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/paymaster/src/PaymasterManager.ts#L62)

PaymasterManager — unifies the per-type `paymasterAndData` packers behind a
single `buildPaymasterData` entry point that AUTO-SELECTS the correct byte
format by paymaster type.

Type resolution order:
  1. Explicit `params.type` (preferred — no guessing).
  2. Address-based lookup against the registered known-paymaster map.

The underlying packers (`buildPaymasterData` / `buildSuperPaymasterData` in
PaymasterUtils) remain exported and are reused verbatim here — this class
does NOT reimplement byte-packing.

## Constructors

### Constructor

> **new PaymasterManager**(`opts?`): `PaymasterManager`

Defined in: [packages/paymaster/src/PaymasterManager.ts:65](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/paymaster/src/PaymasterManager.ts#L65)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `opts?` | \{ `knownPaymasters?`: `Record`\<`string`, [`PaymasterType`](../type-aliases/PaymasterType.md)\>; \} |
| `opts.knownPaymasters?` | `Record`\<`string`, [`PaymasterType`](../type-aliases/PaymasterType.md)\> |

#### Returns

`PaymasterManager`

## Methods

### buildPaymasterData()

> **buildPaymasterData**(`params`): `` `0x${string}` ``

Defined in: [packages/paymaster/src/PaymasterManager.ts:113](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/paymaster/src/PaymasterManager.ts#L113)

Build `paymasterAndData`, auto-selecting the correct byte layout for the
paymaster type. Dispatches to the existing per-type packers.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `params` | [`BuildPaymasterDataParams`](../interfaces/BuildPaymasterDataParams.md) |

#### Returns

`` `0x${string}` ``

***

### registerPaymaster()

> **registerPaymaster**(`address`, `type`): `void`

Defined in: [packages/paymaster/src/PaymasterManager.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/paymaster/src/PaymasterManager.ts#L78)

Register a known paymaster address → type mapping so that callers can
omit the explicit `type` and have it resolved from the address.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `address` | `` `0x${string}` `` |
| `type` | [`PaymasterType`](../type-aliases/PaymasterType.md) |

#### Returns

`void`

***

### resolveType()

> **resolveType**(`address`): [`PaymasterType`](../type-aliases/PaymasterType.md) \| `undefined`

Defined in: [packages/paymaster/src/PaymasterManager.ts:105](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/paymaster/src/PaymasterManager.ts#L105)

Resolve a paymaster's type from a registered address. Returns undefined
if the address is not registered.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `address` | `` `0x${string}` `` |

#### Returns

[`PaymasterType`](../type-aliases/PaymasterType.md) \| `undefined`

***

### buildPaymasterData()

> `static` **buildPaymasterData**(`type`, `params`): `` `0x${string}` ``

Defined in: [packages/paymaster/src/PaymasterManager.ts:128](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/paymaster/src/PaymasterManager.ts#L128)

Static helper: build `paymasterAndData` for an explicit type without an
instance. Useful when the caller already knows the type.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `type` | [`PaymasterType`](../type-aliases/PaymasterType.md) |
| `params` | `Omit`\<[`BuildPaymasterDataParams`](../interfaces/BuildPaymasterDataParams.md), `"type"`\> |

#### Returns

`` `0x${string}` ``
