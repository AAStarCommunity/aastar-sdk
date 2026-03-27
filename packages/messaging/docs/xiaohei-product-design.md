# 小黑书 (XiaoHeiShu) — 去中心化生活方式社区产品设计

> 基于 Spore Protocol + Mycelium Network 构建的去中心化小红书

---

## 竞品调研：去中心化社交协议格局 (2024–2025)

### 主流去中心化社交协议对比

| 协议 | 代表产品 | 内容类型 | 变现模型 | 用户规模 | 核心问题 |
|------|---------|---------|---------|---------|---------|
| **Nostr** | Damus, Amethyst, Snort, Prism | 短文、图片、长文 | zap (闪电网络打赏) | ~500k 注册 | 无算法推荐、内容发现差 |
| **Farcaster** | Warpcast | 短文 (Casts)、Frames 小程序 | Pro 订阅 $120/年、$25k+ 周创作奖励 | ~500k 注册，~30k DAU | DAU 低、内容同质化 |
| **Lens Protocol** | Hey.xyz, Orb | 短文、图片、视频 | NFT 内容收益、订阅费 | ~200k 注册 | Gas 费高、UX 复杂 |
| **AT Protocol** | BlueSky | 短文 (Skeets) | 无 (早期) | ~30M 注册 (2025) | 中心化 Relay、无变现 |
| **ActivityPub** | Mastodon | 短文、图片、视频 | 无原生变现 | ~10M 活跃 | 各站孤岛、无统一身份 |
| **Mirror.xyz** | Mirror | 长文章 | NFT 收藏、订阅 | ~100k 创作者 | 仅长文、无社交互动 |

### Prism (Nostr-based)

Prism 是基于 Nostr 的去中心化内容发现协议，核心创新是：
- **内容策展 NFT**：策展人将好内容组合成 NFT 销售
- **Zap-to-boost**：付费提升内容曝光（用闪电网络 satoshi）
- **问题**：依赖闪电网络，移动端体验差；没有图片/视频 feed 格式

### Farcaster 变现模式深度分析 (2025最新)

- Pro 订阅：$120/年，首日 10,000 份售出 → $1.2M 营收
- 每周 $25,000+ USDC 创作者奖励池（100% 订阅收入再分配）
- Frames：互动小程序，累计营收 $1.91M (2024 mid)
- **关键教训**：内容协议 + 创作者激励缺一不可；纯去中心化不够，需要好的客户端体验

### 小红书 (Xiaohongshu/RedNote) 核心竞争力分析

**数据规模：** 300M+ MAU · $3.7B 营收 · $500M 净利润 (2023)

**核心差异化：**
1. **"种草"文化** — 真实用户体验分享 → 购买决策（不是广告，是信任）
2. **图文 + 短视频并重** — 比 Instagram 更有深度，比 TikTok 更有信息量
3. **强个性化推荐** — TikTok-style 算法，但聚焦生活方式垂类
4. **搜索即社区** — 用户把小红书当搜索引擎用（"XXX 怎么做""XX 哪里买"）
5. **闭环电商** — 种草 → 买单在一个 App 内完成

**去中心化的难点：**
| 难点 | 挑战 |
|------|------|
| 推荐算法 | 需要用户数据集中训练，分散化后冷启动极难 |
| 图片/视频存储 | 每用户产生大量媒体内容，IPFS/Arweave 成本高 |
| 垃圾内容过滤 | 无中心化审核，spam/色情/欺诈内容难处理 |
| 搜索索引 | 全文搜索需要中心化索引服务 |
| 电商闭环 | 去中心化支付体验仍然很差 |

---

## 小黑书 — 产品定义

### 定位

> **小黑书 = 去中心化的生活方式社区，用户自主掌控内容、身份和收益**

**与小红书的差异：**
- 小红书：内容属于平台，创作者收益依赖平台规则
- 小黑书：内容属于用户（存储在 Nostr / IPFS），创作者直接从读者收益

**目标用户：**
1. **创作者**：不满平台限流、封号、抽成的内容创作者
2. **Web3 原住民**：想把生活方式内容和链上身份结合的用户
3. **隐私敏感用户**：不想被算法操控、不想数据被售卖的用户

---

