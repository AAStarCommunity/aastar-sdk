```ts
const RoleDataFactory: object;
```

Defined in: [packages/sdk/src/utils/roleData.ts:16](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/roleData.ts#L16)

## Type Declaration

| Name | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="community"></a> `community()` | (`params?`) => `` `0x${string}` `` | Data for Community Registration (matches Registry.sol CommunityRoleData) NOTE: Solidity's abi.encode(struct) adds a 32-byte offset prefix (0x20) which is required for abi.decode(struct) to work correctly. | [packages/sdk/src/utils/roleData.ts:42](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/roleData.ts#L42) |
| <a id="decodecommunity"></a> `decodeCommunity()` | (`data`) => `object` | - | [packages/sdk/src/utils/roleData.ts:91](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/roleData.ts#L91) |
| <a id="decodeenduser"></a> `decodeEndUser()` | (`data`) => `object` | - | [packages/sdk/src/utils/roleData.ts:117](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/roleData.ts#L117) |
| <a id="dvt"></a> `dvt()` | () => `` `0x${string}` `` | Data for Generic DVT Role (Empty) | [packages/sdk/src/utils/roleData.ts:26](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/roleData.ts#L26) |
| <a id="enduser"></a> `endUser()` | (`params?`) => `` `0x${string}` `` | Data for EndUser (matches Registry.sol EndUserRoleData) | [packages/sdk/src/utils/roleData.ts:69](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/roleData.ts#L69) |
| <a id="paymastersuper"></a> `paymasterSuper()` | () => `` `0x${string}` `` | Data for SuperPaymaster Operator (Empty) | [packages/sdk/src/utils/roleData.ts:20](https://github.com/AAStarCommunity/aastar-sdk/blob/ca5be67af1f307693964c4751e5988e8ce4adaae/packages/sdk/src/utils/roleData.ts#L20) |
