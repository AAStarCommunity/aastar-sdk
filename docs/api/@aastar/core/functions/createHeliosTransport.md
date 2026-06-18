> **createHeliosTransport**(`config`): `Promise`\<[`CustomTransport`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/transports/helios.ts:62](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/transports/helios.ts#L62)

Create a viem custom transport backed by the Helios light client.

Helios is lazy-initialized on the first RPC request so the WASM module
loads only when needed. The returned transport is safe to pass directly
to `createPublicClient`.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`HeliosTransportConfig`](../interfaces/HeliosTransportConfig.md) |

## Returns

`Promise`\<[`CustomTransport`](https://viem.sh/docs/index.html)\>
