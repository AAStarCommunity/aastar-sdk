> **PolicyRegistryActions** = `object`

Defined in: [packages/core/src/actions/policyRegistry.ts:75](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L75)

## Properties

### checkPolicy()

> **checkPolicy**: (`args`) => `Promise`\<\{ `decision`: [`PolicyDecision`](../enumerations/PolicyDecision.md); `remainingDaily`: `bigint`; \}\>

Defined in: [packages/core/src/actions/policyRegistry.ts:83](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L83)

Validation-time policy decision for one intended action. OPT-IN, default-ALLOW:
a sender with nothing configured for (asset, target) is UNRESTRICTED.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `amount`: `bigint`; `asset`: `Address`; `selector`: [`Hex`](https://viem.sh/docs/index.html); `sender`: `Address`; `target`: `Address`; \} |
| `args.amount` | `bigint` |
| `args.asset` | `Address` |
| `args.selector` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.sender` | `Address` |
| `args.target` | `Address` |

#### Returns

`Promise`\<\{ `decision`: [`PolicyDecision`](../enumerations/PolicyDecision.md); `remainingDaily`: `bigint`; \}\>

decision (see [PolicyDecision](../enumerations/PolicyDecision.md)) + `remainingDaily` headroom in the
         current window AFTER `amount` would post (`type(uint256).max` when unrestricted).

***

### DEFAULT\_WINDOW()

> **DEFAULT\_WINDOW**: () => `Promise`\<`bigint`\>

Defined in: [packages/core/src/actions/policyRegistry.ts:106](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L106)

Default daily-limit window length (seconds) used when `windowSeconds == 0`.

#### Returns

`Promise`\<`bigint`\>

***

### ETH\_SENTINEL()

> **ETH\_SENTINEL**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/policyRegistry.ts:108](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L108)

The ETH sentinel address used as `asset` for native ETH (address(0) is invalid).

#### Returns

`Promise`\<`Address`\>

***

### freezeSender()

> **freezeSender**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/policyRegistry.ts:129](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L129)

Immediately freeze `sender`: [checkPolicy](#checkpolicy) returns REJECT for all ops.
`onlyGuardianOrTimelock` (guardian = AirAccount 2-of-3 RecoveryService). Lifting
the freeze is a loosening → [unfreezeSender](#unfreezesender) (timelocked).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `sender`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.sender` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### getAssetPolicy()

> **getAssetPolicy**: (`args`) => `Promise`\<[`AssetPolicy`](AssetPolicy.md)\>

Defined in: [packages/core/src/actions/policyRegistry.ts:86](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L86)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `asset`: `Address`; `sender`: `Address`; \} |
| `args.asset` | `Address` |
| `args.sender` | `Address` |

#### Returns

`Promise`\<[`AssetPolicy`](AssetPolicy.md)\>

***

### getAssetSpend()

> **getAssetSpend**: (`args`) => `Promise`\<[`SpendCounter`](SpendCounter.md)\>

Defined in: [packages/core/src/actions/policyRegistry.ts:90](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L90)

Cumulative native-unit spend + window start for this (sender, asset).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `asset`: `Address`; `sender`: `Address`; \} |
| `args.asset` | `Address` |
| `args.sender` | `Address` |

#### Returns

`Promise`\<[`SpendCounter`](SpendCounter.md)\>

***

### getContractScope()

> **getContractScope**: (`args`) => `Promise`\<[`ContractScope`](ContractScope.md)\>

Defined in: [packages/core/src/actions/policyRegistry.ts:87](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L87)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `sender`: `Address`; `target`: `Address`; \} |
| `args.sender` | `Address` |
| `args.target` | `Address` |

#### Returns

`Promise`\<[`ContractScope`](ContractScope.md)\>

***

### guardian()

> **guardian**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/policyRegistry.ts:96](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L96)

AirAccount 2-of-3 RecoveryService allowed to freeze/tighten immediately.

#### Returns

`Promise`\<`Address`\>

***

### isAuthorizedConsumer()

> **isAuthorizedConsumer**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/policyRegistry.ts:92](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L92)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `consumer`: `Address`; \} |
| `args.consumer` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### isFrozen()

> **isFrozen**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/policyRegistry.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L91)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `sender`: `Address`; \} |
| `args.sender` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### isSelectorAllowed()

> **isSelectorAllowed**: (`args`) => `Promise`\<`boolean`\>

