> **tuneGasLimit**(`estimate`, `nominalActual`, `targetEfficiency`): `bigint`

Defined in: [packages/paymaster/src/V4/PaymasterUtils.ts:193](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/paymaster/src/V4/PaymasterUtils.ts#L193)

Tune gas limit using a dynamic nominal ceiling to satisfy Bundler efficiency (0.4)
Target: Actual / Limit >= targetEfficiency

## Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `estimate` | `bigint` | `undefined` |
| `nominalActual` | `bigint` | `undefined` |
| `targetEfficiency` | `number` | `0.45` |

## Returns

`bigint`
