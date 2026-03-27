# 小黑书 (XiaoHeiShu) — 去中心化生活方式社区产品设计

> 基于 Spore Protocol + AT Protocol 混合架构的去中心化小红书

---

## 一、竞品全景调研（2024–2025 实时数据）

### 各协议用户规模对比

| 协议/产品 | 用户规模 | DAU | 融资 | 核心问题 |
|----------|---------|-----|------|---------|
| **小红书** | 3亿 MAU | ~1亿 | — (IPO准备中，估值$310亿) | 中心化、内容归平台 |
| **BlueSky/AT Protocol** | **3850万注册** (2025.8) | 数百万 | $1亿 Series B | 实际仍半中心化；变现未定 |
| **Nostr** (全生态) | ~99万有效账户 | ~22.8万/天 | — | 内容发现极差；图片存储依赖中心化 |
| **Farcaster/Warpcast** | ~20万总用户 | ~4万 | $1.5亿 | DAU极低（$1.5亿融资仅8万DAU，TechCrunch质疑）|
| **Lens Protocol V3** | ~65万账户 | 4.5万/周活 | $4500万 | 2022热潮→2024低谷（日新增从3.7万→150账户，-99%）|
| **Mirror/Paragraph** | ~10万创作者 | — | $500万 | 无内容发现；2025年Mirror关闭迁移至Paragraph |

---

### 协议深度对比：哪个最适合做小红书？

#### Nostr（Damus / Amethyst / Primal）

**架构**：极简（客户端 + 中继节点）；secp256k1 签名；WebSocket 广播；NIP 扩展标准

**实际数据**：
- 2024年8月文本事件突破 **3亿条**，同比增长 1607%
- Lightning Zaps 突破 **500万次**里程碑
- Damus iOS 下载量 10万+；Amethyst 是 Android 上功能最全的客户端

**优势**：抗审查能力最强；Zaps 微支付最成熟；完全去中心化

**致命弱点**：
1. 图片只存 URL，文件在中心化服务器（nostr.build、imgur）——**内容随时消失**
2. 无算法推荐，内容发现几乎靠关注图谱
3. 私钥丢失 = 永久失去账户（无社会恢复）

---

#### Farcaster / Warpcast（Snapchain）

**架构**：混合型 — 身份上链（OP Mainnet）+ 数据链下（Snapchain）

**Snapchain 技术亮点（2025年4月主网）**：
- Malachite BFT 共识（Rust版Tendermint）
- 10,000+ TPS；延迟 < 780ms（100个验证者）
- 理论支撑 100-200万 DAU

**变现数据**：
- Warpcast Pro **$120/年**，首日 10,000 份 6 小时售罄 → **$1.2M 营收**
- 每周 **$25,000+ USDC** 创作者奖励池（订阅收入 100% 再分配）
- Frames 小程序累计 **$191万**营收（2024年中）

**关键教训**：内容协议 + 创作者激励缺一不可；每次活动（Frames/Mini Apps）带来用户峰值但**留存极差**；11个验证者导致实际较中心化

---

#### BlueSky / AT Protocol ⭐ 架构最接近小红书

**三层架构**：
- **PDS（个人数据服务器）**：用户自托管，存储内容仓库
- **Relay（爬虫/聚合器）**：全网爬取 → Firehose 事件流
- **AppView**：消费 Firehose → 构建应用视图（信息流、搜索等）

**最关键创新**：
- **Feed Generator**：任何人可构建算法推荐 Feed，用户自选订阅 → **这是去中心化推荐的最接近小红书的设计**
- **Labeler/Ozone**：可插拔内容审核，客户端选择订阅哪个标签服务
- 数据可携：换 PDS 不丢数据，DID 持久

**弱点**：Relay 目前仍由 BlueSky 公司主控；变现模式未定

---

#### Lens Protocol V3（新 L2 链）

