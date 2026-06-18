1. @aastar/sdk/airaccount 改名为kms
修改对应的引起的变化和该修改的关联,如果依赖他的需要就修改一下

2. 为何有ethers这个依赖？我希望去掉这个依赖，只依赖viem，帮我分析一下，看改动工程量多大，把这个依赖ethers去掉？

3. 我记得viem有所有主要链的chainid，为何不使用？大多人记不住sepolia chainid，或者其他的，你优化下：
import { createEndUserClient, CANONICAL_ADDRESSES } from '@aastar/sdk';
import { sepolia, optimism } from 'viem/chains';
import { http } from 'viem';

// Sepolia testnet
const test = createEndUserClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL),
  addresses: CANONICAL_ADDRESSES[11155111],
});

CANONICAL_ADDRESSES[SEPOLIA_CHAIN_ID],或者其他的合适的方式就是不用不用别人记忆

4. 更新这些链接（仓库）

Docs Home: https://docs.aastar.io/
aastar-docs: https://github.com/AAStarCommunity/aastar-docs
这个仓库在aastar/docs.aastar.io/目录下，历史的文档，我希望你备份到，比如说按版本区分的目录下，你去借鉴一下常熟的文档题，它肯定是有版本的。那这个版本呢不一定是呃特别连续，但至少比如说v1v2v3。那之前呢我们算v2好了，或者是v0.2，或者跟sdk的版本去对应都可以。那之前呢，我希望你给我备份为，比如说是零点一四点六吗？忘记了，当你给我备份到这个版本下，而这个最新的版本呢呃就默认进来就是最新的版本。但当有其他版本替替代，它它成为旧版本的时候呢呃它那个版本目录下也就自动显示它自己的这个版本对应的文档了，啊，就是最新版本呃，使用默认url呃，当我们打上版本号的时候，就进入对应的版本
下面这些都是子目录：
API Reference: https://docs.aastar.io/api/
Examples: https://docs.aastar.io/examples/
其中，examples，我想用@aastar/sdk/dapp为基础，开发三个最简单的例子：

1. 已有网站嵌入我们的sdk能力（airaccount，superpaymaster，kms），可以email注册用户获得账户地址，可以初步管理自己账户（极度简单版本的YAA）
2. 直接生成一个网站，就具备上述能力，页面是可以用模板替换，基于市面成熟方案
3. 其他的请基于官方的YAA来修改
4. 后续会针对不同feature，推出不同的examples，但不会在sdk目录下了，而是独立的examples仓库

Deployments: https://docs.aastar.io/guide/deployments/verify.sepolia.contracts
部署同样也是按版本，因为现在的部署实际上就一个版本默认就显示了页面了。但后面我们会有不同的版本，甚至每个版本下有不同的链。然后呢，有一些部署呢，就是主网啊，就是有就会有用户啊，有开发者。那我们有新的出来之后，有的用户无无迁移的。所以对应的的这些部署要改进文默认是最新版，但是呢要改进文就档在一个版本号下边；
例如我现在是零点二零点三啊，那之前的就嗯这个假设被被份为零点一四点一八，那当前的文档就可以从https://docs.aastar.io/guide/deployments/0.14.18来访问，历史文档不可以丢，因为后续越来越多的用户，可能你也不知道他在哪个版版本活动；

以上这些你给我一个计划安排。对，有的可能他不是一个修复的问题，他可能要去。比如说另外一个仓库的目录下工作，有的呢需要备份。对，有的呢需要比如说开一个新的仓库，叫一个temple example，是所有一个ample的全集。对，但是呢sdk默认至少建建立这两个最基础的啊这个范例就是第一个和第二个对



