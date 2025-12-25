> **isContractNetworkSupported**(`network`): `network is "sepolia"`

Defined in: [packages/core/src/contracts.ts:310](https://github.com/AAStarCommunity/aastar-sdk/blob/4d5be576edce490d7405a108d648a390d96f3eb5/packages/core/src/contracts.ts#L310)

Check if a network is supported for contracts

## Parameters

### network

`string`

Network name to check

## Returns

`network is "sepolia"`

True if network is supported

## Example

```ts
if (isContractNetworkSupported('sepolia')) {
  const contracts = getContracts('sepolia');
}
```
