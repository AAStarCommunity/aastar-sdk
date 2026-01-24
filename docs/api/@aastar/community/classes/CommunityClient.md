Defined in: [index.ts:66](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/community/src/index.ts#L66)

Community management client

## Role Required

ROLE_COMMUNITY (for most operations after launch)

## Description

Provides high-level APIs for community lifecycle operations

## Permission Requirements:
- **Launch Community**: Requires GToken balance >= stakeAmount + entryBurn
- **Issue xPNTs**: Requires COMMUNITY role
- **Configure SBT**: Requires COMMUNITY role + community ownership

## Typical Users:
- Community Administrators
- DAO Operators
- Protocol Partners

## Constructors

### Constructor

> **new CommunityClient**(`publicClient`, `walletClient`, `addresses?`): `CommunityClient`

Defined in: [index.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/community/src/index.ts#L86)

Initialize CommunityClient

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `publicClient` | [`PublicClient`](../../core/interfaces/PublicClient.md) | The public client for queries |
| `walletClient` | [`WalletClient`](../../core/interfaces/WalletClient.md) | The wallet client for transactions |
| `addresses?` | \{ `gtoken?`: `` `0x${string}` ``; `registry?`: `` `0x${string}` ``; `staking?`: `` `0x${string}` ``; \} | Optional contract address overrides |
| `addresses.gtoken?` | `` `0x${string}` `` | - |
| `addresses.registry?` | `` `0x${string}` `` | - |
| `addresses.staking?` | `` `0x${string}` `` | - |

#### Returns

`CommunityClient`

## Methods

### checkLaunchRequirements()

> **checkLaunchRequirements**(`address?`, `requiredAmount?`): `Promise`\<[`RoleRequirement`](../../core/interfaces/RoleRequirement.md)\>

Defined in: [index.ts:124](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/community/src/index.ts#L124)

Check if user meets requirements to launch a community

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `address?` | `` `0x${string}` `` | User address to check (optional, defaults to wallet account) |
| `requiredAmount?` | `bigint` | Total GToken required (stake + burn) |

#### Returns

`Promise`\<[`RoleRequirement`](../../core/interfaces/RoleRequirement.md)\>

Requirement check result

#### Role Required

None (pre-check before registration)

#### Example

```typescript
const check = await communityClient.checkLaunchRequirements(
    myAddress,
    parseEther("33")  // 30 stake + 3 burn
);
if (!check.hasEnoughGToken) {
    console.error(`❌ ${check.missingRequirements.join('\n')}`);
    return;
}
```

***

### configureSBTRules()

> **configureSBTRules**(`rules`): `Promise`\<`` `0x${string}` ``\>

Defined in: [index.ts:307](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/community/src/index.ts#L307)

Configure SBT minting rules for the community

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `rules` | [`SBTRuleConfig`](../interfaces/SBTRuleConfig.md) | SBT rule configuration |

#### Returns

`Promise`\<`` `0x${string}` ``\>

Transaction hash

#### Role Required

ROLE_COMMUNITY

#### Permission

Must be registered community admin + community ownership

***

### getCommunityStats()

> **getCommunityStats**(`communityId`): `Promise`\<[`CommunityStats`](../interfaces/CommunityStats.md)\>

Defined in: [index.ts:334](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/community/src/index.ts#L334)

Get community statistics

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `communityId` | `` `0x${string}` `` | Community address |

#### Returns

`Promise`\<[`CommunityStats`](../interfaces/CommunityStats.md)\>

Community statistics

#### Role Required

None (public query)

***

### issueXPNTs()

> **issueXPNTs**(`params`): `Promise`\<\{ `txHash`: `` `0x${string}` ``; `xpntsAddress`: `` `0x${string}` ``; \}\>

Defined in: [index.ts:255](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/community/src/index.ts#L255)

Issue community-specific xPNTs token

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `params` | [`XPNTsIssuanceParams`](../interfaces/XPNTsIssuanceParams.md) | xPNTs issuance parameters |

#### Returns

`Promise`\<\{ `txHash`: `` `0x${string}` ``; `xpntsAddress`: `` `0x${string}` ``; \}\>

xPNTs contract address and transaction hash

#### Role Required

ROLE_COMMUNITY

#### Permission

Must be registered community admin

***

### launchCommunity()

> **launchCommunity**(`config`): `Promise`\<\{ `communityId`: `` `0x${string}` ``; `txHash`: `` `0x${string}` ``; \}\>

Defined in: [index.ts:174](https://github.com/AAStarCommunity/aastar-sdk/blob/7f5ed5aca89613e9b5624bea21ce22cf3df12963/packages/community/src/index.ts#L174)

Launch a community with one-click operation

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `config` | [`CommunityLaunchConfig`](../interfaces/CommunityLaunchConfig.md) | Community configuration |

#### Returns

`Promise`\<\{ `communityId`: `` `0x${string}` ``; `txHash`: `` `0x${string}` ``; \}\>

Community ID and transaction hash

#### Role Required

None (will register ROLE_COMMUNITY)

#### Permission

Requires GToken balance >= stakeAmount + entryBurn

#### Description

Combines: approve → stake → register → configure
- Auto-approves GToken for staking contract
- Registers caller as COMMUNITY role
- Stakes required amount
- **Pre-checks requirements before execution**

#### Throws

Error if requirements not met

#### Example

```typescript
const communityClient = new CommunityClient(publicClient, walletClient);

try {
    const { communityId, txHash } = await communityClient.launchCommunity({
        name: "MyDAO",
        stakeAmount: parseEther("30"),
        entryBurn: parseEther("3"),
        logoURI: "ipfs://..."
    });
    console.log(`✅ Community launched: ${communityId}`);
} catch (error) {
    console.error(`❌ Failed: ${error.message}`);
}
```
