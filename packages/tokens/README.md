# @aastar/tokens

代币相关能力:GToken 质押/财务(`FinanceClient`)+ **MushroomDAO launch 代币销售**(`TokenSaleClient`)。

---

## TokenSaleClient — aPoints + 治理币销售

把 `launch.mushroom.cv/join` 页面的能力抽象成几行代码:用 USDC/USDT 购买 **aPoints (aPNTs)** 和**治理币 (GToken)**,支持两种模式:

| 模式 | 谁付 gas | 流程 |
|------|---------|------|
| **self-pay** | 用户 | `approve`(不足时)→ `buyTokens` / `buyAPNTs` |
| **gasless** | relayer | 签 EIP-3009(USDC)+ EIP-712 `BuyIntent` → POST relayer → 零 gas 上链 |

### 地址来源

- launch 自己的合约(两个 sale + BuyHelper)+ 支付币(USDC/USDT)存在 `@aastar/core` 的 `LAUNCH_SALE_ADDRESSES`,按 chainId 自动解析(目前:Sepolia)。
- **销售吐出的 token(GToken/aPNTs)地址不在配置里**,由客户端链上读 `sale.gToken()` / `sale.aPNTs()` 解析 —— 永远与链上一致,不会漂移。

### 用法

```ts
import { createPublicClient, createWalletClient, http, custom } from 'viem';
import { sepolia } from 'viem/chains';
import { TokenSaleClient, usd } from '@aastar/tokens';
// 或:import { TokenSaleClient, usd } from '@aastar/sdk';

const publicClient = createPublicClient({ chain: sepolia, transport: http() });
const walletClient = createWalletClient({ account, chain: sepolia, transport: custom(window.ethereum) });

const sale = new TokenSaleClient(publicClient, walletClient); // chainId 从 client 推断

// 查价 / 预估 / 余额
const { gToken, aPNTs } = await sale.getPrices();          // 6-dec USD 价
const out = await sale.quote('GTOKEN', usd(5));            // $5 能买多少 GT(18-dec)
const bal = await sale.getBalances(account);               // { eth, usdc, usdt, gToken, aPNTs }

// 自付 gas 购买
await sale.buySelfPay({ token: 'GTOKEN', usdAmount: usd(5) });                 // 默认 USDC
await sale.buySelfPay({ token: 'APNTS', usdAmount: usd(5), payToken: 'USDT' });

// 零 gas 购买(只支持 USDC),可送给他人
await sale.buyGasless({ token: 'GTOKEN', usdAmount: usd(5) });
await sale.buyGasless({ token: 'APNTS', usdAmount: usd(10), recipient: friendAddr });
```

### API

| 方法 | 说明 |
|------|------|
| `getPrices()` | `{ gToken, aPNTs }` 当前 USD 单价(6-dec) |
| `quote(token, usdAmount)` | 链上预估到手数量(18-dec) |
| `getBalances(account)` | ETH / USDC / USDT / GToken / aPNTs 余额 |
| `getPayoutToken(token)` | 链上解析 sale 实际吐出的 token 地址(带缓存) |
| `buySelfPay({ token, usdAmount, payToken?, minOut? })` | 自付 gas:自动 approve + buy,等回执 |
| `buyGasless({ token, usdAmount, recipient?, minOut?, deadlineSeconds?, relayerUrl? })` | 零 gas:签名 + relayer,等回执 |
| `usd(amount)` | 工具:`usd(1.5)` → `1500000n`(6-dec) |

- 金额一律用 6-dec 基本单位(`usd()` 帮你转)。`token`:`'GTOKEN'` \| `'APNTS'`;`payToken`:`'USDC'` \| `'USDT'`(gasless 仅 USDC)。
- 写操作需要传 `walletClient`;只读(价/余额/quote)只需 `publicClient`。

### ⚠️ 关于权威地址(Sepolia 现状)

当前线上 sale 合约在部署时把 token **焊死**在 launch 的测试 GToken/aPNTs(`0x4e6A…`/`0x4C4E…`),与 core 的权威 SuperPaymaster GToken/aPNTs(`0x20a05…`/`0x9e66B…`)**不是同一个**。所以现在买到的是 launch 测试币。

> 上主网前会做收敛(path A):在 launch repo 把 sale stack 重新绑定到权威 GToken/aPNTs 并重部署,届时 `getPayoutToken()` 会自动读出权威地址,SDK 这边只需更新 `LAUNCH_SALE_ADDRESSES` 的 3 个合约地址。

### 测试

```bash
pnpm --filter @aastar/tokens test   # mock viem,不发真实交易
```
