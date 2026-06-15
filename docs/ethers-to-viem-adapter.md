# ethers → viem Adapter Pattern (P2.7)

> **Status:** Guidance + runnable example. The AAStar SDK is **viem-native**; we do
> **not** ship a heavyweight ethers compatibility layer. If your app (e.g. YAA) is
> built on **ethers v6**, this document shows the canonical, low-maintenance way to
> bridge into the SDK rather than waiting on us to maintain an adapter package.
>
> All ethers API references below target **ethers v6** (the version used in this
> repo: `packages/airaccount/package.json` pins `ethers ^6.11.1`). ethers **v5**
> has different method names — they are called out where they diverge.

---

## TL;DR — pick the right strategy first

| Your situation | Recommended path | Why |
|---|---|---|
| You hold a **raw private key** (in an `ethers.Wallet`) | `privateKeyToAccount(pk)` from `viem/accounts` — **no bridge at all** | Same key, native viem account. Bridging would only add surface area. |
| Your signer is a **browser wallet** (`ethers.BrowserProvider` over `window.ethereum`) | Hand the **same EIP-1193 object** to viem's `custom(window.ethereum)` transport, use a **JSON-RPC account** | The wallet signs. Zero bespoke signing code to maintain. |
| Your key lives behind a **remote/HSM/KMS signer** exposed only through the `ethers.Signer` interface (no extractable key) | Wrap the `ethers.Signer` with viem's `toAccount(...)` (**Strategy B** below) | This is the *only* case where a real bridge is justified. |

The two "no bridge" rows are the common case. Read the decision note at the bottom
before reaching for Strategy B.

---

## Background: how ethers and viem coexist in this repo

ethers is **not** banned in the monorepo — it is used inside the AirAccount server
runtime, which predates the viem-first SDK surface:

- `packages/airaccount/src/server/providers/ethereum-provider.ts` — uses
  `ethers.JsonRpcProvider` for RPC + bundler calls.
- `packages/airaccount/src/server/adapters/local-wallet-signer.ts` — wraps an
  `ethers.Wallet` behind an `ISignerAdapter` interface.

The public, role-based SDK clients (`createEndUserClient`, `createOperatorClient`,
…) are **viem** clients. So the boundary YAA hits is: *"I have an ethers signer,
the SDK wants a viem `Account` + `Transport`."* That boundary is exactly what this
guide bridges.

The repo already ships a bridge in the **opposite** direction
(`packages/dapp/src/eip1193.ts` exposes an EIP-1193 provider you can hand to an
ethers `BrowserProvider`), which is a useful reference for the EIP-1193 shape.

---

## A viem `WalletClient`/`Account`, conceptually

A viem write-capable client is `Transport + Chain + Account`:

- **Transport** = how you reach the chain (`http(url)`, `webSocket(url)`,
  `custom(eip1193Provider)`).
- **Account** = who signs. Either a **Local Account** (signs locally; must
  implement `signMessage` / `signTypedData` / `signTransaction`) or a **JSON-RPC
  Account** (an `0x…` address; signing is delegated to the node/wallet behind the
  transport).

The AAStar role clients build the underlying client for you. For example,
`createEndUserClient` (see `packages/sdk/src/clients/endUser.ts:78`) takes:

```ts
createEndUserClient({
  chain,                 // viem Chain
  transport,             // viem Transport
  account,               // viem Account  (optional, required for writes)
  addresses,             // optional address overrides
})
```

So bridging from ethers means producing **(a)** a `transport` and **(b)** an
`account` that the SDK can consume.

---

## Strategy A (recommended for browser wallets): reuse the EIP-1193 provider

An ethers `BrowserProvider` is just a wrapper around an EIP-1193 object
(`window.ethereum`). viem can wrap the **same** object directly — so you don't
bridge through ethers at all, and the wallet does all signing:

```ts
import { createWalletClient, custom } from "viem";
import { optimismSepolia } from "viem/chains";
import { createEndUserClient } from "@aastar/sdk";

// `window.ethereum` is the same EIP-1193 object ethers.BrowserProvider wraps.
const eip1193 = (window as any).ethereum;

// JSON-RPC account: the wallet signs; we only need the address.
const [address] = await createWalletClient({
  chain: optimismSepolia,
  transport: custom(eip1193),
}).getAddresses();

const client = createEndUserClient({
  chain: optimismSepolia,
  transport: custom(eip1193),
  account: address, // JSON-RPC account (an address string is a valid viem Account)
});
```

There is no signing glue to maintain here: `eth_sendTransaction`,
`personal_sign`, and `eth_signTypedData_v4` are all routed to the wallet by viem.

---

## Strategy B (the real bridge): wrap an `ethers.Signer` as a viem account

Use this **only** when the key is not extractable and is exposed solely through
the `ethers.Signer` interface (remote signer / HSM / KMS). We wrap it with viem's
`toAccount`, mapping each signing primitive onto its ethers v6 equivalent.

