> **getNetwork**(`network`): \{ `blockExplorer`: `"https://sepolia.etherscan.io"`; `chainId`: `11155111`; `name`: `"Sepolia"`; `nativeCurrency`: \{ `decimals`: `18`; `name`: `"Sepolia ETH"`; `symbol`: `"ETH"`; \}; `rpcUrl`: `"https://rpc.sepolia.org"`; \} \| \{ `blockExplorer`: `""`; `chainId`: `31337`; `name`: `"Anvil"`; `nativeCurrency`: \{ `decimals`: `18`; `name`: `"ETH"`; `symbol`: `"ETH"`; \}; `rpcUrl`: `"http://127.0.0.1:8545"`; \}

Defined in: [packages/core/src/networks.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/6388ef6d7c1f0b08255a8800bb272255cd49bb47/packages/core/src/networks.ts#L44)

Get network configuration

## Parameters

### network

Network name

`"anvil"` | `"sepolia"`

## Returns

\{ `blockExplorer`: `"https://sepolia.etherscan.io"`; `chainId`: `11155111`; `name`: `"Sepolia"`; `nativeCurrency`: \{ `decimals`: `18`; `name`: `"Sepolia ETH"`; `symbol`: `"ETH"`; \}; `rpcUrl`: `"https://rpc.sepolia.org"`; \} \| \{ `blockExplorer`: `""`; `chainId`: `31337`; `name`: `"Anvil"`; `nativeCurrency`: \{ `decimals`: `18`; `name`: `"ETH"`; `symbol`: `"ETH"`; \}; `rpcUrl`: `"http://127.0.0.1:8545"`; \}

Network configuration

## Example

```ts
const network = getNetwork('sepolia');
console.log(network.chainId); // 11155111
```