**2025年变化**：
- 独立 L2（ZKsync + Avail 数据可用性）
- GHO 作为 gas 代币（无 Gas 体验）
- Grove 免费去中心化存储
- 2024年12月融资 $3100万（Lightspeed Faction 领投）

**兴衰教训**：2022热潮（3.7万/天新用户）→ 2024低谷（150/天，-99%）。根本原因：**"Web3 echo chamber"**——价值主张不清晰，非加密圈普通用户根本不来。

---

### 小红书核心竞争力深度解析

**数据规模**：3亿 MAU · **每日 6亿次搜索** · 2024年营收 $48亿 · 2025年净利润预测 $30亿 · 估值 $310亿

**四大护城河**：

| 护城河 | 描述 | 能否去中心化 |
|-------|------|------------|
| **搜索即社区** | 60%用户从搜索栏开始；替代百度做消费决策 | ⚠️ 困难（需索引基础设施） |
| **收藏权重算法** | 收藏 > 分享 > 评论 > 点赞；内容长尾效应（2年前内容仍被推荐） | ❌ 极难复制（依赖6亿次/天私有数据） |
| **"笔记"内容格式** | 深度体验分享：场景+细节+价格+时间；非 Instagram 式浅图 | ✅ 可复制（协议层定义格式） |
| **种草→电商闭环** | 内容→搜索→产品链接→平台购买一体化，美妆品牌50%广告占比 | ⚠️ 部分可行（支付可去中心化，物流不行） |

**关键洞察**：小红书最大的护城河不是功能，而是 **6亿次/天的搜索行为数据**——这是任何去中心化克隆者最难复制的资产。

**去中心化的真正难点**：
1. **推荐算法**：多模态 AI（图片+文字+行为综合判断），用海量私有数据训练
2. **图片 CDN**：每天数千万张高质量图片，IPFS/Arweave 比 AWS CDN 慢 1-2 个数量级
3. **中文内容审核**：NLP 需要专门中文训练；女性主用户群对内容安全要求高
4. **虚假笔记**：付费软文/刷单，纯 DAO 投票难以及时处理

---

## 二、技术路线抉择：Spore Protocol vs AT Protocol vs 混合

### 结论：两者互补，应该混合架构

```
小红书功能拆分：
                  公开内容层              私密/支付层
                  (发帖/发现/推荐)         (私信/付费圈/打赏)
                       │                        │
                       ▼                        ▼
              ┌────────────────┐      ┌──────────────────┐
              │  AT Protocol   │      │  Spore Protocol  │
              │  (最适合)      │      │  (最适合)        │
              │                │      │                  │
              │ • Feed格式定义 │      │ • NIP-17 E2E私信 │
              │ • Feed Generator│     │ • X402 打赏/付费 │
              │ • PDS数据自托管│      │ • Channel 订阅制 │
              │ • Labeler 审核 │      │ • MLS 付费群组   │
              │ • Firehose索引 │      │ • AirAccount身份 │
              └────────────────┘      └──────────────────┘
```

**为什么 AT Protocol 更适合做公开内容层？**
- Feed Generator 架构 = 开放算法市场，用户选择"谁给我推荐内容" → 最接近去中心化小红书推荐的可行方案
- Labeler/Ozone = 可插拔内容审核 → 解决了垃圾内容治理
- 3850万用户已有基础 → 冷启动成本低

**为什么 Spore Protocol 更适合做私密/支付层？**
- 原生 X402/Channel 支付桥 → 无需第三方接入就能打赏/付费
- NIP-44 E2E 加密私信 → 竞品没有内置真正隐私私信
- AirAccount（一个 key = ETH + Nostr）→ 最低门槛 Web3 身份
- SuperPaymaster → gasless 体验，普通用户无感 Web3

---

## 三、小黑书产品定义

### 定位

> **小黑书 = 去中心化生活方式社区，内容属于用户，收益直接归创作者，平台 0 抽成**

**与小红书的核心差异**：