```ts
import { toAccount } from "viem/accounts";
import { toBytes, type Hex, type Address } from "viem";
import type { Signer, TypedDataDomain } from "ethers";

/**
 * Wrap an ethers v6 Signer as a viem LocalAccount.
 *
 * The address must be known synchronously by `toAccount`, so we resolve it once
 * up-front via `signer.getAddress()` and pass it in.
 *
 * Supported: signMessage, signTypedData (sufficient for ERC-4337 / gasless flows,
 * which only need a signature over the UserOp hash).
 * signTransaction is intentionally guarded — see the caveat below.
 */
export async function ethersSignerToViemAccount(signer: Signer) {
  const address = (await signer.getAddress()) as Address;

  return toAccount({
    address,

    // viem passes `message` as a string OR `{ raw: Hex | ByteArray }`.
    // ethers v6 `signMessage` accepts `string | Uint8Array`.
    async signMessage({ message }) {
      if (typeof message === "string") {
        return (await signer.signMessage(message)) as Hex;
      }
      const raw = message.raw;
      const bytes = typeof raw === "string" ? toBytes(raw) : raw;
      return (await signer.signMessage(bytes)) as Hex;
    },

    // ethers v6: signer.signTypedData(domain, types, value).
    // (ethers v5 used the underscored `_signTypedData`.)
    // viem includes an `EIP712Domain` entry in `types`; ethers derives the domain
    // from `domain`, so that synthetic entry must be stripped.
    async signTypedData(typedData) {
      const { domain, types, message, primaryType } = typedData as any;
      const { EIP712Domain: _drop, ...ethersTypes } = types ?? {};
      return (await signer.signTypedData(
        (domain ?? {}) as TypedDataDomain,
        ethersTypes,
        message,
      )) as Hex;
    },

    // Transaction signing is NOT bridged here on purpose; see the caveat.
    async signTransaction() {
      throw new Error(
        "ethersSignerToViemAccount: signTransaction is not bridged. Use a JSON-RPC " +
          "account (Strategy A) for direct EOA sends, or use this account only for " +
          "ERC-4337 / gasless flows, which sign via signMessage.",
      );
    },
  });
}
```

### Why `signTransaction` is guarded (important caveat)

- A viem Local Account's `signTransaction` is invoked for **direct EOA**
  `sendTransaction` / `writeContract`. Faithfully mapping viem's
  `TransactionSerializable` to ethers' `TransactionRequest` (type 0/1/2/EIP-7702,
  serializer selection, chainId, fee fields) is fiddly and **version-sensitive**.
- More importantly, an `ethers.JsonRpcSigner` (the kind you get from a browser
  wallet via `BrowserProvider.getSigner()`) **does not support `signTransaction`
  at all** — it throws. So a generic bridge cannot promise it.
- The AAStar gasless path does **not** need it: `executeGasless` signs the UserOp
  hash with `signMessage({ message: { raw: userOpHash } })`
  (`packages/sdk/src/clients/endUser.ts:299`). So the wrapped account is fully
  sufficient for ERC-4337 / gasless usage.

If you genuinely have a private key (an `ethers.Wallet`), do **not** use this
bridge — use `privateKeyToAccount(privateKey)` from `viem/accounts` and you get a
native account with working `signTransaction` for free.

### Transport for Strategy B

For the transport, prefer viem's own `http(rpcUrl)` with an RPC URL you supply
explicitly — it avoids depending on ethers' internal connection accessors (in
ethers v6 the URL lives behind `provider._getConnection().url`, which is not a
stable public API). If your signer is browser-backed, you already have the
EIP-1193 object and should just use Strategy A.

---

## Worked example: wrapped ethers signer → a real `@aastar/sdk` call

This passes the bridged account into a **verified** exported SDK function.

- `createEndUserClient` — defined at `packages/sdk/src/clients/endUser.ts:78`,
  re-exported from `@aastar/sdk` at `packages/sdk/src/index.ts:12`
  (`export * from './clients/endUser.js';`).
- The method we call, `executeGasless`, is defined at
  `packages/sdk/src/clients/endUser.ts:194` and signs via `signMessage`
  (`packages/sdk/src/clients/endUser.ts:299`) — so it works with the wrapped
  account, which provides `signMessage`.

