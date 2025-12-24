# 网络配置文件模板目录

本目录包含不同网络的配置文件模板，用于在不同EVM网络上运行SDK测试。

## 📋 可用模板

- `sepolia.env.example` - Sepolia测试网配置
- `mainnet.env.example` - 以太坊主网配置
- `optimism.env.example` - Optimism主网配置
- `optimism-sepolia.env.example` - Optimism Sepolia测试网配置

## 🚀 使用方法

### 步骤1: 复制模板

```bash
# 复制Sepolia配置
cp config/networks/sepolia.env.example .env.sepolia

# 复制Mainnet配置
cp config/networks/mainnet.env.example .env.mainnet

# 复制Optimism配置
cp config/networks/optimism.env.example .env.optimism
```

### 步骤2: 填入真实配置

编辑复制的文件，替换以下内容：

1. **RPC_URL**: 你的Alchemy/Infura API Key
2. **ADMIN_KEY**: 你的私钥（⚠️ 测试网使用测试私钥，主网使用硬件钱包）
3. **合约地址**: 部署到目标网络的合约地址

### 步骤3: 运行测试

```bash
# 使用dotenv-cli加载配置
dotenv -e .env.sepolia -- pnpm run test:full_sdk

# 或使用环境变量
RPC_URL=... REGISTRY_ADDRESS=... pnpm run test:full_sdk
```

## ⚠️ 安全提示

1. **永远不要提交 `.env.*` 文件到Git**
2. **使用硬件钱包或加密存储管理主网私钥**
3. **测试网私钥与主网私钥分离**
4. **定期轮换API Keys**

## 📖 详细文档

完整的网络切换指南请参考: [`docs/TEST_COMMANDS.md`](../../docs/TEST_COMMANDS.md#🌐-网络切换指南)