| 维度 | 小红书 | 小黑书 |
|------|-------|-------|
| 内容所有权 | 平台 | 用户（PDS 自托管） |
| 推荐算法 | 中心化黑盒 | **开放算法市场**（用户选择 Feed Generator） |
| 创作者变现 | 平台分成 30-50% | **100% 直达创作者**（X402/Channel 原生支付） |
| 私信 | 平台可读 | **E2E 加密**（NIP-44 + MLS） |
| 付费私圈 | 平台中转 | **直接 P2P 支付**（Channel Bridge） |
| 身份 | 手机号绑定 | **AirAccount EOA**，一个 key 跨 ETH+消息 |
| 内容审核 | 中心化团队 | **可选 Labeler**，用户自选信任哪个审核服务 |

---

## 四、技术架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                    小黑书 App (Web / iOS / Android)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐ │
│  │ 发现Feed │  │  发帖   │  │  私信   │  │  创作者中心 / 钱包  │ │
│  │(话题/推荐)│  │(图文/视频)│  │ (付费圈)│  │  (打赏/订阅/NFT)   │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────────────┘ │
└──────┬──────────────┬──────────────────────────────┬────────────────┘
       │              │                              │
       ▼              ▼                              ▼
┌─────────────┐ ┌──────────────┐          ┌─────────────────────┐
│ AT Protocol │ │ IPFS/Arweave │          │   Spore Protocol    │
│             │ │  媒体存储    │          │  @aastar/messaging  │
│ • PDS       │ │              │          │                     │
│ • Feed Gen  │ └──────────────┘          │ • NIP-17 DM (M1)   │
│ • Labeler   │                           │ • X402/Channel (M2) │
│ • Firehose  │                           │ • NIP-29 Groups (M6)│
└─────────────┘                           │ • MLS E2E (M9)     │
       │                                  │ • HTTP Gateway (M10)│
       ▼                                  │ • AirAccount (M8)  │
┌─────────────────────────────────────────┘
│  Identity Bridge: AT Protocol DID ↔ AirAccount EOA
└────────────────────────────────────────────────────
```

### 内容 Schema（AT Protocol Lexicon）

```typescript
// app.xiaohei.note — 小黑书笔记格式
{
  "$type": "app.xiaohei.note",
  "title": "上海这家咖啡馆值得专程来",
  "body": "手冲耶加雪菲真的绝了，海拔2000米产区...",
  "images": [
    {
      "$type": "app.bsky.embed.image",
      "image": { "$type": "blob", "ref": "ipfs://QmXxx", "mimeType": "image/jpeg" },
      "alt": "咖啡馆门口"
    }
  ],
  "tags": ["咖啡", "上海", "探店", "精品咖啡"],
  "location": { "lat": 31.2304, "lng": 121.4737, "name": "静安区" },
  "price": { "amount": "38", "currency": "CNY" },
  "category": "food",
  "createdAt": "2025-03-27T10:00:00Z"
}
```

### 三层推荐架构（Feed Generator）

```
第1层：关注图谱 Feed（零冷启动问题）
  ─ 订阅所有关注用户的笔记
  ─ 按发布时间倒序

第2层：话题策展 Feed（去中心化 Prism 模式）
  ─ 策展人整理优质笔记 → 发布 Feed Generator
  ─ 读者订阅优质策展人 → 获得精选内容
  ─ 策展人通过 X402 收取订阅费

第3层：算法推荐 Feed（联邦计算，长期目标）
  ─ Feed Generator 节点运营商本地 embedding 计算
  ─ 节点质押 xPNTs，推荐质量差 → slash
  ─ 用户选择信任哪个推荐节点（完全透明）
```

### 图片存储方案

```typescript
// 多后端存储，按预算和需求选择
type StorageBackend = 'ipfs-pinata' | 'ipfs-web3storage' | 'arweave' | 'filecoin';

