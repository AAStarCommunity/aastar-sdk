import { 
    type Address, 
    type WalletClient, 
    type PublicClient, 
    parseEther, 
    formatEther,
    zeroAddress,
    type Account,
    type Hash
} from 'viem';
import { registryActions } from './registry.js';
import { gTokenActions } from './tokens.js';
import { paymasterActions } from './paymaster.js';
import { validateAddress, validateAmount, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

export type FaucetPreparationResult = {
    ethFunded: boolean;
    roleRegistered: boolean;
    tokenMinted: boolean;
    paymasterDeposited: boolean;
};

export type FaucetConfig = {
    targetAA: Address;
    token: Address;
    registry: Address;
    paymasterV4?: Address;
    ethAmount?: bigint; // Default 0.1 ETH
    tokenAmount?: bigint; // Default 1000 Tokens
};

/**
 * SepoliaFaucetAPI provides orchestration for setting up test accounts on Sepolia/Anvil.
 */
export class SepoliaFaucetAPI {
    
    /**
     * Orchestrates the complete setup for a test account.
     * 1. Funds ETH
     * 2. Registers ENDUSER role
     * 3. Mints GTokens to user
     * 4. Deposits to Paymaster V4 (if address provided) using Admin's tokens
     */
    static async prepareTestAccount(
        adminWallet: WalletClient, 
        publicClient: PublicClient,
        config: FaucetConfig
    ): Promise<FaucetPreparationResult> {
        try {
            validateRequired(adminWallet, 'adminWallet');
            validateRequired(publicClient, 'publicClient');
            validateAddress(config.targetAA, 'targetAA');
            validateAddress(config.token, 'token');
            validateAddress(config.registry, 'registry');

            console.log(`\n🚰 SepoliaFaucetAPI: Preparing ${config.targetAA}...`);
            const results: FaucetPreparationResult = {
                ethFunded: false,
                roleRegistered: false,
                tokenMinted: false,
                paymasterDeposited: false
            };

            // 1. Fund ETH
            const ethAmount = config.ethAmount ?? parseEther('0.1');
            results.ethFunded = await this.fundETH(adminWallet, publicClient, config.targetAA, ethAmount);

            // 2. Register EndUser
            results.roleRegistered = await this.registerEndUser(adminWallet, publicClient, config.registry, config.targetAA, config.token);

            // 3. Mint Tokens
            const tokenAmount = config.tokenAmount ?? parseEther('1000');
            results.tokenMinted = await this.mintTestTokens(adminWallet, publicClient, config.token, config.targetAA, tokenAmount);

            // 4. Admin Deposit for User (Paymaster V4 Logic)
            if (config.paymasterV4) {
                validateAddress(config.paymasterV4, 'paymasterV4');
                results.paymasterDeposited = await this.adminDepositForUser(
                    adminWallet, 
                    publicClient, 
                    config.paymasterV4, 
                    config.targetAA, 
                    config.token, 
                    parseEther('10') // Deposit 10 Tokens for testing
                );
            }

            console.log(`✅ Preparation Complete!`, results);
            return results;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'prepareTestAccount');
        }
    }

    /**
     * Funds the target with ETH if balance is below threshold.
     */
    static async fundETH(adminWallet: WalletClient, publicClient: PublicClient, target: Address, amount: bigint): Promise<boolean> {
        try {
            validateAddress(target, 'target');
            validateAmount(amount, 'amount');
            
            const balance = await publicClient.getBalance({ address: target });
            // Threshold: 50% of target amount
            if (balance < (amount / 2n)) {
                console.log(`   💰 Funding ETH... (Before: ${formatEther(balance)})`);
                const hash = await adminWallet.sendTransaction({
                    to: target,
                    value: amount,
                    account: adminWallet.account! 
                });
                await publicClient.waitForTransactionReceipt({ hash, timeout: 120000 });
                console.log(`      -> Sent ${formatEther(amount)} ETH. Tx: ${hash}`);
                return true;
            }
            console.log(`   ✅ ETH Balance adequate (${formatEther(balance)} ETH).`);
            return false;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'fundETH');
        }
    }

    /**
     * Registers the ENDUSER role using Sponsor Mode (Admin pays stake).
     */
    static async registerEndUser(
        adminWallet: WalletClient, 
        publicClient: PublicClient, 
        registryAddr: Address, 
        target: Address,
        gasToken: Address
    ): Promise<boolean> {
        try {
            validateAddress(registryAddr, 'registryAddr');
            validateAddress(target, 'target');
            validateAddress(gasToken, 'gasToken');

            const registry = registryActions(registryAddr)(publicClient);
            const walletRegistry = registryActions(registryAddr)(adminWallet);
            const token = gTokenActions(gasToken)(publicClient);
            const walletToken = gTokenActions(gasToken)(adminWallet);

            // 1. Get ENDUSER Role ID
            const ENDUSER_ROLE = await registry.ROLE_ENDUSER();
            
            // 2. Check if already registered
            const hasRole = await registry.hasRole({ roleId: ENDUSER_ROLE, user: target });

            if (hasRole) {
                console.log(`   ✅ ENDUSER Role already held.`);
                return false;
            }

            console.log(`   👤 Registering ENDUSER role (Sponsor Mode)...`);

            // 3. Get Staking Contract Address
            const stakingAddr = await registry.GTOKEN_STAKING();

            // 4. Admin Approves Staking Contract (if needed)
            const adminAddr = adminWallet.account!.address;
            const allowance = await token.allowance({ owner: adminAddr, spender: stakingAddr });

            if (allowance < parseEther('500')) {
                console.log(`      🔓 Approving Staking Contract...`);
                const hashApprove = await walletToken.approve({ 
                    spender: stakingAddr, 
                    amount: parseEther('1000') 
                });
                await publicClient.waitForTransactionReceipt({ hash: hashApprove });
            }

            // 5. SafeMint (Sponsor)
            const userData = '0x'; 
            const hashMint = await walletRegistry.safeMintForRole({ 
                roleId: ENDUSER_ROLE, 
                user: target, 
                data: userData 
            });
            
            await publicClient.waitForTransactionReceipt({ hash: hashMint, timeout: 120000 });
            console.log(`      -> Role Sponsored & Granted. Tx: ${hashMint}`);
            return true;

        } catch (error) {
            console.warn(`      ⚠️ Failed to sponsor ENDUSER role. Error:`, error);
            return false;
        }
    }

    /**
     * Mints tokens directly to the target.
     */
    static async mintTestTokens(
        adminWallet: WalletClient, 
        publicClient: PublicClient, 
        tokenAddr: Address, 
        target: Address, 
        amount: bigint
    ): Promise<boolean> {
        try {
            validateAddress(tokenAddr, 'tokenAddr');
            validateAddress(target, 'target');
            validateAmount(amount, 'amount');

            const token = gTokenActions(tokenAddr)(publicClient);
            const walletToken = gTokenActions(tokenAddr)(adminWallet);

            const balance = await token.balanceOf({ account: target });

            if (balance < amount) {
                console.log(`   🪙 Minting Tokens... (Current: ${formatEther(balance)})`);
                const hash = await walletToken.mint({ to: target, amount });
                await publicClient.waitForTransactionReceipt({ hash, timeout: 120000 });
                console.log(`      -> Minted ${formatEther(amount)}. Tx: ${hash}`);
                return true;
            }
            console.log(`   ✅ Token Balance adequate.`);
            return false;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'mintTestTokens');
        }
    }

    /**
     * Admin mints tokens to self, approves Paymaster, and deposits FOR user.
     */
    static async adminDepositForUser(
        adminWallet: WalletClient, 
        publicClient: PublicClient, 
        paymasterAddr: Address, 
        target: Address, 
        tokenAddr: Address, 
        amount: bigint
    ): Promise<boolean> {
        try {
            validateAddress(paymasterAddr, 'paymasterAddr');
            validateAddress(target, 'target');
            validateAddress(tokenAddr, 'tokenAddr');
            validateAmount(amount, 'amount');

            const token = gTokenActions(tokenAddr)(publicClient);
            const walletToken = gTokenActions(tokenAddr)(adminWallet);
            const paymaster = paymasterActions(paymasterAddr)(adminWallet);

            const adminAddr = adminWallet.account!.address;
            const adminBal = await token.balanceOf({ account: adminAddr });

            if (adminBal < amount) {
                console.log(`   🏧 Admin Minting to Self (for deposit)...`);
                const hash = await walletToken.mint({ to: adminAddr, amount: amount * 10n });
                await publicClient.waitForTransactionReceipt({ hash });
            }

            const allowance = await token.allowance({ owner: adminAddr, spender: paymasterAddr });
            
            if (allowance < amount) {
                console.log(`   🔓 Admin Approving Paymaster...`);
                // Use a large but finite amount instead of max uint for safety/clarity if desired, 
                // but max uint is common in faucets.
                const hashApprove = await walletToken.approve({ 
                    spender: paymasterAddr, 
                    amount: 115792089237316195423570985008687907853269984665640564039457584007913129639935n 
                });
                await publicClient.waitForTransactionReceipt({ hash: hashApprove });
            }

            console.log(`   🏦 Depositing FOR User...`);
            const hash = await paymaster.depositFor({ target, amount });
            await publicClient.waitForTransactionReceipt({ hash, timeout: 120000 });
            console.log(`      -> Deposited ${formatEther(amount)} to PM. Tx: ${hash}`);
            return true;
        } catch (error) {
            console.warn(`      ⚠️ Deposit Failed (Maybe not supported on this PM?):`, error);
            return false;
        }
    }
}
