除了 `pnpm audit`（主要针对已知 CVE 漏洞），一个健壮的 npm/TypeScript 项目还需要在**供应链安全**、**代码静态分析**、**密钥管理**和**CI/CD 集成**这几个维度建立防线。

针对你作为资深开发者的背景（Web3/Rust/Node），以下是更进阶的**最佳实践和工具推荐**：

### 1. 供应链安全防御 (Supply Chain Security)

`pnpm audit` 只能告诉你依赖包有没有“已知漏洞”，但无法检测**恶意代码注入**（如 typosquatting 或被劫持的包）。

* **Socket.dev (强烈推荐)**
* **作用：** 它不仅检查 CVE，还分析包的“行为”。比如：一个 UI 库突然开始读取环境变量或发送网络请求，Socket 会报警。
* **集成：** 有 GitHub App，也可以作为 CLI 运行。它能拦截包含恶意 install script 的包。


* **OSSF Scorecard**
* **作用：** Google 开源的工具，给依赖项打分。它会检查维护状态、是否有 CI、是否进行代码审查等，帮助你判断引入一个库是否“健康”。


* **Lockfile 锁定**
* **实践：** 在 CI/CD 环境中必须使用 `pnpm install --frozen-lockfile`。这确保了 CI 构建使用的版本与你本地完全一致，防止在构建时悄悄拉取了被篡改的补丁版本。



### 2. 静态代码分析 (SAST)

利用工具在代码运行前发现逻辑漏洞。

* **ESLint Security Plugins**
* 不要只用标准的 lint 规则，需添加安全专用插件：
* `eslint-plugin-security`: 识别潜在的热点（如正则表达式 DoS 攻击 ReDoS、不安全的 `eval` 等）。
* `eslint-plugin-no-secrets`: 防止意外提交密钥。


* **CodeQL (GitHub Native)**
* **作用：** 如果你的项目在 GitHub 上，开启 **Code Scanning**。CodeQL 是一种语义代码分析引擎，能发现数据流中的漏洞（如 SQL 注入、NoSQL 注入、XSS），比正则匹配更深入。


* **SonarQube / SonarCloud**
* 企业级的代码质量和安全扫描，对于 TypeScript 的支持非常好，能发现复杂的逻辑漏洞（Code Smells）。



### 3. TypeScript 专有安全配置

TypeScript 本身就是第一道防线，但需要正确配置：

* **启用 `strict: true`**
* 这是基础。除此之外，开启 `noImplicitAny` 和 `strictNullChecks` 可以消除绝大多数 `undefined` 导致的运行时崩溃（DoS 风险）。


* **避免类型断言 (`as`) 和 `any`**
* 使用 `zod` 或 `io-ts` 进行**运行时数据验证 (Runtime Validation)**。不要盲目相信 API 返回的数据就是 TS 定义的类型。
* **Bad:** `const data = await res.json() as User;`
* **Good:** `const data = UserSchema.parse(await res.json());` (这在 Web3 数据处理中尤为重要，防止恶意构造的 Payload 导致逻辑错误)。



### 4. 脚本与权限控制 (Scripts & Permissions)

npm 的 `postinstall` 脚本是恶意软件最常见的入侵途径。

* **禁用 Install Scripts**
* 在 `.npmrc` 中设置 `ignore-scripts=true`。
* 如果是必须运行脚本的依赖（如 `husky`, `esbuild`），使用 `pnpm approve-builds` (pnpm 特有功能) 或 `allow-scripts` 插件来**白名单**放行特定包。


* **LavaMoat (进阶)**
* 由 MetaMask 團隊開發（很適合你的背景）。它可以為每個 npm 包生成策略文件，限制某个包只能访问 `fs` 模块，或者只能访问特定的全局变量。



### 5. 密钥与硬编码扫描

Web3 项目最怕泄露私钥或 API Key。

* **GitGuardian / TruffleHog**
* **作用：** 在 commit 之前（pre-commit hook）或 CI 阶段扫描代码库，寻找像 AWS Key、Private Key、Infura Key 这种高熵字符串。


* **Dotenv 最佳实践**
* 强制将 `.env` 加入 `.gitignore`。
* 使用 `dotenv-safe` 或 `envalid` 库，在应用启动时校验必要的环境变量是否存在且符合格式，否则直接报错退出。



### 6. 自动化依赖更新 (Bot)

* **Renovate Bot (优于 Dependabot)**
* 相比 Dependabot，Renovate 配置更灵活。你可以设置策略：补丁版本(Patch)自动合并，次要版本(Minor)需人工 Review。保持依赖最新可以大大减少被利用已知漏洞的窗口期。



### 总结：一份推荐的 CI/CD 安全检查清单

在你的 GitHub Actions / GitLab CI 中，建议包含以下步骤：

1. **Checkout**
2. **Secret Scan:** 运行 `trufflehog` 检查本次 commit 是否包含密钥。
3. **Dependency Integrity:** `pnpm install --frozen-lockfile --ignore-scripts`。
4. **SCA Scan:** 运行 `socket` (Socket.dev) 或 `snyk test` 检查依赖风险。
5. **Linting:** `pnpm lint` (包含 `eslint-plugin-security`)。
6. **Build:** 确保构建成功（利用 TS 类型检查）。
7. **Test:** 单元测试覆盖核心业务逻辑。

### 下一步

如果你对 **Socket.dev** 或 **LavaMoat** 感兴趣，我可以为你提供一个具体的配置示例，或者帮你写一个 GitHub Action 的 workflow 文件来集成这些工具。