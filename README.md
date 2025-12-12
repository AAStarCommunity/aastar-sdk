# AAStar SDK

完成以下目标：
1. 基于测试文档完成测试计划
2. 配合测试计划，完成SDK 0.15版开发和发布NPM包
3. 默认安装aastar包，会自动安装airaccount、superpaymaster、cometens、openpnts、opencards、arcadia、cos72包
4. 也可以单独安装airaccount、superpaymaster、cometens、openpnts、opencards、arcadia、cos72包
```
pnpm install @aastar/airaccount
@aastar/superpaymaster
@aastar/cometens
@aastar/openpnts
@aastar/opencards
@aastar/arcadia
@aastar/cos72
```

## 一些规划
0.12目标是完成基础的aastar sdk的架构和目录，发布一个版本，实现基础的superpaymaster基础流程，并配合论文，完成对应的测试，包括测试网和主网。
1. npm install aasstar,希望是安装sdk包，期望会自动安装airaccount、superpaymaster、cometens、openpnts、opencards、arcadia、cos72包，那应该sdk下包括了这几个目录？。
2. 也可以单独安装npm install aasstar/airaccount或者superpaymaster、cometens、openpnts、opencards、arcadia、cos72包。
3. 还有core，是所有子包的公共依赖，应该在sdk下包括了core目录。
4. 而所有的ABI、合约地址、合约名字，在shared-config包（这个已经发布）了。

开发计划0.12
1. 基于viem为基础，完成二次开发，希望继承用户viem习惯，尽力开箱即用。
2. 安装后需要完成一些基础的配置，包括RPC、Bundler RPC等，通过环境变量env。
3. core模块完成GToken Sale合约交易，Registry和MySBT的社区注册、xPNTsFactory的xPNTs（gas token）发行，基于x402,访问并提供你要支付的USDT、ETH、USDC等接受token，获得GToken。
4. superpaymaster包要完成一个基础流程，包括一个基础AA账户准备（通过测试网后台某个社区Operator空投MySBT、bPNTs），持有完成两次交易：breadCommunity的独立部署的Paymasterv4.1无gas交易，和SuperPamasterV3的两次交易后，社区Operator会空投一个GasCard给账户。提供viem方式的交易发起和交易状态返回等。
5. airaccount包类似，完成一个基础流程，包括创建账户，绑定指纹，发起简单交易，签名验证，gasless交易等。
6. cometens提供ens名字的绑定和查询，以及ens名字的注册和续费等，super用户提供定制ENS的去中心化服务节点支持和管理界面。
7. openpnts完成自己社区的经济模型建立，需要社区审核流程，以行业平均水平为参考，提供三种模式的积分发行：消费返还积分、预充值积分、任务积分。所有积分一个token，并且有严格时效性和实时信用，以及行业周期稳定性和社区信用背书。
8. opencards，发行自己的加油卡，以及社区NFT和社区积分升级体系，和MySBT reputation外部合约绑定。
-----------
以上是基建层面，给开发者和有开发力量的社区提供的底层SDK，可以基于开源链上合约交互，构建自己的社区应用。
以下是应用层，为社区提供公共物品和服务，可以基于底层应用构建自己的社区应用。
9.  Arcadia，社区游戏，可以加入OpenCity，建立自己的链上shop和社区互动。
10. MyTasks，社区任务系统，可以加入OpenCity，建立自己的链上任务系统。
11. MyShops，社区商店系统，可以加入OpenCity，建立自己的链上商店系统。
12. COS72,集成了1-11,并额外提供Park服务（公共物品花园），为社区和社区成员提供一些列的拥有自身数字未来的数字工具。
13. Park（Public Goods Garden）服务，是一个面向所有开源开发者和Vibe Coding创作者提供的可持续工具，构建你自己的经济循环。同时也是一个为构建数字未来的公共物品实验，基于可退票的门票机制，维护整体机制的可持续。
14. 几乎你能想到的问题和困难，都可以提出来，小到一个开源的Chrome英文词典插件，达到重构价值定义和分配关系，我们都在实验和探索，期待你的加入。
15. 人类的核心是想象力、创造力和情感，在财富极化、AI加速的现代，如何在多样性涌现出我们期待的数字未来？一定是开放心态的探索和共创。

--------------------
