> **AirAccountVersion** = `"M5"` \| `"M7"` \| `"M7r6"`

Defined in: [packages/airaccount/src/server/config.ts:61](https://github.com/AAStarCommunity/aastar-sdk/blob/b1c03926c79511489196c99c8f8801b69566f76d/packages/airaccount/src/server/config.ts#L61)

AirAccount contract version selection.
- "M7"   — r4 audit-final (default). Use for all new account creation.
- "M7r6" — r6 deployment (2026-03-29, superseded). Use ONLY to recover existing r6-deployed accounts.
- "M5"   — legacy 6-field InitConfig deployment.
