# 合约环境验证报告

## 合约部署状态

总计: 13 个合约
已部署: 13 个
未部署: 0 个

| 合约名称 | 地址 | 版本 | 状态 |
|---------|------|------|------|
| Registry | `0x2A3200B7c8459011bB62BdDAA87229780F182Ef0` | Registry-3.0.0 | ✅ |
| SuperPaymaster | `0x3E8402f02ab23986e9d9cbC582d45D013957F584` | SuperPaymaster-3.2.0 | ✅ |
| MySBT | `0xA9903F7129F85C575206B508767546c495E1f823` | MySBT-3.1.0 | ✅ |
| GToken | `0x67fA4659f010690F5E2725173D1Da92E73B917Ca` | GToken-2.1.0 | ✅ |
| GTokenStaking | `0x2a4D167b9d88b6625e877a307275A9ce48B301D5` | Staking-3.1.0 | ✅ |
| xPNTsFactory | `0x1924F7fC1BE4d6e790Cb9290e810CfcA7FfAd555` | xPNTsFactory-2.0.0 | ✅ |
| PaymasterFactory | `0x0B3493964B4292023Cc1E37c3d36e442394DCE23` | PaymasterFactory-1.0.0 | ✅ |
| ReputationSystem | `0xD790ee1E13866bf0EaCE73524713eca70905AE4b` | Reputation-0.3.0 | ✅ |
| BLSAggregator | `0x709Bb204384f5b21951352523F455dDC1e51f9aB` | BLSAggregator-3.1.2 | ✅ |
| DVTValidator | `0x39E815F7143172945E88D9ed6C48C628089e25ce` | DVTValidator-0.3.0 | ✅ |
| BLSValidator | `0xEe970aF5A479BFbf3cF31Bda1BE82166D500167a` | BLSValidator-0.3.0 | ✅ |
| EntryPoint | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | N/A | ✅ |
| SimpleAccountFactory | `0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985` | N/A | ✅ |

## 合约依赖关系

总计: 6 个依赖关系
有效: 5 个
无效: 1 个

| 来源 | 目标 | 关系 | 状态 |
|------|------|------|------|
| MySBT | Registry | REGISTRY | ✅ |
| GTokenStaking | Registry | REGISTRY | ✅ |
| GTokenStaking | GToken | GTOKEN | ✅ |
| SuperPaymaster | xPNTsFactory | xPNTsFactory | ❌ (The contract function "xPNTsFactory" reverted.

Contract Call:
  address:   0x3E8402f02ab23986e9d9cbC582d45D013957F584
  function:  xPNTsFactory()

Docs: https://viem.sh/docs/contract/readContract
Version: viem@2.41.2) |
| Registry | BLSAggregator | blsAggregator | ✅ |
| Registry | BLSValidator | blsValidator | ✅ |