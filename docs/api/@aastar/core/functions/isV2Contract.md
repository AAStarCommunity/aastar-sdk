> **isV2Contract**(`address`): `boolean`

Defined in: [packages/core/src/contract-versions.ts:340](https://github.com/AAStarCommunity/aastar-sdk/blob/821d2a29b60e7240ef51d199eec866aa227da0bf/packages/core/src/contract-versions.ts#L340)

Check if an address is a V2 contract

## Parameters

### address

`string`

Contract address to check

## Returns

`boolean`

True if address is a V2 contract

## Example

```ts
if (isV2Contract('0xB97A20aca3D6770Deca299a1aD9DAFb12d1e5eCf')) {
  console.log('This is a V2 contract with VERSION interface');
}
```
