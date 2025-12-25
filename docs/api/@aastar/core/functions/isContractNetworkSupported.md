> **isContractNetworkSupported**(`network`): `network is "sepolia"`

Defined in: [packages/core/src/contracts.ts:310](https://github.com/AAStarCommunity/aastar-sdk/blob/2bfec0a83e320e28501997c5fd5b6a5c22584cd8/packages/core/src/contracts.ts#L310)

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
