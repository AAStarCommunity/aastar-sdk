# Technical Plan: SuperPaymaster & AAStar SDK Experiment

Based on the analysis of `projects/SuperPaymaster/scripts/gasless-test/test-gasless-viem-v2-final.js`, here is the detailed technical plan for implementing the SDK and the 3-category account experiment.

## 1. Paymaster Data Structure (SuperPaymaster V3/V4)
Unlike generic Paymasters, SuperPaymaster V3 uses a specific packed format for `paymasterAndData` to optimize for gas and community attribution.

**Format (72 bytes):**
1.  **Paymaster Address** (20 bytes)
2.  **Verification Gas Limit** (16 bytes, uint128) - Default 160k (Safe buffer over 120k actual)
3.  **PostOp Gas Limit** (16 bytes, uint128) - Default 10k
4.  **Operator Address** (20 bytes) - *The Community Node sponsoring the tx*

**Verification Logic:**
*   **On-chain**: Checks if `sender` holds `MySBT` (Soulbound Token) and has sufficient `xPNTs` (Gas Token) balance.
*   **Off-chain**: No HTTP signature required. Purely asset-based validation.

## 2. Experiment Groups & Setup

### Group A: Traditional EOA (Baseline)
*   **Identity**: `PRIVATE_KEY` (Account A) from `.env`.
*   **Mechanism**: Standard `eth_sendTransaction`.
*   **Setup**: Needs ETH for gas.

### Group B: Standard AA (Control)
*   **Identity**: `OWNER_PRIVATE_KEY` (Account B) controlling a Smart Account.
*   **Mechanism**: ERC-4337 UserOp.
*   **Paymaster**: Third-party Provider (e.g., Alchemy Gas Manager) or Bundler's native paymaster.
*   **Setup**: Needs a Policy ID or Paymaster RPC URL.

### Group C: SuperPaymaster AA (Treatment)
*   **Identity**: `OWNER2_PRIVATE_KEY` (Account C) controlling a Smart Account.
*   **Mechanism**: ERC-4337 UserOp with `SuperPaymaster`.
*   **Setup (Pre-requisites)**:
    1.  **Mint MySBT**: Account must own a generic or community-specific SBT.
    2.  **Token Balance**: Account must hold enough `xPNTs` (or `GTOKEN`) to cover the "Gas Credit".
*   **Flow**:
    1.  SDK constructs `paymasterAndData` with `OPERATOR` address.
    2.  SDK Estimates gas (Optimized: Verification 160k, PostOp 10k).
    3.  SDK Signs & Submits.

## 3. Implementation Roadmap

### Phase 1: SDK Update (`packages/superpaymaster`)
*   **Completed**: Implemented `getPaymasterMiddleware` taking `operatorAddress`.
*   **Completed**: Implemented V3 Packing Logic (`concat([pm, verGas, postOpGas, op])`).
*   **Completed**: Implemented `checkEligibility` helper.

### Phase 2: Experiment Script (`run_experiment_data.ts`)
*   **Initialization**: Load Keys from `.env` (using global `@env/.env`).
*   **Pre-Flight Check**:
    *   Check Group C eligibility.
    *   **Auto-Mint**: Logic inspired by `mint-sbt-for-aa.js`.
*   **Execution Loop (30 Runs)**:
    *   **Group A**: `walletClient.sendTransaction`.
    *   **Group B**: `smartAccountClient.sendUserOperation` (using Alchemy Provider).
    *   **Group C**: `smartAccountClient.sendUserOperation` (using SuperPaymaster Middleware).
*   **Data Recording**: Capture `receipt.gasUsed`, `effectiveGasPrice`.

## 4. Key Configuration (from `.env`)
```bash
# Identities
PRIVATE_KEY=...       # EOA / Deployer
OWNER_PRIVATE_KEY=... # Standard AA Owner
OWNER2_PRIVATE_KEY=...# SuperPaymaster AA Owner

# Contracts (Sepolia)
SUPER_PAYMASTER_ADDRESS=0x34671Bf95159bbDAb12Ac1DA8dbdfEc5D5dC1c24
MYSBT_ADDRESS=0xD1e6BDfb907EacD26FF69a40BBFF9278b1E7Cf5C
GAS_TOKEN_ADDRESS=0xfb56CB85C9a214328789D3C92a496d6AA185e3d3
OPERATOR_ADDRESS=0x411BD567E46C0781248dbB6a9211891C032885e5
```

