> **announceAirAccount**(`provider`, `info`): () => `void`

Defined in: [packages/dapp/src/eip6963.ts:48](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/dapp/src/eip6963.ts#L48)

Announce AirAccount as an EIP-6963 wallet so DApps can auto-discover it.

Call this once at app startup. Returns a cleanup function that removes the
event listener when the wallet is no longer available.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `provider` | [`AirAccountEIP1193Provider`](../classes/AirAccountEIP1193Provider.md) |
| `info` | `Partial`\<[`EIP6963ProviderInfo`](../interfaces/EIP6963ProviderInfo.md)\> |

## Returns

> (): `void`

### Returns

`void`

## Example

```ts
const provider = new AirAccountEIP1193Provider({ ... });
const cleanup = announceAirAccount(provider);
// later: cleanup() to stop announcing
```
