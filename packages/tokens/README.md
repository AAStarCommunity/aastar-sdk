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

### 权威地址(Sepolia,Path A 已完成)

Sepolia 的 sale 栈已按 **path A** 重部署并绑定到 core 的**权威** SuperPaymaster GToken / aPNTs,`getPayoutToken()` 链上读出的就是权威地址(已上链核对):

| token | sale 合约(`LAUNCH_SALE_ADDRESSES`) | 链上 payout(`getPayoutToken`)= 权威币 |
|------|------|------|
| GToken | `0x29eE47…` | `0x20a051502a7AE6e40cfFd6EBe59057538E698984` |
| aPNTs  | `0x136654…` | `0x9e66B457E0ABb1F139FD8A596d00f784eBA2873b` |

即:在 Sepolia 用 `TokenSaleClient` 买到的就是**权威 GToken/aPNTs**(不再是 launch 测试币)。换链卖时,把那条链的 sale 栈部署好并在 `LAUNCH_SALE_ADDRESSES` 加一组地址即可;payout token 始终由客户端链上解析,不会漂移。

### 测试

```bash
pnpm --filter @aastar/tokens test   # mock viem,不发真实交易
```