## 5. Account Preparation Strategy

| Group | Identity (Key) | Mechanism | Preparation & Requirements | Transaction Execution |
| :--- | :--- | :--- | :--- | :--- |
| **A: Traditional EOA** | `PRIVATE_KEY` | `eth_sendTx` | **Needs ETH**: Transfer Sepolia ETH from Faucet or Deployer. | `walletClient.sendTransaction` |
| **B: Standard AA** | `OWNER_PRIVATE_KEY` | ERC-4337 | **Needs ETH/Paymaster**: Needs ETH (if self-pay) or Paymaster Policy (if sponsored). | `smartAccountClient.sendUserOperation` (Generic) |
| **C: SuperPaymaster** | `OWNER2_PRIVATE_KEY` | ERC-4337 | **Needs MySBT + xPNTs**: <br>1. **Mint SBT**: Must own a Soulbound Token.<br>2. **Fund xPNTs**: Must have gas token balance.<br>*SDK `checkEligibility` verifies this.* | `smartAccountClient.sendUserOperation` <br> (with `getPaymasterMiddleware`) |



## Inite Test Account and Asset/Data

•开发环境: Node.js, npm/yarn。
•基础包: 安装 @account-abstraction/sdk (或选择其他 SDK)。
•私钥: 一个用于充当智能合约账户 拥有者 (Owner) 的 EOA 钱包私钥。
•Sepolia ETH: 确保您的 EOA 拥有者地址和/或预计算的智能账户地址中有足够的 Sepolia ETH (除非您使用 Paymaster 赞助 Gas 费)。
•SimpleAccountFactory: 0x9406Cc6185a346906296840746125a0e44976454


import { SimpleAccountAPI } from "@account-abstraction/sdk";
import { Wallet, providers } from "ethers";// 1. 配置 const OWNER_KEY = "YOUR_EOA_PRIVATE_KEY"; // 您的 EOA 私钥 const RPC_URL = "YOUR_SEPOLIA_BUNDLER_RPC_URL"; // 最好使用 Bundler 提供的 RPC const ENTRYPOINT_ADDRESS = "0x5FF137D4B0FDCD49DcA30c7CF57E578a026d2789"; const FACTORY_ADDRESS = "0x9406Cc6185a346906296840746125a0e44976454";// 2. 初始化 const provider = new providers.JsonRpcProvider(RPC_URL); const owner = new Wallet(OWNER_KEY, provider);const accountApi = new SimpleAccountAPI({ provider, entryPointAddress: ENTRYPOINT_ADDRESS, owner, factoryAddress: FACTORY_ADDRESS, });// 3. 预计算地址 (可选) const accountAddress = await accountApi.getCounterFactualAddress(); console.log(Smart Account Address: ${accountAddress});// 4. 发送首笔交易 (如果账户未部署，将自动部署) async function sendFirstUserOp() { // 构造 UserOperation 的交易部分 (例如: 发送 0.01 ETH 给自己) const tx = { target: accountAddress, // 目标地址 data: "0x", // 交易数据 value: providers.utils.parseEther("0.01"), // 交易金额 };
 创建 UserOperation const userOp = await accountApi.createSignedUserOp(tx);// 提交给 Bundler const userOpHash = await provider.send( "eth_sendUserOperation", [userOp, ENTRYPOINT_ADDRESS] );console.log(UserOperation Hash: ${userOpHash}); // 随后可以使用 eth_getUserOperationReceipt 等方法追踪状态 }sendFirstUserOp();

 要实现真正的 Gasless (无 Gas 费) 创建和交易，您需要在初始化 SimpleAccountAPI 或构造 UserOperation 时加入 Paymaster 参数。大多数 SDK 都提供了 Paymaster 的集成选项，您只需将 Bundler RPC 切换为支持 Paymaster 的服务商（例如 Alchemy、Stackup、Pimlico）的端点即可实现 Gas 赞助。

