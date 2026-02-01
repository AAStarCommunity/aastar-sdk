> **getNetwork**(`network`): \{ `blockExplorer`: `"https://sepolia.etherscan.io"`; `chainId`: `11155111`; `name`: `"Sepolia"`; `nativeCurrency`: \{ `decimals`: `18`; `name`: `"Sepolia ETH"`; `symbol`: `"ETH"`; \}; `rpcUrl`: `"https://rpc.sepolia.org"`; \} \| \{ `blockExplorer`: `""`; `chainId`: `31337`; `name`: `"Anvil"`; `nativeCurrency`: \{ `decimals`: `18`; `name`: `"ETH"`; `symbol`: `"ETH"`; \}; `rpcUrl`: `"http://127.0.0.1:8545"`; \} \| \{ `blockExplorer`: `"https://optimistic.etherscan.io"`; `chainId`: `10`; `name`: `"Optimism"`; `nativeCurrency`: \{ `decimals`: `18`; `name`: `"Ether"`; `symbol`: `"ETH"`; \}; `rpcUrl`: `"https://mainnet.optimism.io"`; \} \| \{ `blockExplorer`: `"https://optimism-sepolia.blockscout.com"`; `chainId`: `11155420`; `name`: `"Optimism Sepolia"`; `nativeCurrency`: \{ `decimals`: `18`; `name`: `"Sepolia Ether"`; `symbol`: `"ETH"`; \}; `rpcUrl`: `"https://sepolia.optimism.io"`; \}

Defined in: [packages/core/src/networks.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/4bacc9848314b5f1ceb630b367762bab288eaa90/packages/core/src/networks.ts#L66)

Get network configuration

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `network` | `"anvil"` \| `"sepolia"` \| `"op-sepolia"` \| `"optimism"` | Network name |

## Returns

\{ `blockExplorer`: `"https://sepolia.etherscan.io"`; `chainId`: `11155111`; `name`: `"Sepolia"`; `nativeCurrency`: \{ `decimals`: `18`; `name`: `"Sepolia ETH"`; `symbol`: `"ETH"`; \}; `rpcUrl`: `"https://rpc.sepolia.org"`; \} \| \{ `blockExplorer`: `""`; `chainId`: `31337`; `name`: `"Anvil"`; `nativeCurrency`: \{ `decimals`: `18`; `name`: `"ETH"`; `symbol`: `"ETH"`; \}; `rpcUrl`: `"http://127.0.0.1:8545"`; \} \| \{ `blockExplorer`: `"https://optimistic.etherscan.io"`; `chainId`: `10`; `name`: `"Optimism"`; `nativeCurrency`: \{ `decimals`: `18`; `name`: `"Ether"`; `symbol`: `"ETH"`; \}; `rpcUrl`: `"https://mainnet.optimism.io"`; \} \| \{ `blockExplorer`: `"https://optimism-sepolia.blockscout.com"`; `chainId`: `11155420`; `name`: `"Optimism Sepolia"`; `nativeCurrency`: \{ `decimals`: `18`; `name`: `"Sepolia Ether"`; `symbol`: `"ETH"`; \}; `rpcUrl`: `"https://sepolia.optimism.io"`; \}

Network configuration

## Example

```ts
const network = getNetwork('sepolia');
console.log(network.chainId); // 11155111
```
