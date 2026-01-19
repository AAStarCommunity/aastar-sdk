npm warn Unknown project config "pnpm-lock.yaml". This will stop working in the next major version of npm.
npm warn Unknown project config "frozen-lockfile". This will stop working in the next major version of npm.
npm warn Unknown project config "auto-install-peers". This will stop working in the next major version of npm.
npm warn Unknown project config "strict-peer-dependencies". This will stop working in the next major version of npm.
[dotenv@17.2.3] injecting env (28) from .env.sepolia -- tip: 🛠️  run anywhere with `dotenvx run -- yourcommand`
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
HttpRequestError: HTTP request failed.

Status: 429
URL: https://eth-sepolia.g.alchemy.com/v2/Bx4QRW1-vnwJUePSAAD7N
Request body: {"method":"eth_blockNumber"}

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
    'Request body: {"method":"eth_blockNumber"}'
  ],
  shortMessage: 'HTTP request failed.',
  version: '2.43.3',
  body: { method: 'eth_blockNumber', params: undefined },
  headers: Headers {
    date: 'Mon, 19 Jan 2026 05:07:06 GMT',
    server: 'istio-envoy',
    'content-length': '0'
  },
  status: 429,
  url: 'https://eth-sepolia.g.alchemy.com/v2/Bx4QRW1-vnwJUePSAAD7N'
}
