# 回归测试脚本对比验证

## 对比结果

### scripts/run_regression.sh (旧脚本)
**测试内容**:
```
scripts/v2_regression/00_validate_env.ts
scripts/v2_regression/01_setup_and_fund.ts
scripts/v2_regression/02_operator_onboarding.ts
scripts/v2_regression/03_community_registry.ts
scripts/v2_regression/04_enduser_flow.ts
scripts/v2_regression/05_admin_audit.ts
```
**特点**: 简单、仅运行V2回归测试、不处理Anvil启动

---

### run_full_regression.sh (新主脚本)
**测试内容** (包含上述所有6个 + 更多):
```
✅ scripts/v2_regression/00_validate_env.ts
✅ scripts/v2_regression/01_setup_and_fund.ts
✅ scripts/v2_regression/02_operator_onboarding.ts
✅ scripts/v2_regression/03_community_registry.ts
✅ scripts/v2_regression/04_enduser_flow.ts
✅ scripts/v2_regression/05_admin_audit.ts
   scripts/06_local_test_v3_admin.ts
   scripts/06_local_test_v3_funding.ts
   ...共24个测试
```
**特点**: 
- ✅ 包含所有v2_regression测试
- ✅ 自动启动Anvil
- ✅ 自动部署合约
- ✅ 支持Sepolia模式

---

### run_sdk_regression.sh (SDK独立测试)
**测试内容**:
```
22_test_bls_signing.ts
23_test_middleware.ts
20_sdk_full_capability.ts
18_sdk_e2e_verification.ts
19_sdk_experiment_runner.ts
```
**特点**: 
- SDK层面测试
- 不依赖Anvil
- 不与scripts/run_regression.sh重复

---

## ✅ 验证结论

**scripts/run_regression.sh** 的所有功能已100%包含在:
- ✅ `run_full_regression.sh` (包含全部6个v2_regression测试)

**无遗漏内容**: 
- run_full_regression.sh 是 scripts/run_regression.sh 的**超集**
- 包含完全相同的测试 + 额外18个高级测试

**可以安全删除**: 
- ✅ scripts/run_regression.sh (冗余)

---

## 推荐使用

**V2回归测试** (仅6个基础测试):
```bash
# 直接在Sepolia运行
REVISION_ENV=sepolia SDK_ENV_PATH=.env.sepolia \
  ./run_full_regression.sh --env sepolia --skip-deploy
```

**完整回归测试** (24个测试):
```bash
# Anvil本地
./run_full_regression.sh

# Sepolia
./run_full_regression.sh --env sepolia
```

**SDK独立测试**:
```bash
./run_sdk_regression.sh
```