async function uploadMedia(file: File, tier: 'hot' | 'cold'): Promise<string> {
  if (tier === 'hot') {
    // 热数据：IPFS + CDN 缓存（用 Cloudflare IPFS 网关加速）
    const cid = await pinata.pinFile(file);
    return `https://cloudflare-ipfs.com/ipfs/${cid}`;
  } else {
    // 冷归档：Arweave 永久存储（按 $0.005/KB 一次付清）
    const txId = await arweave.upload(file);
    return `ar://${txId}`;
  }
}
```

**存储成本对比**：
| 方案 | 成本（1GB） | 延迟 | 永久性 |
|------|-----------|------|--------|
| AWS S3 + CDN | $0.02/月 | < 50ms | 付费维持 |
| IPFS + Pinata | $0.15/月 | 100-500ms | 付费 pin |
| Arweave | $5.5 一次性 | 1-3s | **永久** |
| Filecoin | $0.001/月 | 1-5s | 合约期内 |

---

## 五、创作者变现体系

### 变现方式

```
┌──────────────────────────────────────────────────────────────┐
│                   创作者变现矩阵                               │
├──────────────┬──────────────────────────┬───────────────────┤
│ 变现方式     │ 技术实现                   │ 平台抽成          │
├──────────────┼──────────────────────────┼───────────────────┤
│ 即时打赏     │ X402 Bridge (M2)          │ 0%（协议直达）   │
│ 月度订阅     │ Channel Bridge 累积voucher│ 2%（协议费）     │
│ 付费私圈     │ NIP-29 + NFT 门控         │ 3%（协议费）     │
│ 内容 NFT     │ UserOp Bridge gasless 铸造│ 2.5% (协议费)   │
│ 品牌合作     │ 链上合同自动结算 (M14)    │ 1%（公证费）     │
│ xPNTs 奖励   │ 活跃度挖矿                │ — （协议激励）   │
└──────────────┴──────────────────────────┴───────────────────┘
```

**与 Farcaster Pro 对比**：
- Farcaster Pro：$120/年订阅，100% 给创作者池（但通过平台中转）
- 小黑书：读者直接向创作者支付 USDC/ETH，0 平台中转，创作者自主定价

### 打赏代码示例（读者侧）

```typescript
// 读者给创作者打赏 1 USDC
await fetch('/api/v1/messages/send', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    to: creatorPubkey,
    content: JSON.stringify({
      type: 'tip',
      amount: '1000000', // 1 USDC (6 decimals)
      token: USDC_ADDRESS,
      noteId: 'at://...',  // 被打赏的笔记
    }),
  }),
});
```

### aPNTs 挖矿规则（激励活跃）

| 行为 | aPNTs 奖励 |
|------|-----------|
| 发布笔记（被点赞 ≥ 10 次）| +5 |
| 收到打赏（任意金额）| +20 |
| 笔记被收藏（最强信号，对标小红书）| +10/次 |
| 成功引荐新用户 | +100 |
| 策展被订阅（每月） | +50/订阅者 |
| 30 天连续发帖 | +500 奖励 |

---

## 六、内容审核：AT Protocol Labeler 模式

```
无法避免的内容问题：
  垃圾营销 · 付费软文 · 违规图片 · 地区监管内容

解决方案：可插拔 Labeler（对标 AT Protocol Ozone）

用户选择
    │
    ├─── 订阅"小黑书官方 Labeler" → 适合普通用户
    ├─── 订阅"极简模式 Labeler" → 几乎不过滤
    ├─── 订阅"严格家庭 Labeler" → 儿童友好
    └─── 不订阅任何 Labeler → 完全原始内容

每个 Labeler：
  - 质押 xPNTs（恶意标签 → slash）
  - 公开审核标准
  - 用户随时切换
