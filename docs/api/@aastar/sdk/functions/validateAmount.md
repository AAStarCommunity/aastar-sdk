> **validateAmount**(`amount`, `fieldName`, `min`, `max?`): `bigint`

Defined in: [packages/core/src/utils/validation.ts:31](https://github.com/AAStarCommunity/aastar-sdk/blob/6b49b22ad2e2ee38472f13bd530a515b9eb58add/packages/core/src/utils/validation.ts#L31)

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
