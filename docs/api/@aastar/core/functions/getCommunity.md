```ts
function getCommunity(network, communityName): 
  | {
  ensName: "aastar.eth";
  gasToken: `0x${string}`;
  name: "AAStar";
  owner: "0x411BD567E46C0781248dbB6a9211891C032885e5";
  stake: "50";
}
  | {
  ensName: "bread.eth";
  gasToken: `0x${string}`;
  name: "BreadCommunity";
  owner: "0xe24b6f321B0140716a2b671ed0D983bb64E7DaFA";
  stake: "50";
};
```

Defined in: [packages/core/src/contracts.ts:412](https://github.com/AAStarCommunity/aastar-sdk/blob/ee044880cf09fc864d856f7ed93e9172865157d1/packages/core/src/contracts.ts#L412)

Get a specific community

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"sepolia"` | Network name |
| `communityName` | `"aastar"` \| `"breadCommunity"` | Community name (aastar, builderDao) |

## Returns

  \| \{
  `ensName`: `"aastar.eth"`;
  `gasToken`: `` `0x${string}` ``;
  `name`: `"AAStar"`;
  `owner`: `"0x411BD567E46C0781248dbB6a9211891C032885e5"`;
  `stake`: `"50"`;
\}
  \| \{
  `ensName`: `"bread.eth"`;
  `gasToken`: `` `0x${string}` ``;
  `name`: `"BreadCommunity"`;
  `owner`: `"0xe24b6f321B0140716a2b671ed0D983bb64E7DaFA"`;
  `stake`: `"50"`;
\}

Community information

## Example

```ts
const aastar = getCommunity('sepolia', 'aastar');
console.log(aastar.gasToken); // aPNTs address
```