基于Viem实现生成测试账户：
```javascript
import { createPublicClient, http, encodeFunctionData, getContractAddress, concat, numberToHex, zeroAddress } from 'viem'
import { sepolia } from 'viem/chains'

// 1. 配置常量 (使用 v0.6 版本)
const FACTORY_ADDRESS = '0x9406Cc6185a346906296840746125a0e44976454'; // 你提供的 v0.6 Factory
const ENTRY_POINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

// 你的 EOA 私钥对应的公钥地址 (作为新 AA 账户的 owner)
const OWNER_ADDRESS = '0xYourEOAWalletAddressHere...'; 
const SALT = 0n; // 盐值，改变它可以生成不同的地址

// SimpleAccountFactory 的 ABI 片段
const factoryAbi = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "salt", type: "uint256" }
    ],
    name: "createAccount",
    outputs: [{ name: "ret", type: "address" }],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;

async function main() {
  const client = createPublicClient({
    chain: sepolia,
    transport: http(), // 默认使用公共节点，建议替换为 Alchemy/Infura
  });

  console.log("--- 生成 ERC-4337 v0.6 SimpleAccount ---");

  // 2. 生成 initCode
  // initCode = Factory地址 + 编码后的函数调用数据
  const factoryData = encodeFunctionData({
    abi: factoryAbi,
    functionName: 'createAccount',
    args: [OWNER_ADDRESS, SALT]
  });

  const initCode = concat([FACTORY_ADDRESS, factoryData]);
  console.log(`InitCode: ${initCode}`);

  // 3. 预计算 Counterfactual Address (未部署也能知道地址)
  // SimpleAccountFactory 使用 CREATE2。
  // 注意：手动计算 CREATE2 比较麻烦，需要知道 Factory 内部具体的 Bytecode 逻辑。
  // 更简单的方法是使用 client.readContract 模拟调用，或者利用 EntryPoint 的 getSenderAddress 报错机制。
  
  // 这里演示最简单的：通过 EntryPoint 的 getSenderAddress 方法获取
  // 这种方法虽然看起来像是在“报错”，但这是 ERC-4337 标准获取地址的方式
  try {
    const entryPointAbi = [{
      inputs: [{ name: "initCode", type: "bytes" }],
      name: "getSenderAddress",
      outputs: [],
      stateMutability: "nonpayable", // 注意这里通常是 revert
      type: "function"
    }] as const;

    await client.simulateContract({
      address: ENTRY_POINT_ADDRESS,
      abi: entryPointAbi,
      functionName: 'getSenderAddress',
      args: [initCode],
    });
  } catch (error: any) {
    // EntryPoint 会 revert 并携带 SenderAddress
    // 我们需要解析这个 revert error
    const senderAddress = extractAddressFromError(error);
    if (senderAddress) {
        console.log(`\n🎉 你的 AA 钱包地址是: ${senderAddress}`);
        console.log(`你可以往这个地址转入 Sepolia ETH，然后在第一笔 UserOp 中带上 initCode 即可自动部署。`);
    } else {
        console.error("无法解析地址，请检查 RPC 节点是否支持 debug", error);
    }
  }
}

// 辅助函数：从 Revert Error 中提取地址
// 不同 RPC 返回的错误格式可能不同，这里是通用逻辑
function extractAddressFromError(error: any): string | null {
    const message = error.details || error.message || "";
    // 匹配 0x 开头的 40 位 hex 字符串
    const match = message.match(/0x[a-fA-F0-9]{40}/); 
    // 或者专门解析 SenderAddressResult 错误 (0xe90b7b15)
    return match ? match[0] : null;
}

main();
```



