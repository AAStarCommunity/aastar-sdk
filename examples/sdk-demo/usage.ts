import { createPublicClient, createWalletClient, http, parseEther, type Hex, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

/**
 * AAStar SDK Modular Usage Demo (v0.4.x - v1.0.x)
 * 
 * This script demonstrates how to use the various modules of the AAStar SDK.
 * The SDK is split into several packages to support different roles:
 * - @aastar/core: Foundational clients and ABIs.
 * - @aastar/superpaymaster: Smart Account middleware for gas sponsorship.
 * - @aastar/finance: Staking, funding, and collateral management.
 * - @aastar/registry: Identity, roles (SBT), and credit limit orchestration.
 * - @aastar/tokens: ERC20 (xPNTs) and SBT (MySBT) asset management.
 * - @aastar/aa: UserOperation construction and bundler helpers.
 */

// 1. Import Clients from Modular Packages
import { createAAStarPublicClient } from '../../packages/core/src/index.ts';
import { SuperPaymasterClient } from '../../packages/superpaymaster/src/index.ts';
import { RegistryClient, ROLES } from '../../packages/registry/src/index.ts';
import { ERC20Client } from '../../packages/tokens/src/index.ts';
import { FinanceClient } from '../../packages/finance/src/index.ts';
import { UserOpClient } from '../../packages/aa/src/index.ts';

async function main() {
    // Basic Configuration (Mocked/Env-based)
    const RPC_URL = "http://127.0.0.1:8545";
    const REGISTRY_ADDR = "0x..." as Address;
    const SUPER_PM_ADDR = "0x..." as Address;
    const XPNTs_TOKEN = "0x..." as Address;
    const PRIVATE_KEY = "0x..." as Hex;

    // --- Foundational Layer (@aastar/core) ---
    // Use standard utility clients for consistent blockchain interaction.
    const publicClient = createAAStarPublicClient({ chain: foundry, rpcUrl: RPC_URL });
    const account = privateKeyToAccount(PRIVATE_KEY);
    const walletClient = createWalletClient({
        account,
        chain: foundry,
        transport: http(RPC_URL)
    });
    console.log(`Wallet Client initialized for: ${walletClient.account.address}`);

    console.log("--- 1. Identity & Roles (@aastar/registry) ---");
    const regClient = new RegistryClient(publicClient, REGISTRY_ADDR);
    
    // Check if the current user has the ENDUSER role (Identity verification via SBT)
    const isUser = await regClient.hasRole(ROLES.ENDUSER, account.address);
    console.log(`User has Identity SBT: ${isUser}`);

    // High-level "One-stop" registration for a Community (v1.0.x feature)
    // This handles staking + metadata encoding + role binding in one call.
    /*
    const hash = await RegistryClient.registerCommunity(walletClient, REGISTRY_ADDR, {
        name: "My Community",
        ensName: "my.mycelium.eth",
        website: "https://mycelium.xyz",
        description: "A decentralized research hub",
        logoURI: "ipfs://...",
        stakeAmount: parseEther("100")
    });
    */

    console.log("\n--- 2. Sponsorship Middleware (@aastar/superpaymaster) ---");
    const pmClient = new SuperPaymasterClient(publicClient, SUPER_PM_ADDR);

    // Get Operator configuration for the current admin
    const opData = await pmClient.getOperator(account.address);
    // opData returns: [xPNTsToken, isConfigured, isPaused, treasury, rate, balance, ...]
    console.log(`Operator Configured: ${opData[1]}, aPNTs Balance: ${opData[5]}`);

    // Usage in a Smart Account (e.g. Kernel/SimpleAccount)
    // The middleware automatically calculates paymasterData based on our Hybrid model.
    /*
    const saMiddleware = pmClient.getPaymasterMiddleware(account.address);
    const userOp = await createMyUserOp({ ... });
    const sponsoredUserOp = await saMiddleware(userOp);
    */

    console.log("\n--- 3. Asset Management (@aastar/tokens) ---");
    // Interface for interacting with Community Assets (ERC20/SBT)
    const xPNTsBalance = await ERC20Client.balanceOf(publicClient, XPNTs_TOKEN, account.address);
    console.log(`xPNTs Asset Balance: ${xPNTsBalance}`);

    console.log("\n--- 4. Protocol Finance (@aastar/finance) ---");
    // Handle Staking and Collateral Deposits
    // Supports "Push" pattern (transferAndCall) for better UX/Gas in v1.0
    /*
    const depositTx = await FinanceClient.operatorNotifyDeposit(walletClient, SUPER_PM_ADDR, parseEther("50"));
    console.log(`Deposited 50 Tokens to Paymaster: ${depositTx}`);
    */

    console.log("\n--- 5. UserOperation Helpers (@aastar/aa) ---");
    // Standardized helpers for estimating and sending UserOps via Bundlers
    // const receipt = await UserOpClient.sendUserOp(BUNDLER_URL, signedUserOp, ENTRYPOINT_ADDR);

    console.log("\n--- 6. Frontend Integration (@aastar/react) ---");
    // [UI Context]: How to use in a React Component
    /*
    import { useSuperPaymaster, useCreditScore, EvaluationPanel } from '@aastar/react';

    function MyDApp() {
        const { creditLimit } = useCreditScore({
            chain: sepolia,
            registryAddress: REGISTRY_ADDR,
            userAddress: account.address
        });

        const { generatePaymasterAndData } = useSuperPaymaster({
            paymasterAddress: SUPER_PM_ADDR,
            operator: account.address
        });

        return (
            <div>
                <EvaluationPanel 
                    paymasterConfig={{ paymasterAddress: SUPER_PM_ADDR, operator: account.address }}
                    userAddress={account.address}
                    chain={sepolia}
                    registryAddress={REGISTRY_ADDR}
                />
                <button onClick={async () => {
                    const pnd = await generatePaymasterAndData(myUserOp);
                    // send userOp with sponsored pnd...
                }}>
                    Sponsored Transfer (Credit: {formatEther(creditLimit ?? 0n)})
                </button>
            </div>
        );
    }
    */

    console.log("\n✅ Demo finished. Individual module documentation can be found in packages/*/README.md");
}

main().catch(console.error);
