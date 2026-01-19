> **tuneGasLimit**(`estimate`, `nominalActual`, `targetEfficiency`): `bigint`

Defined in: [V4/PaymasterUtils.ts:193](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/paymaster/src/V4/PaymasterUtils.ts#L193)

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
