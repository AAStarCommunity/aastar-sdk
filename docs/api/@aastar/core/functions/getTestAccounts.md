> **getTestAccounts**(`network`): `object`

Defined in: [packages/core/src/contracts.ts:248](https://github.com/AAStarCommunity/aastar-sdk/blob/1e464e07d70938a0d2026a0fe8dd301cb780e6eb/packages/core/src/contracts.ts#L248)

Get test account contracts (SimpleAccountFactory, etc.)

## Parameters

### network

`"sepolia"`

Network name

## Returns

`object`

Test account contract addresses

### simpleAccountFactory

> `readonly` **simpleAccountFactory**: `"0x8B516A71c134a4b5196775e63b944f88Cc637F2b"` = `'0x8B516A71c134a4b5196775e63b944f88Cc637F2b'`

## Example

```ts
const testAccounts = getTestAccounts('sepolia');
console.log(testAccounts.simpleAccountFactory);
```
