> **isContractNetworkSupported**(`network`): `network is "sepolia"`

Defined in: [packages/core/src/contracts.ts:310](https://github.com/AAStarCommunity/aastar-sdk/blob/d8cd895cb4a9df5d4a11f5b902321a50bc6200f9/packages/core/src/contracts.ts#L310)

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