## 技术架构：Spore Protocol 能做什么

### 完全能支持的能力 ✅

```
内容发布    → Nostr kind:1 (短文) / kind:30023 (长文)
图片存储    → IPFS / Arweave (链接存在 Nostr 事件中)
私信       → NIP-17 gift-wrap DMs (M1)
群组/社群   → NIP-29 groups (M6)
E2E 加密   → NIP-44 + MLS (M9) — 付费私密内容
身份       → AirAccount (一个 key = ETH + Nostr)
打赏/付费  → X402 Bridge (M2) — 直接向创作者付款
订阅制     → Channel Bridge (M2) — 链下微支付积累
内容 NFT   → UserOp Bridge (M2) — gasless 铸造
关注列表   → NIP-02 contact list
声誉系统   → SBT + HyperCapital (M8)
多端同步   → linkDevice (M8)
```

### 需要扩展的能力 🔜

```
图片/视频 Feed 格式  → 新 Nostr event kind (kind:20xxx 图文帖)
内容发现/推荐        → 去中心化推荐引擎 (见下)
全文搜索            → 本地 relay 索引 or 聚合搜索节点
话题标签            → NIP-12 hashtag events
算法 Feed           → 客户端本地权重计算
内容审核            → 社区投票 + stake slashing
```

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      小黑书 App (客户端)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Feed    │  │ 发帖/   │  │  私信   │  │  创作者中心   │  │
│  │  发现    │  │  图片上传│  │  群组   │  │  收益管理     │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │
└─────────┬────────────────────────────────────────┬──────────────┘
          │ @aastar/messaging                       │ HTTP Gateway (M10)
          │ SporeAgent                              │ (for web/mobile)
┌─────────▼─────────────────────────────────────────────────────┐
│                     Spore Protocol Layer                       │
│  NIP-17 DM · NIP-29 Groups · NIP-44 Encryption · X402 Pay    │
└─────────┬──────────────────────────────┬───────────────────────┘
          │ Nostr relay network           │ IPFS / Arweave
┌─────────▼──────────┐         ┌─────────▼──────────┐
│   Nostr Relays     │         │   媒体存储节点       │
│  (小黑书专属 +     │         │  (图片/视频 IPFS)   │
│   公共 relay)      │         └────────────────────┘
└────────────────────┘
```

---

## 核心功能设计

### 1. 内容帖 (Post) — 新 Nostr Event Kind

定义 `kind:20001`（小黑书图文帖）：

```json
{
  "kind": 20001,
  "content": "今天发现一家超好吃的咖啡馆，手冲耶加雪菲真的绝了 ☕",
  "tags": [
    ["title", "上海静安这家咖啡馆值得专程来"],
    ["image", "ipfs://QmXxx...", "640x480"],
    ["image", "ipfs://QmYyy...", "640x480"],
    ["t", "咖啡"],
    ["t", "上海"],
    ["t", "探店"],
    ["location", "31.2304,121.4737"],
    ["price", "38", "CNY"],
    ["r", "https://maps.apple.com/?q=..."]
  ]
}
```

内容类型通过 tag 区分：
- `t` — 话题标签
- `image` — IPFS/Arweave 图片链接
- `video` — 视频链接
- `location` — 地理位置
- `price` — 提到的价格（用于购物种草）

### 2. 内容发现 — 去中心化推荐

**阶段 1：基于关注图谱的 Feed（无算法，纯关注）**
```typescript
// 订阅所有关注用户的 kind:20001 帖子
agent.subscribeToFeed({
  authors: followingList,
  kinds: [20001],
  limit: 50,
})
```

**阶段 2：社区策展（Prism 模式）**
- 策展人整理优质内容 → 发布 `kind:30003` 策展列表
- 读者订阅策展人 → 获得精选内容 Feed
- 策展人通过 X402 Bridge 收取订阅费

**阶段 3：本地权重排序**
```typescript
// 客户端计算内容权重（不依赖中心化算法）
const score = (post) =>
  post.zaps * 10 +           // 收到的打赏金额
  post.reactions * 2 +        // 点赞/收藏数
  post.reposts * 5 +          // 转发数
  freshness(post.created_at)  // 时间衰减
