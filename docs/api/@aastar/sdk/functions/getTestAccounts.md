> **getTestAccounts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:248](https://github.com/AAStarCommunity/aastar-sdk/blob/14b4a74960c3bd633bec32aa8a6aea41202defe6/packages/core/src/contracts.ts#L248)

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
