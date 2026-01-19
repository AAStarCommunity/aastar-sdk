> **getCommunity**(`network`, `communityName`): \{ `ensName`: `"aastar.eth"`; `gasToken`: `` `0x${string}` ``; `name`: `"AAStar"`; `owner`: `"0x411BD567E46C0781248dbB6a9211891C032885e5"`; `stake`: `"50"`; \} \| \{ `ensName`: `"bread.eth"`; `gasToken`: `` `0x${string}` ``; `name`: `"BreadCommunity"`; `owner`: `"0xe24b6f321B0140716a2b671ed0D983bb64E7DaFA"`; `stake`: `"50"`; \}

Defined in: [packages/core/src/contracts.ts:412](https://github.com/AAStarCommunity/aastar-sdk/blob/3d86097d63bdcdf81fb5057263ea4258ff1adf6d/packages/core/src/contracts.ts#L412)

Get a specific community

## Parameters

### network

`"sepolia"`

Network name

### communityName

Community name (aastar, builderDao)

`"aastar"` | `"breadCommunity"`

## Returns

\{ `ensName`: `"aastar.eth"`; `gasToken`: `` `0x${string}` ``; `name`: `"AAStar"`; `owner`: `"0x411BD567E46C0781248dbB6a9211891C032885e5"`; `stake`: `"50"`; \} \| \{ `ensName`: `"bread.eth"`; `gasToken`: `` `0x${string}` ``; `name`: `"BreadCommunity"`; `owner`: `"0xe24b6f321B0140716a2b671ed0D983bb64E7DaFA"`; `stake`: `"50"`; \}

Community information

## Example

```ts
const aastar = getCommunity('sepolia', 'aastar');
console.log(aastar.gasToken); // aPNTs address
```
