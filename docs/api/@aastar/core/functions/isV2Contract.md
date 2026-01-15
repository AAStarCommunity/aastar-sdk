```ts
function isV2Contract(address): boolean;
```

Defined in: [packages/core/src/contract-versions.ts:340](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contract-versions.ts#L340)

Check if an address is a V2 contract

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `address` | `string` | Contract address to check |

## Returns

`boolean`

True if address is a V2 contract

## Example

```ts
if (isV2Contract('0xB97A20aca3D6770Deca299a1aD9DAFb12d1e5eCf')) {
  console.log('This is a V2 contract with VERSION interface');
}
```