```javascript
import { 
  createPublicClient, 
  http, 
  encodeFunctionData, 
  concat, 
  Hex, 
  pad, 
  keccak256, 
  toBytes,
  encodeAbiParameters,
  parseAbiParameters,
  createWalletClient
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

// --- 1. 配置常量 (v0.7 标准) ---
// 官方 EntryPoint v0.7
const ENTRY_POINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
// 官方 SimpleAccountFactory v0.7
const FACTORY_ADDRESS = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985';

// 替换为你的 Bundler RPC (这里必须是 Bundler 节点，不能是普通节点)
// 可以在 Pimlico 或 Alchemy 申请免费的测试网 Key
const BUNDLER_RPC = 'https://api.pimlico.io/v2/sepolia/rpc?apikey=YOUR_API_KEY'; 

// 你的 EOA 私钥 (Owner)
const PRIVATE_KEY = '0xYOUR_PRIVATE_KEY_HERE'; 

const account = privateKeyToAccount(PRIVATE_KEY as Hex);

// --- ABIs ---
const factoryAbi = [
  { inputs: [{ name: "owner", type: "address" }, { name: "salt", type: "uint256" }], name: "createAccount", outputs: [{ name: "ret", type: "address" }],stateMutability: "nonpayable", type: "function" }
] as const;

const accountAbi = [
  { inputs: [{ name: "dest", type: "address" }, { name: "value", type: "uint256" }, { name: "func", type: "bytes" }], name: "execute", outputs: [], stateMutability: "nonpayable", type: "function" }
] as const;

async function main() {
  console.log("🚀 开始构建 UserOp (v0.7)...");

  // 初始化 Bundler Client (本质上就是一个特定 RPC 的 PublicClient)
  const client = createPublicClient({
    chain: sepolia,
    transport: http(BUNDLER_RPC)
  });

  // 1. 计算 Sender 地址 (AA 钱包地址)
  // v0.7 Factory 使用 createAccount(owner, salt)
  const salt = 0n;
  const factoryData = encodeFunctionData({
    abi: factoryAbi,
    functionName: 'createAccount',
    args: [account.address, salt]
  });
  // 如果是第一次使用，需要提供 factory + factoryData；如果已部署，则为空
  // 这里为了演示，假设是第一次，始终携带 initCode
  const initCode = concat([FACTORY_ADDRESS, factoryData]);

  // 利用 EntryPoint 的 getSenderAddress 获取地址 (会 Revert)
  let senderAddress: Hex;
  try {
    await client.simulateContract({
      address: ENTRY_POINT_ADDRESS,
      abi: [{ inputs: [{ name: "initCode", type: "bytes" }], name: "getSenderAddress", outputs: [], stateMutability: "nonpayable", type: "function" }] as const,
      functionName: 'getSenderAddress',
      args: [initCode]
    });
    senderAddress = "0x" // 理论上不会走到这里
  } catch (err: any) {
    // 解析 Revert Error 获取地址
    const msg = err.details || err.message;
    const match = msg.match(/0x[a-fA-F0-9]{40}/);
    if (!match) throw new Error("无法获取 Sender 地址");
    senderAddress = match[0];
  }
  console.log(`📝 AA 钱包地址: ${senderAddress}`);

  // ⚠️ 检查：你的 AA 钱包里必须有 ETH 支付 Gas
  const balance = await client.getBalance({ address: senderAddress });
  console.log(`💰 当前余额: ${balance.toString()} wei`);
  if (balance === 0n) {
    console.error("❌ 余额不足！请先往 AA 地址转入 Sepolia ETH");
    return;
  }

  // 2. 构建 CallData (你想让 AA 做什么)
  // 例子：给自己转 0 ETH (或者转给其他人)
  const callData = encodeFunctionData({
    abi: accountAbi,
    functionName: 'execute',
    args: [account.address, 0n, "0x"] // 目标地址，金额，数据
  });

  // 3. 获取 Nonce
  // v0.7 中 Nonce 是一个 uint256，高 192 位是 Key，低 64 位是 Sequence
  // 这里使用简单版：读取 EntryPoint 的 getNonce
  const nonce = await client.readContract({
    address: ENTRY_POINT_ADDRESS,
    abi: [{ inputs: [{ name: "sender", type: "address" }, { name: "key", type: "uint192" }], name: "getNonce", outputs: [{ name: "nonce", type: "uint256" }], stateMutability: "view", type: "function" }] as const,
    functionName: 'getNonce',
    args: [senderAddress, 0n]
  });

  // 4. 组装部分 PackedUserOp
  // 注意：Gas 限制通常通过 eth_estimateUserOperationGas 获取
  // 这里我们先填一些占位符，然后请求 Bundler 估算
  const partialUserOp = {
    sender: senderAddress,
    nonce: nonce,
    initCode: nonce === 0n ? initCode : "0x", // 只有第一次交易需要 initCode
    callData: callData,
    accountGasLimits: "0x", // 稍后填
    preVerificationGas: 0n, // 稍后填
    gasFees: "0x",          // 稍后填
    paymasterAndData: "0x", // 自己付钱，无 Paymaster
    signature: "0x"         // 稍后签名
  };

  // 5. 请求 Bundler 估算 Gas
  // 注意：不同 Bundler 的返回值格式可能略有不同，这里使用标准 JSON-RPC 格式
  // Viem 的 request 方法可以直接发原始 RPC
  const gasEstimate: any = await client.request({
    method: 'eth_estimateUserOperationGas' as any,
    params: [
        {
            ...partialUserOp,
            initCode: partialUserOp.initCode,
            callData: partialUserOp.callData,
            paymasterAndData: "0x",
            signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c" // 假签名用于估算
        }, 
        ENTRY_POINT_ADDRESS
    ]
  });

  // 提取 Gas 参数 (v0.7 采用了 packed 格式)
  // verificationGasLimit (16 bytes) | callGasLimit (16 bytes)
  const verificationGasLimit = BigInt(gasEstimate.verificationGasLimit ?? gasEstimate.verificationGas ?? 100000n);
  const callGasLimit = BigInt(gasEstimate.callGasLimit ?? 100000n);
  const accountGasLimits = concat([
    pad(toBytes(verificationGasLimit), { size: 16 }),
    pad(toBytes(callGasLimit), { size: 16 })
  ]);
  
  const preVerificationGas = BigInt(gasEstimate.preVerificationGas ?? 50000n);

  // 获取当前费率
  const block = await client.getBlock();
  const maxPriorityFeePerGas = await client.request({ method: 'eth_maxPriorityFeePerGas' as any });
  const maxFeePerGas = block.baseFeePerGas! * 2n + BigInt(maxPriorityFeePerGas);
  
  // maxPriorityFeePerGas (16 bytes) | maxFeePerGas (16 bytes)
  const gasFees = concat([
    pad(toBytes(BigInt(maxPriorityFeePerGas)), { size: 16 }),
    pad(toBytes(maxFeePerGas), { size: 16 })
  ]);

  // 6. 最终组装 PackedUserOp
  const userOp = {
    sender: senderAddress,
    nonce: nonce,
    initCode: partialUserOp.initCode,
    callData: callData,
    accountGasLimits: accountGasLimits,
    preVerificationGas: preVerificationGas,
    gasFees: gasFees,
    paymasterAndData: "0x" as Hex,
    signature: "0x" as Hex
  };

  // 7. 计算 UserOp Hash 并签名
  // 需要按照 ERC-4337 v0.7 规范进行 Hash
  const userOpHash = await client.readContract({
    address: ENTRY_POINT_ADDRESS,
    abi: [{ inputs: [{ components: [{name:"sender",type:"address"},{name:"nonce",type:"uint256"},{name:"initCode",type:"bytes"},{name:"callData",type:"bytes"},{name:"accountGasLimits",type:"bytes32"},{name:"preVerificationGas",type:"uint256"},{name:"gasFees",type:"bytes32"},{name:"paymasterAndData",type:"bytes"},{name:"signature",type:"bytes"}], name: "userOp", type: "tuple" }], name: "getUserOpHash", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" }] as const,
    functionName: 'getUserOpHash',
    args: [userOp]
  });

  console.log(`🔑 UserOp Hash: ${userOpHash}`);
  
  // Owner 签名
  const signature = await account.signMessage({
    message: { raw: userOpHash }
  });
  
  // 将签名填回 UserOp
  userOp.signature = signature;

  // 8. 发送 UserOp 到 Bundler
  console.log("📨 正在发送 UserOp...");
  const userOpHashRes = await client.request({
    method: 'eth_sendUserOperation' as any,
    params: [userOp, ENTRY_POINT_ADDRESS]
  });

  console.log(`✅ 发送成功! UserOp Hash: ${userOpHashRes}`);
  console.log(`🔗 查看链接: https://jiffyscan.xyz/userOpHash/${userOpHashRes}?network=sepolia`);
}

