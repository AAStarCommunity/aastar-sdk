> **connectLedger**(`config`): `Promise`\<[`LedgerSigner`](../interfaces/LedgerSigner.md)\>

Defined in: [packages/airaccount/src/auth/hardware/ledger.ts:67](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/auth/hardware/ledger.ts#L67)

Connect to a Ledger device via WebHID and return a LedgerSigner.

Must be called in response to a user gesture (button click, etc.) because
WebHID requestDevice() requires user activation.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`LedgerSignerConfig`](../interfaces/LedgerSignerConfig.md) |

## Returns

`Promise`\<[`LedgerSigner`](../interfaces/LedgerSigner.md)\>

## Example

```ts
const signer = await connectLedger();
const address = await signer.getAddress();
const provider = new AirAccountEIP1193Provider({
  ...,
  accountAddress: myAirAccountAddress,
  signer: (hash) => signer.sign(hash),
});
```
