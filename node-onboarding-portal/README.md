# Community Node Onboarding Portal

A thin, standalone UI that wires the **community KMS + DVT node initialization flow** end to end. It owns
no business logic: every chain / key / crypto operation goes through **`@aastar/sdk`** (`onboardDvtNode`,
`buildDvtPop`, the KMS `popSigner` seam). The page is only a flow-runner.

Deliberately **outside the pnpm workspace** (`packages/*`) so it stays independent and YAAA can lift `src/`
into its own app — `src/` is plain React (no Vite-specific APIs), only this shell is Vite.

## Flow (6 steps)

1. **下载镜像** — node image + DVT `/recipe` config template.
2. **填写配置** — network, node kind (local vs KMS-TEE), KMS/DVT URLs.
3. **连接钱包** — the operator EOA (on-chain `msg.sender`; stakes + registers; self-funded).
4. **生成密钥** — local: in-browser BLS key (never uploaded) → `buildDvtPop`; KMS-TEE: TEE-sealed key, PoP via KMS `/pop`.
5. **注册 + 质押** — `onboardDvtNode` idempotent: approve → `registerRole(ROLE_DVT)` (lock ≥30 GToken) → `registerWithProof`. Dry-run preview first.
6. **节点身份** — nodeId / operator / staked / registered + DVT `/identity` runtime read.

## Node kinds

| Kind | BLS key | PoP | Status |
|---|---|---|---|
| `local` / HSM | in browser / node | SDK `buildDvtPop` | ✅ works today |
| `kms-tee` key-less | sealed in TEE | KMS `/pop` (CC-37) | ⏳ pending KMS `/pop` live + A-board TA reflash |

## Run

```bash
npm install
npm run dev      # http://localhost:5180
npm run build    # tsc + vite build
```

## Notes

- **Owner 代付** (funding the operator from a community owner key) is intentionally NOT in this client-only
  portal — a browser must not hold the owner key. The operator self-funds; when short, the dry-run surfaces
  the required GToken/ETH. A backend "sponsor" endpoint is the place to add owner-代付 later.
- All SDK calls live in `src/lib/sdk.ts` — the single seam YAAA re-points at its own provider/config.
- **Key generation (Low security note)**: the local BLS key is generated in-browser with the WebCrypto
  CSPRNG (`crypto.getRandomValues`), shown for download, and never sent to a server or persisted. This is
  fine for testing/demo, but a **production node's long-term BLS signing key should be generated on an
  HSM / offline** and imported into the node image — not minted in a browser tab.
