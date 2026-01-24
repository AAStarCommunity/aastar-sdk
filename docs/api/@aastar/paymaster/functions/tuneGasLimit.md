> **tuneGasLimit**(`estimate`, `nominalActual`, `targetEfficiency`): `bigint`

Defined in: [V4/PaymasterUtils.ts:193](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/paymaster/src/V4/PaymasterUtils.ts#L193)

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
