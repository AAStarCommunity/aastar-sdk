# 回归测试脚本使用说明

## 仅使用两个回归脚本

### 1. `run_full_regression.sh` - 完整回归测试

**用途**: Anvil本地完整测试套件

**包含内容**:
- Anvil启动与清理
- 合约部署(DeployV3FullLocal.s.sol)
- 配置同步
- 24个测试脚本:
  - ✅ V2回归测试 (6个): 00-05
  - ✅ V3核心测试 (6个): 06-11
  - ✅ 高级功能测试 (12个): 12-23, 98-99

**运行方式**:
```bash
# Anvil模式(默认)
./run_full_regression.sh

# Sepolia模式(跳过部署)
./run_full_regression.sh --env sepolia
```

---

### 2. `run_sdk_regression.sh` - SDK独立测试

**用途**: SDK API层面的独立功能测试

**包含内容**:
- BLS签名测试
- Middleware测试
- 不依赖Anvil的纯SDK功能

**运行方式**:
```bash
./run_sdk_regression.sh
```

---

## ⚠️ 已删除脚本

- ❌ `scripts/run_regression.sh` (冗余,已合并到run_full_regression.sh)

---

## 快速使用指南

### 本地开发验证
```bash
./run_full_regression.sh
```

### Sepolia测试网验证
```bash
./run_full_regression.sh --env sepolia
```

### SDK功能测试
```bash
./run_sdk_regression.sh
```

---

**结论**: 只需要这两个脚本即可完成所有回归测试! ✅
