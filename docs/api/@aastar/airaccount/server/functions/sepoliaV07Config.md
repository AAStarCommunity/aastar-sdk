> **sepoliaV07Config**(`version`): [`EntryPointVersionConfig`](../interfaces/EntryPointVersionConfig.md)

Defined in: [packages/airaccount/src/server/config.ts:77](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/config.ts#L77)

Build a pre-configured EntryPointVersionConfig for Sepolia using a known AirAccount deployment.
Eliminates the need to look up contract addresses manually.

## Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `version` | [`AirAccountVersion`](../type-aliases/AirAccountVersion.md) | `"M7"` |

## Returns

[`EntryPointVersionConfig`](../interfaces/EntryPointVersionConfig.md)

## Example

```ts
// Use M7 r4 audit-final (default)
const config = { entryPoints: { v07: sepoliaV07Config() }, ... };

// Recover an existing r6-deployed account (do NOT use for new accounts)
const config = { entryPoints: { v07: sepoliaV07Config("M7r6") }, ... };

// Use M5 legacy
const config = { entryPoints: { v07: sepoliaV07Config("M5") }, ... };
```
