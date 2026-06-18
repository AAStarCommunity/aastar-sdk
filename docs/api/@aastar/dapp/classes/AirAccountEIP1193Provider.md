Defined in: [packages/dapp/src/eip1193.ts:115](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/dapp/src/eip1193.ts#L115)

AirAccountEIP1193Provider — drop-in EIP-1193 wallet backed by an AirAccount M7 smart account.

Usage:
```ts
const provider = new AirAccountEIP1193Provider({
  chainId: 11155111,
  rpcUrl: 'https://rpc.sepolia.org',
  bundlerUrl: 'https://api.pimlico.io/v2/11155111/rpc?apikey=...',
  accountAddress: '0x...',
  signer: async (hash) => passkeySign(hash),
});
// Pass to wagmi, ethers.js BrowserProvider, or window.ethereum
```

## Constructors

### Constructor

> **new AirAccountEIP1193Provider**(`config`): `AirAccountEIP1193Provider`

Defined in: [packages/dapp/src/eip1193.ts:120](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/dapp/src/eip1193.ts#L120)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`AirAccountProviderConfig`](../interfaces/AirAccountProviderConfig.md) |

#### Returns

`AirAccountEIP1193Provider`

## Methods

### on()

> **on**(`event`, `listener`): `this`

Defined in: [packages/dapp/src/eip1193.ts:169](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/dapp/src/eip1193.ts#L169)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `event` | `string` |
| `listener` | (...`args`) => `void` |

#### Returns

`this`

***

### removeListener()

> **removeListener**(`event`, `listener`): `this`

Defined in: [packages/dapp/src/eip1193.ts:175](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/dapp/src/eip1193.ts#L175)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `event` | `string` |
| `listener` | (...`args`) => `void` |

#### Returns

`this`

***

### request()

> **request**(`__namedParameters`): `Promise`\<`unknown`\>

Defined in: [packages/dapp/src/eip1193.ts:125](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/dapp/src/eip1193.ts#L125)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `__namedParameters` | \{ `method`: `string`; `params?`: `unknown`[]; \} |
| `__namedParameters.method` | `string` |
| `__namedParameters.params?` | `unknown`[] |

#### Returns

`Promise`\<`unknown`\>
