npm warn Unknown project config "pnpm-lock.yaml". This will stop working in the next major version of npm.
npm warn Unknown project config "frozen-lockfile". This will stop working in the next major version of npm.
npm warn Unknown project config "auto-install-peers". This will stop working in the next major version of npm.
npm warn Unknown project config "strict-peer-dependencies". This will stop working in the next major version of npm.
[dotenv@17.2.3] injecting env (28) from .env.sepolia -- tip: 👥 sync secrets across teammates & machines: https://dotenvx.com/ops
# 🏆 AAStar Gasless 行业竞争力分析报告

💵 使用缓存 ETH 价格: $3211.75 (更新于 2026-01-19T04:47:21.000Z)
✅ 解析完成：从 45 个日志文件中提取 28 条交易记录

📡 正在处理 28 笔交易数据...

📊 进度: 5/28
📊 进度: 10/28
📊 进度: 15/28
📊 进度: 20/28
📊 进度: 25/28
📊 进度: 28/28

🔮 正在执行成本归因分析...
❌ 获取 Oracle 更新历史失败: HttpRequestError: HTTP request failed.

Status: 429
URL: https://eth-sepolia.g.alchemy.com/v2/Bx4QRW1-vnwJUePSAAD7N
Request body: {"method":"eth_getLogs","params":[{"address":"0xe74304CC5860b950a45967e12321Dff8B5CdcaA0","topics":["0x945c1c4e99aa89f648fbfe3df471b916f719e16d960fcec0737d4d56bd696838"],"fromBlock":"0x99bd98","toBlock":"0x99bd9c"}]}

Details: Too Many Requests
Version: viem@2.43.3
    at Object.request (/Users/jason/Dev/mycelium/my-exploration/projects/aastar-sdk/node_modules/.pnpm/viem@2.43.3_typescript@5.7.2/node_modules/viem/utils/rpc/http.ts:155:17)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async fn (/Users/jason/Dev/mycelium/my-exploration/projects/aastar-sdk/node_modules/.pnpm/viem@2.43.3_typescript@5.7.2/node_modules/viem/clients/transports/http.ts:148:19)
    at async request (/Users/jason/Dev/mycelium/my-exploration/projects/aastar-sdk/node_modules/.pnpm/viem@2.43.3_typescript@5.7.2/node_modules/viem/clients/transports/http.ts:153:39)
    at async delay.count.count (/Users/jason/Dev/mycelium/my-exploration/projects/aastar-sdk/node_modules/.pnpm/viem@2.43.3_typescript@5.7.2/node_modules/viem/utils/buildRequest.ts:150:22)
    at async attemptRetry (/Users/jason/Dev/mycelium/my-exploration/projects/aastar-sdk/node_modules/.pnpm/viem@2.43.3_typescript@5.7.2/node_modules/viem/utils/promise/withRetry.ts:44:22) {
  details: 'Too Many Requests',
  docsPath: undefined,
  metaMessages: [
    'Status: 429',
    'URL: https://eth-sepolia.g.alchemy.com/v2/Bx4QRW1-vnwJUePSAAD7N',
    'Request body: {"method":"eth_getLogs","params":[{"address":"0xe74304CC5860b950a45967e12321Dff8B5CdcaA0","topics":["0x945c1c4e99aa89f648fbfe3df471b916f719e16d960fcec0737d4d56bd696838"],"fromBlock":"0x99bd98","toBlock":"0x99bd9c"}]}'
  ],
  shortMessage: 'HTTP request failed.',
  version: '2.43.3',
  body: { method: 'eth_getLogs', params: [ [Object] ] },
  headers: Headers {
    date: 'Mon, 19 Jan 2026 05:00:47 GMT',
    server: 'istio-envoy',
    'content-length': '0'
  },
  status: 429,
  url: 'https://eth-sepolia.g.alchemy.com/v2/Bx4QRW1-vnwJUePSAAD7N'
}

⚖️  正在对比行业基准数据...
⚠️  使用默认 L2 基准数据
⚠️  使用默认 L2 基准数据

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 1. 效率评分与核心指标

| 指标 | 数值 | 评价 |
| :--- | :--- | :--- |
| **综合效率得分** | **80/100** | 良好 |
| **vs L2 平均成本** | 1.81x | ⚠️  略高 |
| **vs 主流 Paymaster** | 1.8x | ✅ 合理 |
| **协议毛利率** | **-43.4%** | ⚠️  补贴运行 |

> **战略建议**: ✅ 极具竞争力。当前成本结构已达到行业最优水平，建议扩大商用。

## 2. 竞争力矩阵 (USD/Op)

| 方案名称 | 成本/UserOp | 方案类型 |
| :--- | :--- | :--- |
| alchemy | $0.0029 | Competitor |
| OP Mainnet | $0.0200 | L2 Platform |
| coinbase | $0.0363 | Competitor |
| pimlico | $0.0365 | Competitor |
| biconomy | $0.0625 | Competitor |
| **AAStar (Current)** | $0.5973 | Our Protocol |
| Arbitrum One | $0.6400 | L2 Platform |
| stackup | $1.5202 | Competitor |
| Starknet | $8.5000 | L2 Platform |

## 3. 成本结构分解 (per UserOp)

| 组件 | 美元成本 | 占比 |
| :--- | :--- | :--- |
| 外部：Network Base Fee | $0.5376 | 90.0% |
| 外部：Bundler Priority Fee | $0.0597 | 10.0% |
| 内部：Oracle Amortized | $0.005000 | 0.84% |
| 协议：AAStar Net Margin | $-0.2641 | -% |

## 4. 关键洞察

1. **成本控制**: 当前单笔交易成本约为 **$0.60**，处于主流 L2 方案的 **1.8** 倍。
2. **价值捕获**: 当前处于市场扩张阶段，协议每笔交易补贴用户约 **$0.26**。
3. **竞争态势**: 与 Alchemy/Pimlico 相比，AAStar 在 L1 层面表现出更高的逻辑开销，建议持续优化 `postOp` 计算量。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*报告自动生成于 packages/analytics/src/gas-analyzer-v4.ts*