main().catch(console.error);

```

代码原理解析
createAccount (InitCode):

在 v0.7 中，工厂方法签名依然是 createAccount。

如果 initCode 不为空，EntryPoint 会先执行这个代码来部署合约，然后再执行后续的 execute。这就是为什么你不需要单独去部署合约，使用即部署。

UserOp 打包 (Packing):

请注意代码中的 accountGasLimits 和 gasFees。在 v0.6 中，这些都是独立的 uint256 字段。

在 v0.7 中，为了节省 CallData 的 Gas 费用，它们被压缩成了 bytes32 (两个 uint128 拼接)。这是 v0.7 最显著的代码层面变化。

签名流程:

getUserOpHash 是在链下完成的（虽然我用了 readContract 调用 EntryPoint 里的纯函数，这样最准确）。

拿到 Hash 后，EOA (Owner) 进行 ECDSA 签名。

SimpleAccount 的合约逻辑就是：校验签名(UserOpHash, Signature) == Owner。

Bundler:

最后一步 eth_sendUserOperation 不是发给普通的以太坊节点，而是发给 Bundler。Bundler 会把它打包成一笔以太坊交易 (handleOps) 上链。

你的下一步
把 BUNDLER_RPC 换成你申请到的 API (推荐 Pimlico 或 Alchemy)。

运行代码拿到 AA 钱包地址。

往这个地址转 0.01 Sepolia ETH。

再次运行代码，你应该能看到 发送成功 并在 Jiffyscan 上查到这笔 UserOp。

------

npx tsx scripts/deploy_test_accounts.ts
[dotenv@17.2.3] injecting env (18) from ../env/.env.v3 -- tip: 🗂️ backup and recover secrets: https://dotenvx.com/ops
Using RPC: https://eth-sepolia.g.alchemy.com/v2/Bx4W1-vUePAAD7N
Owner: 0xb5600060e6de5E11D3636731964218E53caadf0E

--------------------------------------------
🚀 Processing Baseline (A) [Salt 0]
--------------------------------------------
📝 Address: 0xECD9C07f648B09CFb78906302822Ec52Ab87dd70
   Deployed: ❌ NO
   Balance: 0.07 ETH
   🛠  Constructing UserOp...
      ⚠️ Estimation failed, using fallback (Unpacked Fields)...
   🔑 Hash: 0xe109d637d5788faa3a56ac82c33dd63de744ab0b624b8f215f89c264bc687a87
   📨 Sending (Fallback Unpacked)...
   ✅ Sent! https://jiffyscan.xyz/userOpHash/0xe109d637d5788faa3a56ac82c33dd63de744ab0b624b8f215f89c264bc687a87?network=sepolia

--------------------------------------------
🚀 Processing Standard (B) [Salt 1]
--------------------------------------------
📝 Address: 0x179Faf25600c01DBFcEf7971f15DcFa3FbE5d31C
   Deployed: ❌ NO
   Balance: 0.07 ETH
   🛠  Constructing UserOp...
      ⚠️ Estimation failed, using fallback (Unpacked Fields)...
   🔑 Hash: 0xf096878c6389d56d71450e00e5149ff943f012fb3e6fdd2eb1e4d7a61588ff06
   📨 Sending (Fallback Unpacked)...
   ✅ Sent! https://jiffyscan.xyz/userOpHash/0xf096878c6389d56d71450e00e5149ff943f012fb3e6fdd2eb1e4d7a61588ff06?network=sepolia

--------------------------------------------
🚀 Processing SuperPaymaster (C) [Salt 2]
--------------------------------------------
📝 Address: 0xb78ef5C8DD059ABa48b65c8069641f30BBf0A1ED
   Deployed: ❌ NO
   Balance: 0.07 ETH
   🛠  Constructing UserOp...
      ⚠️ Estimation failed, using fallback (Unpacked Fields)...
   🔑 Hash: 0xd82fea49a60b4f8c1ced70192a4f43965b6f5b35ea9c343805977c55fa538497
   📨 Sending (Fallback Unpacked)...
   ✅ Sent! https://jiffyscan.xyz/userOpHash/0xd82fea49a60b4f8c1ced70192a4f43965b6f5b35ea9c343805977c55fa538497?network=sepolia
(base) XBOX at ~/Dev/mycelium/my-exploration/projects/aastar-sdk ±(main) ✗ ❯                                     ruby-3.3.2

---------

$ npx tsx scripts/deploy_test_accounts.ts
[dotenv@17.2.3] injecting env (18) from ../env/.env.v3 -- tip: 🔐 prevent building .env in docker: https://dotenvx.com/prebuild
Using RPC: https://eth-sepolia.g.alchemy.com/v2/Bx41-vnwAAD7N
Owner: 0xb5600060e6de5E11D3636731964218E53caadf0E

--------------------------------------------
🚀 Processing Baseline (A) [Salt 0]
--------------------------------------------
📝 Address: 0xECD9C07f648B09CFb78906302822Ec52Ab87dd70
   Deployed: ✅ YES
   Balance: 0.0596 ETH
   ✅ Already deployed. Skipping.

--------------------------------------------
🚀 Processing Standard (B) [Salt 1]
--------------------------------------------
📝 Address: 0x179Faf25600c01DBFcEf7971f15DcFa3FbE5d31C
   Deployed: ✅ YES
   Balance: 0.0596 ETH
   ✅ Already deployed. Skipping.

--------------------------------------------
🚀 Processing SuperPaymaster (C) [Salt 2]
--------------------------------------------
📝 Address: 0xb78ef5C8DD059ABa48b65c8069641f30BBf0A1ED
   Deployed: ✅ YES
   Balance: 0.0596 ETH
   ✅ Already deployed. Skipping.
