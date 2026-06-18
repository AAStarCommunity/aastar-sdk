> **CommunityProfile** = `object`

Defined in: [packages/core/src/actions/registry.ts:123](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/registry.ts#L123)

Rich community metadata reconstructed from on-chain data.

The deployed v5 Registry stores community `roleData` only in an internal mapping
with NO public getter, so this profile is recovered via the event->calldata
back-trace pattern: locate the `RoleRegistered(ROLE_COMMUNITY, community)` log,
fetch the originating transaction, then decode its `registerRole` calldata to
extract the submitted `roleData` struct.

## Properties

### burnAmount

> **burnAmount**: `bigint`

Defined in: [packages/core/src/actions/registry.ts:131](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/registry.ts#L131)

burnAmount from the RoleRegistered event.

***

### description

> **description**: `string`

Defined in: [packages/core/src/actions/registry.ts:127](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/registry.ts#L127)

***

### ensName

> **ensName**: `string`

Defined in: [packages/core/src/actions/registry.ts:125](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/registry.ts#L125)

***

### logoURI

> **logoURI**: `string`

Defined in: [packages/core/src/actions/registry.ts:128](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/registry.ts#L128)

***

### name

> **name**: `string`

Defined in: [packages/core/src/actions/registry.ts:124](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/registry.ts#L124)

***

### rawRoleData

> **rawRoleData**: [`Hex`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/actions/registry.ts:137](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/registry.ts#L137)

Raw ABI-encoded roleData bytes from the registration calldata.

***

### registeredAt

> **registeredAt**: `bigint`

Defined in: [packages/core/src/actions/registry.ts:133](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/registry.ts#L133)

Block timestamp recorded in the RoleRegistered event.

***

### stakeAmount

> **stakeAmount**: `bigint`

Defined in: [packages/core/src/actions/registry.ts:129](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/registry.ts#L129)

***

### txHash

> **txHash**: [`Hash`](https://viem.sh/docs/index.html)

Defined in: [packages/core/src/actions/registry.ts:135](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/registry.ts#L135)

Transaction hash that registered the community (calldata source).

***

### website

> **website**: `string`

Defined in: [packages/core/src/actions/registry.ts:126](https://github.com/AAStarCommunity/aastar-sdk/blob/e4ea336635813250410f8608b346bd3d140d4419/packages/core/src/actions/registry.ts#L126)