```

**阶段 4：联邦推荐节点（长期）**
- 运营商运行推荐节点，暴露 `/api/recommend` 接口
- 节点用本地 embedding 模型计算相似度
- 节点质押 xPNTs，推荐质量差会被 slash
- 用户选择信任哪个推荐节点 → 完全透明

### 3. 图片存储

```typescript
// 上传流程
async function uploadImage(file: File): Promise<string> {
  // 1. 上传到 IPFS (via Pinata / web3.storage)
  const cid = await ipfsClient.add(file);

  // 2. 可选：同时 pin 到 Arweave (永久存储)
  await arweave.upload(file);

  // 3. 返回 ipfs:// URL 写入 Nostr 事件
  return `ipfs://${cid}`;
}
```

**媒体节点激励：**
- 运营商运行 IPFS Pinning 服务
- 向上传者收取 storage fee (kind:23405 `SPORE_KIND_STORAGE`)
- 用户也可以选择自己 pin（真正的内容所有权）

### 4. 创作者变现

```
┌─────────────────────────────────────────────────────────┐
│                   变现方式                               │
├──────────────┬───────────────────────────────────────────┤
│ 即时打赏     │ X402 Bridge — 读者直接打赏 USDC/ETH       │
│ 付费内容     │ Channel Bridge — 月订阅制，积累voucher     │
│ 内容 NFT    │ UserOp Bridge — gasless 铸造，一键发行     │
│ 品牌合作    │ 链上广告合同，自动结算 (M14 规划)           │
│ 社群门票    │ ERC-1155 通行证，持有即进入付费社群         │
└──────────────┴───────────────────────────────────────────┘
```

**实际代码示例（创作者发布付费内容）：**

```typescript
import { SporeAgent, X402Bridge } from '@aastar/messaging';

const agent = await SporeAgent.createFromEnv();

// 注册付费墙：读者发 0.5 USDC 才能看完整内容
agent.useX402Bridge({
  x402Client: myX402Client,
  requiredAmount: 500_000n,  // 0.5 USDC
  tokenAddress: USDC_ADDRESS,
  nonceStore: new FileNonceStore('./nonces.json'),
});

// 读者发消息请求内容
agent.on('text', async (ctx) => {
  // 到达这里说明付款已验证
  await ctx.sendText(fullContent); // 发送完整付费内容
});
```

### 5. 社群 (Community) — 付费私圈

```typescript
// 创建付费社群
const group = await agent.createGroup({
  topic: '🌟 Latte Art 精品咖啡圈',
  initialMembers: [],
});

