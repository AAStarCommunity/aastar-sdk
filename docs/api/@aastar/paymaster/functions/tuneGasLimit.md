> **tuneGasLimit**(`estimate`, `nominalActual`, `targetEfficiency`): `bigint`

Defined in: [V4/PaymasterUtils.ts:193](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/paymaster/src/V4/PaymasterUtils.ts#L193)

Tune gas limit using a dynamic nominal ceiling to satisfy Bundler efficiency (0.4)
Target: Actual / Limit >= targetEfficiency

## Parameters

### estimate

`bigint`

### nominalActual

`bigint`

### targetEfficiency

`number` = `0.45`

## Returns

`bigint`