```

---

## 七、MVP 路线图

### Phase 1 — Web Demo（1-2 个月）

**技术栈**：Next.js + AT Protocol PDS + Spore Protocol HTTP Gateway (M10) + IPFS

**核心功能**：
| 功能 | 实现 | 工作量 |
|------|------|--------|
| AirAccount 登录 | M8 身份 | 3天 |
| 发图文笔记 | AT Protocol + IPFS | 1周 |
| 关注 Feed | AT Protocol PDS | 3天 |
| 话题标签浏览 | AT Protocol AppView | 3天 |
| 点赞/收藏 | AT Protocol like/repost | 2天 |
| USDC 打赏 | X402 Bridge (M2) | 1周 |
| E2E 私信 | NIP-17 DM (M1) | 已有 |
| 探索页（热门标签） | AT Protocol Firehose | 1周 |

**冷启动策略**：选择垂直社区（咖啡/穿搭/露营），人工运营初期 50 个种子创作者。

### Phase 2 — 移动端 + 策展（3-6 个月）

- React Native App（iOS + Android）
- 开放 Feed Generator API（策展人注册）
- 付费私圈（NIP-29 Groups + Channel Bridge）
- 创作者 NFT 内容（UserOp gasless 铸造）
- SBT 声誉积累

### Phase 3 — 协议化（6-12 个月）

- 推荐节点去中心化市场（质押 xPNTs）
- MushroomDAO 治理内容标准
- 跨协议互通（读取 Farcaster/BlueSky 内容）
- 链上品牌合作协议
- OpenPNTs 忠诚度体系

---

## 八、竞争差异化

**已有竞品没有做到的**：

1. **原生支付 × 内容**：Nostr 有 Zaps 但体验差；Farcaster 有 Frames 但需开发；**小黑书直接在笔记旁边一键打赏 USDC，0 手续费**

2. **E2E 加密私信 × 内容社区**：BlueSky/Farcaster 没有真正的 E2E 私信；**小黑书私信通过 NIP-44 完全加密**

3. **AirAccount 身份**：Nostr 私钥丢失 = 永久失号；Lens 需要 NFT Profile；**小黑书用 AirAccount 社会恢复，普通用户无感密钥管理**

4. **gasless 体验**：Lens 时代 Gas 费是最大杀手；**小黑书通过 SuperPaymaster 完全 gasless，用户感觉不到区块链**

5. **开放推荐算法**：小红书是黑盒；BlueSky Feed Generator 是最接近的，但没有激励体系；**小黑书的推荐节点质押 xPNTs，可验证、可问责**

---

## 九、风险评估

| 风险 | 概率 | 严重性 | 应对策略 |
|------|------|--------|---------|
| 推荐算法冷启动（无数据）| 高 | 高 | 垂直社区先行；人工策展初期 |
| IPFS 图片加载慢 | 高 | 中 | Cloudflare IPFS 网关 + 缓存策略 |
| 垃圾内容/付费软文 | 高 | 高 | Labeler 架构 + 质押惩罚 |
| Web3 用户门槛 | 高 | 高 | AirAccount 抽象密钥；邮件登录 → 后台 EOA |
| 监管风险（中国市场）| 高 | 高 | 先做出海版（全球市场）；可选合规 Labeler 模式 |
| 与小红书体验差距 | 极高 | 中 | 差异化定位：不是竞品，是"去中心化替代品" |

---

## 十、结论

**Spore Protocol 完全可以支撑小黑书的核心体验**，最优方案是：

- **公开内容层**：AT Protocol（Feed、发现、审核架构最成熟）
- **私密/支付层**：Spore Protocol（E2E 加密私信、原生支付、AirAccount 身份）
- **存储层**：IPFS + Arweave 混合（热数据 IPFS CDN + 冷归档 Arweave 永久）

**Farcaster 的数据已验证商业可行性**：Pro 订阅首日 $1.2M，说明用户愿意为去中心化内容网络付费。小红书的"种草"格式 × Spore 的支付原语 = 自然组合。

**没有现有产品在做这件事**——这是真正的空白市场。小黑书不是要复制小红书，而是要成为：
> _"第一个让创作者100%拥有内容和收益的生活方式社区"_

**建议代号**：`Project XHB`（小黑书）
**对外品牌**：小黑书 — 你的内容，你的收益，你的自由
