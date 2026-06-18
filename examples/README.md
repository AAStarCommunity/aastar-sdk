# AAStar SDK — Examples

## 👉 App examples have moved to a dedicated repo

The runnable **integration apps** — `embed-widget` (drop into an existing site) and
`starter-site` (greenfield Vite + React) — now live in their own repository, which is the
home for all feature-specific examples going forward:

### **https://github.com/AAStarCommunity/aastar-examples**

They show the full consumer story on the published [`@aastar/sdk`](https://www.npmjs.com/package/@aastar/sdk):
**email + passkey → smart account → gasless transaction** (via AirAccount KMS + SuperPaymaster).

For a complete, production-grade reference app see **[YetAnotherAA (YAA)](https://github.com/AAStarCommunity/YetAnotherAA)**.

## What remains here

This directory keeps the **in-repo demo scripts** (run with `tsx`) used during development
and regression — e.g. `l1-api-demo.ts`, `l2-clients-demo.ts`, `l3-*.ts`,
`simple-gasless-demo.ts`, `simple-superpaymaster-demo.ts`, `sdk-demo/`. These are scripts,
not deployable apps; the deployable starters are in `aastar-examples` above.
