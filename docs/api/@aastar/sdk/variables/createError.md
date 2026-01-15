> `const` **createError**: `object`

Defined in: [packages/sdk/src/errors/AAStarError.ts:28](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/sdk/src/errors/AAStarError.ts#L28)

Error factory functions for consistent error creation

## Type Declaration

### contract()

> **contract**: (`contract`, `reason`) => [`AAStarError`](../classes/AAStarError.md)

#### Parameters

##### contract

`string`

##### reason

`string`

#### Returns

[`AAStarError`](../classes/AAStarError.md)

### insufficientFunds()

> **insufficientFunds**: (`required`, `available`) => [`AAStarError`](../classes/AAStarError.md)

#### Parameters

##### required

`string`

##### available

`string`

#### Returns

[`AAStarError`](../classes/AAStarError.md)

### network()

> **network**: (`operation`, `reason`) => [`AAStarError`](../classes/AAStarError.md)

#### Parameters

##### operation

`string`

##### reason

`string`

#### Returns

[`AAStarError`](../classes/AAStarError.md)

### operationFailed()

> **operationFailed**: (`operation`, `reason`) => [`AAStarError`](../classes/AAStarError.md)

#### Parameters

##### operation

`string`

##### reason

`string`

#### Returns

[`AAStarError`](../classes/AAStarError.md)

### permissionDenied()

> **permissionDenied**: (`operation`, `reason`) => [`AAStarError`](../classes/AAStarError.md)

#### Parameters

##### operation

`string`

##### reason

`string`

#### Returns

[`AAStarError`](../classes/AAStarError.md)

### validation()

> **validation**: (`field`, `reason`) => [`AAStarError`](../classes/AAStarError.md)

#### Parameters

##### field

`string`

##### reason

`string`

#### Returns

[`AAStarError`](../classes/AAStarError.md)
