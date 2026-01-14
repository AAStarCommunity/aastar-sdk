> **validateAmount**(`amount`, `fieldName`, `min`, `max?`): `bigint`

Defined in: [packages/core/src/utils/validation.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/89f481b5e82d27cdc5d83f918ddad6748e0e7c3e/packages/core/src/utils/validation.ts#L31)

Validates a BigInt amount.

## Parameters

### amount

`bigint`

The value to check

### fieldName

`string` = `'Amount'`

Name for error messages

### min

`bigint` = `0n`

Minimum value (default 0n)

### max?

`bigint`

Maximum value (optional)

## Returns

`bigint`
