> **AgentActions** = `object`

Defined in: [packages/core/src/actions/agent.ts:12](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agent.ts#L12)

## Properties

### agentIdentityRegistry()

> **agentIdentityRegistry**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/agent.ts:18](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agent.ts#L18)

#### Returns

`Promise`\<`Address`\>

***

### ~~agentPolicies()~~

> **agentPolicies**: (`args`) => `Promise`\<[`AgentSponsorshipPolicy`](AgentSponsorshipPolicy.md)\>

Defined in: [packages/core/src/actions/agent.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agent.ts#L21)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `index`: `bigint`; `operator`: `Address`; \} |
| `args.index` | `bigint` |
| `args.operator` | `Address` |

#### Returns

`Promise`\<[`AgentSponsorshipPolicy`](AgentSponsorshipPolicy.md)\>

#### Deprecated

Removed in the v5.x contract refactor — per-operator agent policies are no longer stored on-chain (no `agentPolicies` in the SuperPaymaster ABI). Throws ErrorCode.NOT\_IMPLEMENTED.

***

### agentReputationRegistry()

> **agentReputationRegistry**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/agent.ts:19](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agent.ts#L19)

#### Returns

`Promise`\<`Address`\>

***

### ~~getAgentSponsorshipRate()~~

> **getAgentSponsorshipRate**: (`args`) => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/agent.ts:17](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agent.ts#L17)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `agent`: `Address`; `operator`: `Address`; \} |
| `args.agent` | `Address` |
| `args.operator` | `Address` |

#### Returns

`Promise`\<`bigint`\>

#### Deprecated

Removed in the v5.x contract refactor — the SuperPaymaster ABI has no per-agent sponsorship-rate getter; sponsorship is now a boolean eligibility check. Throws ErrorCode.NOT\_IMPLEMENTED; use [isEligibleForSponsorship](#iseligibleforsponsorship).

***

### isEligibleForSponsorship()

> **isEligibleForSponsorship**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/agent.ts:15](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agent.ts#L15)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `user`: `Address`; \} |
| `args.user` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### isRegisteredAgent()

> **isRegisteredAgent**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/agent.ts:14](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agent.ts#L14)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account`: `Address`; \} |
| `args.account` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### ~~setAgentPolicies()~~

> **setAgentPolicies**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/agent.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agent.ts#L25)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `policies`: [`AgentSponsorshipPolicy`](AgentSponsorshipPolicy.md)[]; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.policies` | [`AgentSponsorshipPolicy`](AgentSponsorshipPolicy.md)[] |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

#### Deprecated

Removed in the v5.x contract refactor — per-operator sponsorship policies are no longer configurable on-chain (no `setAgentPolicies`). Throws ErrorCode.NOT\_IMPLEMENTED; to wire up the agent identity/reputation registries use [setAgentRegistries](#setagentregistries).

***

### setAgentRegistries()

> **setAgentRegistries**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/agent.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/agent.ts#L26)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `identity`: `Address`; `reputation`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.identity` | `Address` |
| `args.reputation` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>
