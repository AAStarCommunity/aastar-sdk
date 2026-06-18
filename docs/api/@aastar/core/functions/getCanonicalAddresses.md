> **getCanonicalAddresses**(`chainId`): CanonicalAddresses & \{ gTokenStaking: \`0x$\{string\}\`; mySBT: \`0x$\{string\}\`; \} \| `undefined`

Defined in: [packages/core/src/addresses.ts:225](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/core/src/addresses.ts#L225)

Resolve the canonical contract address book for a chain, keyed by `chainId`,
normalized to the key names the role-based client factories expect.

The canonical table uses `staking` / `sbt`; the historical client factories
(and many consumers) reference `gTokenStaking` / `mySBT`. This helper returns
the canonical set plus those aliases so a single object satisfies both, which
is what makes `createEndUserClient({ chain })` resolve addresses automatically
— no manual `addresses` needed for any supported chain.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `chainId` | `number` | EVM chain id (e.g. 10 = Optimism, 11155111 = Sepolia). |

## Returns

CanonicalAddresses & \{ gTokenStaking: \`0x$\{string\}\`; mySBT: \`0x$\{string\}\`; \} \| `undefined`

The normalized address record, or `undefined` if the chain has no
         canonical entry (caller must then pass `addresses` explicitly).

## Example

```ts
import { optimism } from 'viem/chains';
const addrs = getCanonicalAddresses(optimism.id); // chainId 10
addrs?.registry; addrs?.mySBT; // alias of `sbt`
```
