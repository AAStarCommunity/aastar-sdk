```ts
function isContractNetworkSupported(network): network is "sepolia";
```

Defined in: [packages/core/src/contracts.ts:310](https://github.com/AAStarCommunity/aastar-sdk/blob/c62b4370b37b568ac4c9186927802ebc0956c34c/packages/core/src/contracts.ts#L310)

Check if a network is supported for contracts

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `string` | Network name to check |

## Returns

`network is "sepolia"`

True if network is supported

## Example

```ts
if (isContractNetworkSupported('sepolia')) {
  const contracts = getContracts('sepolia');
}
```
