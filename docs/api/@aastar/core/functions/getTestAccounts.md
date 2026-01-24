> **getTestAccounts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:248](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/contracts.ts#L248)

Get test account contracts (SimpleAccountFactory, etc.)

## Parameters

### network

`"sepolia"`

Network name

## Returns

`object`

Test account contract addresses

### simpleAccountFactory

> `readonly` **simpleAccountFactory**: `` `0x${string}` ``

## Example

```ts
const testAccounts = getTestAccounts('sepolia');
console.log(testAccounts.simpleAccountFactory);
```
