Defined in: [packages/airaccount/src/server/services/module-manager.ts:21](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/module-manager.ts#L21)

## Properties

### account

> **account**: `string`

Defined in: [packages/airaccount/src/server/services/module-manager.ts:23](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/module-manager.ts#L23)

The deployed AirAccount address

***

### guardianSigs?

> `optional` **guardianSigs**: `string`[]

Defined in: [packages/airaccount/src/server/services/module-manager.ts:38](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/module-manager.ts#L38)

Guardian signatures + module init data, packed as:
  bytes[0..65*sigsRequired] = guardian ECDSA sigs
  bytes[65*sigsRequired..]  = module onInstall() init data

Sig hash (per guardian, r5 format):
  keccak256("INSTALL_MODULE" ‖ chainId ‖ account ‖ moduleTypeId ‖ module ‖ keccak256(moduleInitData)).toEthSignedMessageHash()

sigsRequired: 0 if threshold<=40, 1 if <=70, 2 if =100

***

### module

> **module**: `string`

Defined in: [packages/airaccount/src/server/services/module-manager.ts:27](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/module-manager.ts#L27)

Module contract address to install

***

### moduleInitData?

> `optional` **moduleInitData**: `string`

Defined in: [packages/airaccount/src/server/services/module-manager.ts:40](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/module-manager.ts#L40)

Raw bytes passed to module.onInstall() after guardian sigs

***

### moduleTypeId

> **moduleTypeId**: [`ModuleTypeId`](../type-aliases/ModuleTypeId.md)

Defined in: [packages/airaccount/src/server/services/module-manager.ts:25](https://github.com/AAStarCommunity/aastar-sdk/blob/2b5b68a2b143613eff3004fddf2bff6f1eb1511f/packages/airaccount/src/server/services/module-manager.ts#L25)

ERC-7579 module type: 1=Validator, 2=Executor, 3=Fallback, 4=Hook