Defined in: [packages/core/src/actions/policyRegistry.ts:88](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L88)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `selector`: [`Hex`](https://viem.sh/docs/index.html); `sender`: `Address`; `target`: `Address`; \} |
| `args.selector` | [`Hex`](https://viem.sh/docs/index.html) |
| `args.sender` | `Address` |
| `args.target` | `Address` |

#### Returns

`Promise`\<`boolean`\>

***

### setAssetPolicy()

> **setAssetPolicy**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/policyRegistry.ts:141](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L141)

Set a (sender, asset) policy. `onlyTimelock` — reverts unless `msg.sender ==`
[timelock](#timelock)`()`. There is NO registry-level pending store: the 2-day delay is
the EXTERNAL OZ {TimelockController}'s own `minDelay`. To loosen, governance must
`schedule()` this call on the timelock, wait out the delay, then `execute()` it
(which makes the timelock call back here). Calling this directly with an EOA/owner
key will revert `NotTimelock`. Read [timelock](#timelock) for the controller address and
surface its scheduled-operation ETA (TimelockController.getTimestamp) to callers.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `asset`: `Address`; `params`: [`AssetPolicyInput`](AssetPolicyInput.md); `sender`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.asset` | `Address` |
| `args.params` | [`AssetPolicyInput`](AssetPolicyInput.md) |
| `args.sender` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setConsumerAuthorization()

> **setConsumerAuthorization**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/policyRegistry.ts:161](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L161)

Authorize / revoke a staked consumer permitted to call `recordSpend`.
`onlyTimelock` — route through [timelock](#timelock).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `authorized`: `boolean`; `consumer`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.authorized` | `boolean` |
| `args.consumer` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setContractScope()

> **setContractScope**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/policyRegistry.ts:148](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L148)

Set a (sender, target) scope and ADD the listed selectors (additive union, NOT
replace; remove via [tightenContractScope](#tightencontractscope)). `onlyTimelock` — same external
TimelockController gating as [setAssetPolicy](#setassetpolicy); calling directly reverts
`NotTimelock`. Schedule + execute through [timelock](#timelock).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `params`: [`ContractScopeInput`](ContractScopeInput.md); `sender`: `Address`; `target`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.params` | [`ContractScopeInput`](ContractScopeInput.md) |
| `args.sender` | `Address` |
| `args.target` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### setGuardian()

> **setGuardian**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/policyRegistry.ts:156](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L156)

Set the guardian. `onlyTimelock` — route through [timelock](#timelock).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `newGuardian`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.newGuardian` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### tightenAssetPolicy()

> **tightenAssetPolicy**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/policyRegistry.ts:117](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L117)

Immediately tighten a (sender, asset) policy. Reverts `NotStrictlyTighter`
unless the new params are <= current on every dimension. Callable by the
guardian or the timelock (`onlyGuardianOrTimelock`) — NO timelock delay.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `asset`: `Address`; `params`: [`AssetPolicyInput`](AssetPolicyInput.md); `sender`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.asset` | `Address` |
| `args.params` | [`AssetPolicyInput`](AssetPolicyInput.md) |
| `args.sender` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### tightenContractScope()

> **tightenContractScope**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/policyRegistry.ts:123](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L123)

Immediately tighten a (sender, target) scope (disallow target, remove selectors,
lower velocity, set requireDVTAlways). Reverts unless strictly tighter.
`onlyGuardianOrTimelock` — NO timelock delay.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `params`: [`ContractScopeInput`](ContractScopeInput.md); `sender`: `Address`; `target`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.params` | [`ContractScopeInput`](ContractScopeInput.md) |
| `args.sender` | `Address` |
| `args.target` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### timelock()

> **timelock**: () => `Promise`\<`Address`\>

Defined in: [packages/core/src/actions/policyRegistry.ts:104](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L104)

The OZ {TimelockController} whose `minDelay` (2 days) gates every loosening.
It is the ONLY address allowed to call the `onlyTimelock` loosen/admin setters
([setAssetPolicy](#setassetpolicy) / [setContractScope](#setcontractscope) / [unfreezeSender](#unfreezesender) /
[setGuardian](#setguardian) / [setConsumerAuthorization](#setconsumerauthorization)). Read this to find the
controller through which loosen calls must be scheduled + executed.

#### Returns

`Promise`\<`Address`\>

***

### unfreezeSender()

> **unfreezeSender**: (`args`) => `Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

Defined in: [packages/core/src/actions/policyRegistry.ts:154](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L154)

Lift a freeze on `sender`. Unfreeze is a loosening → `onlyTimelock`; must be
scheduled + executed through the external [timelock](#timelock) controller (2-day delay).
Calling directly reverts `NotTimelock`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `account?`: [`Account`](https://viem.sh/docs/index.html) \| `Address`; `sender`: `Address`; \} |
| `args.account?` | [`Account`](https://viem.sh/docs/index.html) \| `Address` |
| `args.sender` | `Address` |

#### Returns

`Promise`\<[`Hash`](https://viem.sh/docs/index.html)\>

***

### version()

> **version**: () => `Promise`\<`string`\>

Defined in: [packages/core/src/actions/policyRegistry.ts:109](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/core/src/actions/policyRegistry.ts#L109)

#### Returns

`Promise`\<`string`\>
