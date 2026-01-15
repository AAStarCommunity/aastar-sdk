```ts
const createError: object;
```

Defined in: [packages/sdk/src/errors/AAStarError.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/sdk/src/errors/AAStarError.ts#L28)

Error factory functions for consistent error creation

## Type Declaration

| Name | Type | Defined in |
| ------ | ------ | ------ |
| <a id="contract"></a> `contract()` | (`contract`, `reason`) => [`AAStarError`](../classes/AAStarError.md) | [packages/sdk/src/errors/AAStarError.ts:36](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/sdk/src/errors/AAStarError.ts#L36) |
| <a id="insufficientfunds"></a> `insufficientFunds()` | (`required`, `available`) => [`AAStarError`](../classes/AAStarError.md) | [packages/sdk/src/errors/AAStarError.ts:50](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/sdk/src/errors/AAStarError.ts#L50) |
| <a id="network"></a> `network()` | (`operation`, `reason`) => [`AAStarError`](../classes/AAStarError.md) | [packages/sdk/src/errors/AAStarError.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/sdk/src/errors/AAStarError.ts#L43) |
| <a id="operationfailed"></a> `operationFailed()` | (`operation`, `reason`) => [`AAStarError`](../classes/AAStarError.md) | [packages/sdk/src/errors/AAStarError.ts:64](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/sdk/src/errors/AAStarError.ts#L64) |
| <a id="permissiondenied"></a> `permissionDenied()` | (`operation`, `reason`) => [`AAStarError`](../classes/AAStarError.md) | [packages/sdk/src/errors/AAStarError.ts:57](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/sdk/src/errors/AAStarError.ts#L57) |
| <a id="validation"></a> `validation()` | (`field`, `reason`) => [`AAStarError`](../classes/AAStarError.md) | [packages/sdk/src/errors/AAStarError.ts:29](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/sdk/src/errors/AAStarError.ts#L29) |