```ts
import { http, type Address } from "viem";
import { optimismSepolia } from "viem/chains";
import { Wallet, JsonRpcProvider } from "ethers";
import { createEndUserClient } from "@aastar/sdk";
import { ethersSignerToViemAccount } from "./ethers-viem-adapter"; // snippet above

async function main() {
  // 1. Your existing ethers v6 signer. In a real remote-signer setup this would
  //    be an HSM/KMS-backed Signer; we use a Wallet here only to make the example
  //    runnable. (With a real private key you'd prefer privateKeyToAccount.)
  const provider = new JsonRpcProvider(process.env.OP_SEPOLIA_RPC_URL);
  const ethersSigner = new Wallet(process.env.PRIVATE_KEY!, provider);

  // 2. Bridge: ethers Signer -> viem Account.
  const account = await ethersSignerToViemAccount(ethersSigner);

  // 3. Build a real AAStar viem client with the bridged account.
  const client = createEndUserClient({
    chain: optimismSepolia,
    transport: http(process.env.OP_SEPOLIA_RPC_URL),
    account, // <-- the wrapped ethers signer flows in here
  });

  // 4. Call a real SDK action. executeGasless signs the UserOp hash via
  //    signMessage, which our bridged account supports.
  const txHash = await client.executeGasless({
    target: "0xTargetContract..." as Address,
    data: "0x..." as `0x${string}`,
    operator: "0xSuperPaymasterOperator..." as Address,
  });

  console.log("Gasless tx:", txHash);
}

main().catch(console.error);
```

> Sanity note: this compiles against the current `@aastar/sdk` surface
> (`createEndUserClient` + `executeGasless`) and `viem`/`ethers v6`. The `0x…`
> placeholders are illustrative addresses you supply at runtime.

---

## Safe (`@safe-global`) multisig signing note

A Safe is **not an EOA** — it is a smart-contract account. That changes the shape
of the bridge, so read this before trying to "wrap a Safe as a viem account".

**What does not work:** a Safe cannot produce a standard ECDSA signature for an
arbitrary transaction the way a `Wallet` can. You cannot wrap "the Safe" as a viem
Local Account that returns a 65-byte secp256k1 signature. Safe transactions are
authorized by collecting signatures from the Safe's **owner** keys and then
calling the Safe's on-chain `execTransaction`, and Safe message validation is
done via **ERC-1271** `isValidSignature(bytes32,bytes)`.

**How it flows through the same path — two layers:**

1. **The owner EOA** that signs on behalf of the Safe is itself an ethers (or
   viem) signer. *That owner key* is what you bridge using Strategy A or B above.
   In other words, the ethers→viem pattern applies unchanged to the **owner**, not
   to the Safe contract.
2. **The Safe contract** is the on-chain account. For ERC-4337 / gasless usage,
   the Safe acts as the smart account; the owner signature is validated through
   the Safe (ERC-1271), not by treating the Safe as an EOA signer.

**Where the Safe tooling fits (version-sensitive — verify against your installed
versions; this is described at the integration-shape level, not pinned to exact
method signatures):**

- `@safe-global/protocol-kit` — build, sign (collect owner signatures), and
  execute Safe transactions. Recent versions accept a viem-style provider/signer
  config, so the bridged owner account from above is what you feed it.
- `@safe-global/relay-kit` (`Safe4337Pack`) — the supported route for running a
  Safe as an **ERC-4337** account through a bundler/paymaster. If you want a Safe
  to be the gasless smart account, this pack (not a hand-rolled viem Local
  Account) is the integration point.
- ERC-1271: for "sign a message as the Safe", the result is a contract signature
  validated by the Safe, not an EOA signature — design your verification around
  `isValidSignature` accordingly.

> This repo does **not** currently depend on any `@safe-global` package (verified:
> no `@safe-global`/`@safe` references under `packages/`). The exact method names,
> constructor options, and provider/signer config of `protocol-kit` and
> `relay-kit` have changed across major versions — treat the bullet points above
> as the integration **shape**, and confirm the precise API against the Safe docs
> for the version you install before writing code.

---

## Decision note: shipped adapter helper vs. just this pattern

**Use the pattern (no shipped helper) when — the default:**

- You have a raw private key → use `privateKeyToAccount` directly (no bridge).
- You have a browser wallet → use `custom(window.ethereum)` + a JSON-RPC account
  (Strategy A). No signing glue.
- You need a one-off `ethers.Signer` wrap for ERC-4337 / gasless → paste the
  ~30-line `ethersSignerToViemAccount` snippet. It is small and self-contained;
  vendoring it into your app is cheaper than depending on an SDK adapter whose
  bugs you'd then wait on us to fix.

**A shipped adapter helper would only be justified if all of these held:**

- Many independent consumers need the **identical** ethers→viem wrap (not a
  one-liner each can paste), **and**
- they require faithful `signTransaction` mapping across tx types (so the snippet
  above is insufficient), **and**
- the mapping must track ethers/viem releases centrally (a real maintenance
  burden the SDK is better positioned to carry than each app).

Today none of these hold for YAA's needs: the gasless flows need only
`signMessage`, browser wallets need no bridge, and raw keys should use
`privateKeyToAccount`. So we **deliberately ship guidance + this example instead
of an adapter package.** If a concrete consumer later hits the three conditions
above, promote the snippet into a small documented helper — but keep it as a
documented, copyable block, not a dependency you can't escape.
</content>
</invoke>
