> **buildInstallModuleHash**(`chainId`, `account`, `moduleTypeId`, `module`, `moduleInitData`): `string`

Defined in: [packages/airaccount/src/server/services/module-manager.ts:63](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/services/module-manager.ts#L63)

Build the EIP-191 install hash that guardians must sign.

r5 format: includes keccak256(moduleInitData) to prevent config-swap attacks.

## Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `chainId` | `number` | `undefined` |
| `account` | `string` | `undefined` |
| `moduleTypeId` | [`ModuleTypeId`](../type-aliases/ModuleTypeId.md) | `undefined` |
| `module` | `string` | `undefined` |
| `moduleInitData` | `string` | `"0x"` |

## Returns

`string`

## Example

```ts
const hash = buildInstallModuleHash(chainId, account, 1, moduleAddress, moduleInitData);
const sig = await guardian.signMessage(hexToBytes(hash));
```
