> `const` **INITIAL\_ROLE\_STAKES**: `object`

Defined in: [packages/core/src/roles.ts:172](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/roles.ts#L172)

Exact stake requirements from Registry.sol constructor (lines 92-100)

## Index Signature

\[`key`: `string`\]: \{ `additionalRequirement?`: `undefined`; `exitFeePercent`: `"10%"`; `line`: `92`; `lockDuration`: `"30 days"`; `minExitFee`: `"1 GT"`; `minStake`: `"30 GT"`; `ticketPrice`: `"3 GT"`; \} \| \{ `additionalRequirement`: `"aPNTs collateral in SuperPaymaster"`; `exitFeePercent`: `"10%"`; `line`: `93`; `lockDuration`: `"30 days"`; `minExitFee`: `"2 GT"`; `minStake`: `"50 GT"`; `ticketPrice`: `"5 GT"`; \} \| \{ `additionalRequirement?`: `undefined`; `exitFeePercent`: `"10%"`; `line`: `94`; `lockDuration`: `"30 days"`; `minExitFee`: `"1 GT"`; `minStake`: `"30 GT"`; `ticketPrice`: `"3 GT"`; \} \| \{ `additionalRequirement?`: `undefined`; `exitFeePercent`: `"10%"`; `line`: `95`; `lockDuration`: `"30 days"`; `minExitFee`: `"1 GT"`; `minStake`: `"20 GT"`; `ticketPrice`: `"2 GT"`; \} \| \{ `additionalRequirement?`: `undefined`; `exitFeePercent`: `"10%"`; `line`: `98`; `lockDuration`: `"30 days"`; `minExitFee`: `"5 GT"`; `minStake`: `"100 GT"`; `ticketPrice`: `"10 GT"`; \} \| \{ `additionalRequirement?`: `undefined`; `exitFeePercent`: `"5%"`; `line`: `99`; `lockDuration`: `"30 days"`; `minExitFee`: `"1 GT"`; `minStake`: `"30 GT"`; `ticketPrice`: `"3 GT"`; \} \| \{ `additionalRequirement`: `"Must hold MySBT from community"`; `exitFeePercent`: `"10%"`; `line`: `100`; `lockDuration`: `"7 days"`; `minExitFee`: `"0.05 GT"`; `minStake`: `"0.3 GT"`; `ticketPrice`: `"0.05 GT"`; \}

## Warning

These are initial values, always query contract for current configuration