// 开通订阅门槛：持有 NFT 通行证才能加入
await agent.setGroupGating({
  groupId: group.id,
  gatingType: 'nft',
  contractAddress: '0xPassNFT...',
  tokenId: 1n,
});
```

### 6. 身份 & 声誉

```typescript
// 创作者发布链上名片
await agent.publishProfile({
  name: '咖啡探店 Alice',
  about: '走遍上海每一家精品咖啡馆 ☕ | 已探 300+ 家',
  picture: 'ipfs://QmAvatar...',
  website: 'https://alice.coffee',
  // 自定义扩展字段
  extra: {
    specialties: ['精品咖啡', '手冲', '探店'],
    city: '上海',
    posts_count: '342',
  },
});
```

SBT 声誉积累：
- 每次发帖：+1
- 收到 zap ≥ 0.1 USDC：+5
- 粉丝增长 100：+10
- 内容被社区策展收录：+20

---

## MVP 路线图

### Phase 1 — MVP（3 个月）

**技术：** 基于现有 Spore Protocol M1-M13 直接构建

| 功能 | 基于哪个 Milestone | 工作量 |
|------|------------------|--------|
| 用户注册（AirAccount 一键） | M8 身份 | 1 周 |
| 发图文帖 (kind:20001) | M1 NostrTransport | 2 周 |
| IPFS 图片上传 | 新模块 | 1 周 |
| 关注/被关注 (NIP-02) | M1 | 1 周 |
| 关注 Feed | M5 Conversations API | 1 周 |
| 话题标签搜索 | 新模块 | 1 周 |
| 点赞/收藏 (kind:7 reaction) | M7 ReactionCodec | 3 天 |
| 打赏 (X402) | M2 X402Bridge | 1 周 |
| 私信 | M1 NIP-17 DM | 已有 |
| HTTP Gateway (web 端) | M10 SporeHttpGateway | 已有 |

**MVP 不做：** 推荐算法、视频、电商、DAO 治理

### Phase 2 — 增长（6 个月）

- 去中心化推荐节点（轻量本地 embedding）
- 付费社群（M6 Groups + Channel Bridge）
- 创作者 NFT 内容 (UserOp Bridge gasless 铸造)
- 移动端 App（React Native + HTTP Gateway）
- 社区策展（Prism 模式）

### Phase 3 — 协议化（12 个月）

- MushroomDAO 治理内容标准
- 跨平台互通（支持读取 Farcaster / Lens 内容）
- 推荐节点去中心化市场
- 链上广告协议
- OpenPNTs 忠诚度体系整合

---

## 与竞品的差异化定位

| 维度 | 小红书 | Farcaster | 小黑书 |
|------|-------|-----------|-------|
| 内容所有权 | 平台 | 用户（Farcaster Hub） | **用户（Nostr + IPFS）** |
| 变现 | 平台分成 30-50% | 协议费 + Pro 订阅 | **直接 100% 归创作者** |
| 身份 | 手机号绑定 | Farcaster ID | **EOA = ETH + Messaging 一体** |
| 推荐算法 | 中心化黑盒 | 客户端自选 | **开放推荐节点 + 本地计算** |
| 内容格式 | 图文 + 视频 | 短文 + Frames | **图文 + 视频 + 付费内容** |
| 电商 | 强（闭环） | 无 | **Frames 小程序 + 链上支付** |
| 隐私 | 数据归平台 | 公开 | **E2E 加密私信 + 付费私圈** |

---

## 立即可以开始的工作

Spore Protocol 当前已具备小黑书 60% 的底层能力。需要新增的核心模块：

```bash
# 1. 定义 kind:20001 图文帖格式 (1天)
packages/messaging/src/nostr/kinds/ImagePost.ts

# 2. IPFS 上传模块 (3天)
packages/messaging/src/storage/IpfsStorage.ts

# 3. Feed 聚合器 (1周)
packages/messaging/src/feed/FeedAggregator.ts

# 4. 话题标签索引 (3天)
packages/messaging/src/search/HashtagIndex.ts

# 5. 小黑书专属客户端 (独立 repo)
@aastar/xiaoheishu-app
```

**最快路径：** 用 Next.js + HTTP Gateway (M10) 做 web 版，1 个月出 demo。

---

## 风险与应对

| 风险 | 概率 | 应对策略 |
|------|------|---------|
| 内容发现差（冷启动） | 高 | 先做垂直社区（如咖啡、穿搭），人工运营初期 feed |
| IPFS 存储成本高 | 中 | 支持多种存储后端；创作者自选付费存储方案 |
| 垃圾内容泛滥 | 高 | 社区投票 + stake slashing；可选中心化 relay 辅助过滤 |
| 用户习惯 Web3 门槛高 | 高 | AirAccount 抽象密钥；支持 email 登录 → 后台 EOA |
| 监管风险（内容审核） | 中 | 客户端过滤 + 可选合规 relay 模式 |

---

## 结论：Spore Protocol 适合做小黑书吗？

**完全适合，而且有竞争优势：**

1. **NIP-17 E2E 加密私信** — 竞品没有内置的真正隐私私信
2. **X402 原生支付** — 打赏/付费内容无需第三方支付接入
3. **AirAccount 身份** — 一个 key 跨以太坊和消息体系，比 XMTP 和 Farcaster 更简洁
4. **多传输层（M13）** — Nostr + Waku 并行，比单一协议更抗审查
5. **SuperPaymaster** — 对用户完全 gasless，解决 Web3 最大使用障碍

**Farcaster 的成功已证明了这个方向**：Pro 订阅首日 $1.2M，说明用户愿意为去中心化内容网络付费。小黑书的图文种草文化 + Spore 的支付原语 = 非常自然的组合。

**建议代号：** `Project Mycelium-Red` → 内部开发代号
**对外品牌：** 小黑书 (XiaoHeiShu) — 寓意打破小红书的内容围墙，黑色代表独立与隐秘
