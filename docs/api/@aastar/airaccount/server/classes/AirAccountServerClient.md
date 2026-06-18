Defined in: [packages/airaccount/src/server/server-client.ts:37](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/server-client.ts#L37)

Main facade for the YAAA Server SDK.
Wires all services together from a single config object.

## Example

```ts
import { AirAccountServerClient, MemoryStorage, LocalWalletSigner } from '@aastar/airaccount/server';

const client = new AirAccountServerClient({
  rpcUrl: 'https://sepolia.infura.io/v3/...',
  bundlerRpcUrl: 'https://api.pimlico.io/v2/11155111/rpc?apikey=...',
  chainId: 11155111,
  entryPoints: {
    v06: {
      entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
      factoryAddress: '0x...',
      validatorAddress: '0x...',
    },
  },
  storage: new MemoryStorage(),
  signer: new LocalWalletSigner('0xPRIVATE_KEY'),
});

const account = await client.accounts.createAccount('user-123');
```

## Constructors

### Constructor

> **new AirAccountServerClient**(`config`): `AirAccountServerClient`

Defined in: [packages/airaccount/src/server/server-client.ts:46](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/server-client.ts#L46)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`ServerConfig`](../interfaces/ServerConfig.md) |

#### Returns

`AirAccountServerClient`

## Properties

### accounts

> `readonly` **accounts**: [`AccountManager`](AccountManager.md)

Defined in: [packages/airaccount/src/server/server-client.ts:39](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/server-client.ts#L39)

***

### bls

> `readonly` **bls**: [`BLSSignatureService`](BLSSignatureService.md)

Defined in: [packages/airaccount/src/server/server-client.ts:41](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/server-client.ts#L41)

***

### ethereum

> `readonly` **ethereum**: [`EthereumProvider`](EthereumProvider.md)

Defined in: [packages/airaccount/src/server/server-client.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/server-client.ts#L38)

***

### paymaster

> `readonly` **paymaster**: [`PaymasterManager`](PaymasterManager.md)

Defined in: [packages/airaccount/src/server/server-client.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/server-client.ts#L42)

***

### tokens

> `readonly` **tokens**: [`TokenService`](TokenService.md)

Defined in: [packages/airaccount/src/server/server-client.ts:43](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/server-client.ts#L43)

***

### transfers

> `readonly` **transfers**: [`TransferManager`](TransferManager.md)

Defined in: [packages/airaccount/src/server/server-client.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/server-client.ts#L40)

***

### wallets

> `readonly` **wallets**: [`WalletManager`](WalletManager.md)

Defined in: [packages/airaccount/src/server/server-client.ts:44](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/airaccount/src/server/server-client.ts#L44)
