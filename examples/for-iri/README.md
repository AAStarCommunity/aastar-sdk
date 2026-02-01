# AAstar SDK Integration Examples (for IRI) / AAstar SDK 集成示例 (IRI 专用)

[English](#english) | [中文说明](#chinese)

---

<a name="english"></a>
## 🇬🇧 English

This directory contains standalone examples demonstrating how to integrate with the AAstar SDK. 
These examples are designed to be copied into your own project and adapted as needed.

### Directory Structure

- `ts/`: TypeScript examples (Recommended)
- `js/`: JavaScript examples (ESM)

### Scenarios Covered

1.  **Operator Setup (`1-operator-setup`)**
    -   Funding the Operator account (ETH + Tokens) using Faucet API.
    -   Registering as a SuperPaymaster Operator.
    -   Configuring the Operator Node.

2.  **Community & User Registration (`2-community-setup`)**
    -   Creating a new Community (DAO) with one click.
    -   Registering an End User into the Community (Eligibility + Onboarding).

3.  **Information Query (`3-query-info`)**
    -   Checking User Roles (Community Leader, Operator, SuperPaymaster).
    -   Checking Token Balances (GToken).

4.  **Gasless Transaction (`4-gasless-tx`)**
    -   **Scenario**: Bob (User) sends community tokens to Alice without paying ETH gas.
    -   Demonstrates `UserLifecycle.executeGaslessTx` and high-level Gasless APIs.

5.  **Complete L3 Lifecycle (`l3-lifecycle-demo.ts`)**
    -   **AIO Demo**: Runs the entire protocol lifecycle in one script.
    -   Community Launch -> Operator Setup -> User Onboard -> Gasless Tx -> Exit.

### How to use

1.  **Choose your language**: Go to `ts` or `js` folder.
2.  **Install Dependencies**:
    ```bash
    npm install
    # or
    pnpm install
    ```
    *Note: You will need to ensure `@aastar/sdk` is available. If using the monorepo, it's linked.*

3.  **Configuration**:
    -   Copy `.env.example` to `.env`.
    -   Fill in `RPC_URL` (Sepolia or OP Sepolia).
    -   Fill in configuration addresses (Registry, etc.) or use the defaults provided in the code.
    -   **Private Keys**:
        -   `PRIVATE_KEY_SUPPLIER`: **Required**. Used to fund test accounts.
        -   `PRIVATE_KEY_OPERATOR` / `PRIVATE_KEY_USER`: Optional.
            -   If provided, the scripts will use these specific keys (useful for persistence).
            -   If **not** provided, the scripts will **automatically generate random keys** for each run.

4.  **Run Examples**:

    **TypeScript**:
    ```bash
    npm run scenario:1  # Operator Setup
    npm run scenario:2  # Community Setup
    npm run scenario:3  # Query Info
    ```

    **JavaScript**:
    ```bash
    npm run scenario:1
    npm run scenario:2
    npm run scenario:3
    ```

### Notes

-   **Faucet API**: The examples use `SepoliaFaucetAPI` to automatically fund test accounts. This requires a funded "Supplier" account in `.env`.
-   **Idempotency**: The scripts are designed to be run multiple times (checking if already registered).

---

<a name="chinese"></a>
## 🇨🇳 中文说明

该目录包含独立的示例代码，演示如何集成 AAstar SDK。
这些示例可以直接复制到您的项目中，并根据需要进行修改。

### 目录结构

-   `ts/`: TypeScript 示例代码 (推荐)
-   `js/`: JavaScript 示例代码 (ESM)

### 演示场景

1.  **运营商设置 (`1-operator-setup`)**
    -   使用 Faucet API 为运营商账户充值 (ETH + Tokens)。
    -   注册成为 SuperPaymaster 运营商。
    -   配置运营商节点。

2.  **社区创建与用户注册 (`2-community-setup`)**
    -   一键创建新社区 (DAO)。
    -   注册终端用户进入社区 (包含资格检查 + 入驻流程)。

3.  **信息查询 (`3-query-info`)**
    -   查询用户角色 (社区负责人, 运营商, SuperPaymaster 等)。
    -   查询代币余额 (GToken)。

4.  **Gasless 交易 (`4-gasless-tx`)**
    -   环境: Alice 启动社区并发行 Token。
    -   环境: Bob (用户) 获取智能账户 (AA) 并获得 Token。
    -   **演示**: Bob 转账 2 个 Token 给 Alice，**无需支付 ETH**。
    -   **演示**: Bob 转账 2 个 Token 给 Alice，**无需支付 ETH**。
    -   交易手续费由 SuperPaymaster 代付 (使用社区 Token)。

5.  **完整 L3 生命周期 (`l3-lifecycle-demo.ts`)**
    -   **全流程演示**: 在一个脚本中运行整个协议生命周期。
    -   包含: 社区启动 -> 运营商设置 -> 用户入驻 -> Gasless 交易 -> 退出流程。

### 使用方法

1.  **选择语言**: 进入 `ts` 或 `js` 文件夹。
2.  **安装依赖**:
    ```bash
    npm install
    # 或者
    pnpm install
    ```
    *注意: 请确保 `@aastar/sdk` 可用。如果在 monorepo 中运行，它会自动链接。*

3.  **配置**:
    -   复制 `.env.example` 为 `.env`。
    -   填写 `RPC_URL` (Sepolia 或 OP Sepolia)。
    -   填写合约地址配置 (Registry 等)，或直接使用代码中提供的默认值。
    -   **私钥配置**:
        -   `PRIVATE_KEY_SUPPLIER`: **必须**。用于为测试账户提供资金 (Token分发者)。
        -   `PRIVATE_KEY_OPERATOR` / `PRIVATE_KEY_USER`: **可选**。
            -   如果配置了这些 Key，脚本将使用指定的 Key (方便持久化测试)。
            -   如果**未配置**，脚本将在每次运行时**自动生成随机私钥**。

4.  **运行示例**:

    **TypeScript**:
    ```bash
    npm run scenario:1  # 运行场景 1: 运营商设置
    npm run scenario:2  # 运行场景 2: 社区与用户注册
    npm run scenario:3  # 运行场景 3: 信息查询
    ```

    **JavaScript**:
    ```bash
    npm run scenario:1
    npm run scenario:2
    npm run scenario:3
    ```

### 注意事项

-   **Faucet API (水龙头)**: 示例代码使用 `SepoliaFaucetAPI` 自动为测试账户充值。这需要在 `.env` 中配置一个有资金的 `PRIVATE_KEY_SUPPLIER` (资金提供者) 账户。
-   **幂等性**: 脚本设计为可重复运行 (会自动检查是否已注册)。
