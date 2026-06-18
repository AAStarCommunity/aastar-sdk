Defined in: [packages/dapp/src/eip1193.ts:74](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/dapp/src/eip1193.ts#L74)

## Properties

### accountAddress

> **accountAddress**: `` `0x${string}` ``

Defined in: [packages/dapp/src/eip1193.ts:84](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/dapp/src/eip1193.ts#L84)

The user's AirAccount smart contract address

***

### bundlerUrl

> **bundlerUrl**: `string`

Defined in: [packages/dapp/src/eip1193.ts:80](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/dapp/src/eip1193.ts#L80)

ERC-4337 bundler URL

***

### chainId

> **chainId**: `number`

Defined in: [packages/dapp/src/eip1193.ts:76](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/dapp/src/eip1193.ts#L76)

EVM chain ID

***

### entryPoint?

> `optional` **entryPoint**: `` `0x${string}` ``

Defined in: [packages/dapp/src/eip1193.ts:82](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/dapp/src/eip1193.ts#L82)

EntryPoint v0.7 address (defaults to canonical)

***

### rpcUrl

> **rpcUrl**: `string`

Defined in: [packages/dapp/src/eip1193.ts:78](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/dapp/src/eip1193.ts#L78)

Public JSON-RPC URL

***

### signer()

> **signer**: (`userOpHash`) => `Promise`\<`` `0x${string}` ``\>

Defined in: [packages/dapp/src/eip1193.ts:89](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/dapp/src/eip1193.ts#L89)

Signs the UserOp hash and returns a 65-byte hex signature.
For passkey/ECDSA, format as M7 composite validator signature.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `userOpHash` | `` `0x${string}` `` |

#### Returns

`Promise`\<`` `0x${string}` ``\>
