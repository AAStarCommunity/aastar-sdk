> `const` **INITIAL\_ROLE\_STAKES**: `object`

Defined in: [packages/core/src/roles.ts:172](https://github.com/AAStarCommunity/aastar-sdk/blob/aa02be8b7cbec344159ad823f08cb0202e9ec8b8/packages/core/src/roles.ts#L172)

Exact stake requirements from Registry.sol constructor (lines 92-100)

## Index Signature

\[`key`: `string`\]: \{ `additionalRequirement?`: `undefined`; `entryBurn`: `"3 GT"`; `exitFeePercent`: `"10%"`; `line`: `92`; `lockDuration`: `"30 days"`; `minExitFee`: `"1 GT"`; `minStake`: `"30 GT"`; \} \| \{ `additionalRequirement`: `"aPNTs collateral in SuperPaymaster"`; `entryBurn`: `"5 GT"`; `exitFeePercent`: `"10%"`; `line`: `93`; `lockDuration`: `"30 days"`; `minExitFee`: `"2 GT"`; `minStake`: `"50 GT"`; \} \| \{ `additionalRequirement?`: `undefined`; `entryBurn`: `"3 GT"`; `exitFeePercent`: `"10%"`; `line`: `94`; `lockDuration`: `"30 days"`; `minExitFee`: `"1 GT"`; `minStake`: `"30 GT"`; \} \| \{ `additionalRequirement?`: `undefined`; `entryBurn`: `"2 GT"`; `exitFeePercent`: `"10%"`; `line`: `95`; `lockDuration`: `"30 days"`; `minExitFee`: `"1 GT"`; `minStake`: `"20 GT"`; \} \| \{ `additionalRequirement?`: `undefined`; `entryBurn`: `"10 GT"`; `exitFeePercent`: `"10%"`; `line`: `98`; `lockDuration`: `"30 days"`; `minExitFee`: `"5 GT"`; `minStake`: `"100 GT"`; \} \| \{ `additionalRequirement?`: `undefined`; `entryBurn`: `"3 GT"`; `exitFeePercent`: `"5%"`; `line`: `99`; `lockDuration`: `"30 days"`; `minExitFee`: `"1 GT"`; `minStake`: `"30 GT"`; \} \| \{ `additionalRequirement`: `"Must hold MySBT from community"`; `entryBurn`: `"0.05 GT"`; `exitFeePercent`: `"10%"`; `line`: `100`; `lockDuration`: `"7 days"`; `minExitFee`: `"0.05 GT"`; `minStake`: `"0.3 GT"`; \}

## Warning

These are initial values, always query contract for current configuration
