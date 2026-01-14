import { 
    type Address, 
    type WalletClient, 
    type PublicClient, 
    parseEther, 
    parseAbi, 
    createPublicClient,
    http,
    formatEther,
    zeroAddress,
    encodeAbiParameters
} from 'viem';
import { sepolia } from 'viem/chains';
import { registryActions } from './registry';
import { paymasterV4Actions } from './paymasterV4';

// Standard ERC20 ABI for minting/approving
const ERC20_ABI = parseAbi([
    'function mint(address to, uint256 amount) external',
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function balanceOf(address account) external view returns (uint256)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function transfer(address to, uint256 amount) external returns (bool)'
]);

const PAYMASTER_ABI = parseAbi([
    'function depositFor(address target, uint256 amount) external',
    'function deposit() external payable'
]); 

export class SepoliaFaucetAPI {
    
    /**
     * Orchestrates the complete setup for a test account.
     * 1. Funds ETH
     * 2. Registers ENDUSER role
     * 3. Mints potential Paymaster Tokens (cPNTs/dPNTs)
     * 4. Deposits to Paymaster V4 (if address provided) using Admin's tokens
     */
    static async prepareTestAccount(
        adminWallet: WalletClient, 
        publicClient: PublicClient,
        config: {
            targetAA: Address;
            token: Address;
            registry: Address;
            paymasterV4?: Address;
            superPaymaster?: Address; // Just for context, no specific action needed if user holds token
            ethAmount?: bigint; // Default 0.1 ETH
            tokenAmount?: bigint; // Default 1000 Tokens
            community?: Address;
        }
    ) {
        console.log(`\n🚰 SepoliaFaucetAPI: Preparing ${config.targetAA}...`);
        const results = {
            ethFunded: false,
            roleRegistered: false,
            tokenMinted: false,
            paymasterDeposited: false
        };

        // 1. Fund ETH
        const ethAmount = config.ethAmount ?? parseEther('0.1');
        results.ethFunded = await this.fundETH(adminWallet, publicClient, config.targetAA, ethAmount);

        // 2. Register EndUser
        results.roleRegistered = await this.registerEndUser(adminWallet, publicClient, config.registry, config.targetAA, config.token, config.community);

        // 3. Mint Tokens (User Holding Logic - for SuperPaymaster)
        // If SuperPaymaster is involved, User needs to HOLD the token.
        // If Paymaster V4 is involved, User might need to HOLD (Pull mode) or Admin Deposits (Push mode).
        // Strategy: Always mint some to User for flexibility.
        const tokenAmount = config.tokenAmount ?? parseEther('1000');
        results.tokenMinted = await this.mintTestTokens(adminWallet, publicClient, config.token, config.targetAA, tokenAmount);

        // 4. Admin Deposit for User (Paymaster V4 Logic)
        if (config.paymasterV4) {
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
    }

    /**
     * Funds the target with ETH if balance is below threshold.
     */
    static async fundETH(adminWallet: WalletClient, publicClient: PublicClient, target: Address, amount: bigint): Promise<boolean> {
        const balance = await publicClient.getBalance({ address: target });
        // Threshold: 50% of target amount
        if (balance < (amount / 2n)) {
            console.log(`   💰 Funding ETH... (Before: ${formatEther(balance)})`);
            const hash = await adminWallet.sendTransaction({
                to: target,
                value: amount,
                chain: sepolia,
                account: adminWallet.account! 
            });
            await publicClient.waitForTransactionReceipt({ hash, timeout: 120000 });
            console.log(`      -> Sent ${formatEther(amount)} ETH. Tx: ${hash}`);
            return true;
        }
        console.log(`   ✅ ETH Balance adequate (${formatEther(balance)} ETH).`);
        return false;
    }

    /**
     * Registers the ENDUSER role via Registry.
     */
    /**
     * Registers the ENDUSER role using Sponsor Mode (Admin pays stake).
     */
    static async registerEndUser(
        adminWallet: WalletClient, 
        publicClient: PublicClient, 
        registryAddr: Address, 
        target: Address,
        gasToken: Address, // Re-using the 'token' passed in config which is GToken
        community?: Address
    ): Promise<boolean> {
        // ENDUSER Hash: keccak256("ENDUSER")
        const ENDUSER_ROLE = '0x0c34ecc75d3bf122e0609d2576e167f53fb42429262ce8c9b33cab91ff670e3a';
        
        // 1. Check if already registered
        const hasRole = await publicClient.readContract({
            address: registryAddr,
            abi: parseAbi(['function hasRole(bytes32 role, address account) view returns (bool)']),
            functionName: 'hasRole',
            args: [ENDUSER_ROLE as `0x${string}`, target]
        });

        if (hasRole) {
            console.log(`   ✅ ENDUSER Role already held.`);
            return false;
        }

        console.log(`   👤 Registering ENDUSER role (Sponsor Mode)...`);

        try {
            // 2. Get Staking Contract Address
            const stakingAddr = await publicClient.readContract({
                address: registryAddr,
                abi: parseAbi(['function GTOKEN_STAKING() view returns (address)']),
                functionName: 'GTOKEN_STAKING'
            }) as Address;

            // Fetch the actual GToken required by Staking
            const stakingToken = await publicClient.readContract({
                address: stakingAddr,
                abi: parseAbi(['function GTOKEN() view returns (address)']),
                functionName: 'GTOKEN'
            }) as Address;

            // 3. Admin Approves Staking Contract (if needed)
            const adminAddr = adminWallet.account!.address;
            console.log(`      🔎 Debug Staking: Registry=${registryAddr}, Staking=${stakingAddr}`);
            console.log(`      🔎 Debug Token: Contract=${stakingToken}`);
            
            // Check allowance for the STAKING TOKEN
            const allowance = await publicClient.readContract({
                address: stakingToken,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [adminAddr, stakingAddr]
            });
            console.log(`      🔎 Debug Allowance: ${formatEther(allowance)} (Needed: >0.5)`);

            // Approve if needed (standard stake ~0.3 ETH, verify enough)
            if (allowance < parseEther('500')) {
                console.log('      🔓 Approving Staking Contract (Core Token)...');
                const hash = await adminWallet.writeContract({
                    address: stakingToken,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [stakingAddr, parseEther('1000')],
                    chain: sepolia,
                    account: adminWallet.account!
                });
                await publicClient.waitForTransactionReceipt({ hash });
                console.log(`      ✅ Approved Staking. Tx: ${hash}`);
            }

            // ALSO Approve Registry (just in case it pulls first)
            const allowReg = await publicClient.readContract({
                address: stakingToken,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [adminAddr, registryAddr]
            });
            if (allowReg < parseEther('500')) {
                console.log('      🔓 Approving Registry Contract...');
                const hash = await adminWallet.writeContract({
                    address: stakingToken,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [registryAddr, parseEther('1000')],
                    chain: sepolia,
                    account: adminWallet.account!
                });
                await publicClient.waitForTransactionReceipt({ hash });
                console.log(`      ✅ Approved Registry. Tx: ${hash}`);
            } else {
                 console.log('      ✅ Allowance sufficient.');
            }

            // 4. Register Role (registerRole)
            // EndUser Role Data: (address account, address community, string avatarURI, string ensName, uint256 stakeAmount)
            const userData = encodeAbiParameters(
                [
                    { name: 'account', type: 'address' },
                    { name: 'community', type: 'address' },
                    { name: 'avatarURI', type: 'string' },
                    { name: 'ensName', type: 'string' },
                    { name: 'stakeAmount', type: 'uint256' }
                ],
                // Use provided community or zeroAddress (which will fail if Registry enforces it, but allows flexibility)
                [target, community || zeroAddress, '', '', 0n] 
            ); 
            
            const hashMint = await adminWallet.writeContract({
                address: registryAddr,
                abi: parseAbi([
                    'function registerRole(bytes32 roleId, address user, bytes calldata data) external',
                    'error InvalidParameter(string message)'
                ]),
                functionName: 'registerRole',
                args: [ENDUSER_ROLE as `0x${string}`, target, userData],
                chain: sepolia,
                account: adminWallet.account!
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
        token: Address, 
        target: Address, 
        amount: bigint
    ): Promise<boolean> {
        const balance = await publicClient.readContract({
            address: token,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [target]
        });

        if (balance < amount) {
            console.log(`   🪙 Minting Tokens... (Current: ${formatEther(balance)})`);
            // Assuming Admin has Minter Role on Token
            const hash = await adminWallet.writeContract({
                address: token,
                abi: ERC20_ABI,
                functionName: 'mint',
                args: [target, amount],
                chain: sepolia,
                account: adminWallet.account!
            });
            await publicClient.waitForTransactionReceipt({ hash, timeout: 120000 });
            console.log(`      -> Minted ${formatEther(amount)}. Tx: ${hash}`);
            return true;
        }
        console.log(`   ✅ Token Balance adequate.`);
        return false;
    }

    /**
     * Complex Flow:
     * 1. Admin mints tokens to SELF.
     * 2. Admin approves Paymaster.
     * 3. Admin calls depositFor(target) on Paymaster.
     */
    static async adminDepositForUser(
        adminWallet: WalletClient, 
        publicClient: PublicClient, 
        paymaster: Address, 
        target: Address, 
        token: Address, 
        amount: bigint
    ): Promise<boolean> {
        // 1. Mint to Admin First
        const adminAddr = adminWallet.account!.address;
        const adminBal = await publicClient.readContract({
            address: token,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [adminAddr]
        });

        if (adminBal < amount) {
            console.log(`   🏧 Admin Minting to Self (for deposit)...`);
            const hash = await adminWallet.writeContract({
                address: token,
                abi: ERC20_ABI,
                functionName: 'mint',
                args: [adminAddr, amount * 10n], // bulk mint
                chain: sepolia,
                account: adminWallet.account!
            });
            await publicClient.waitForTransactionReceipt({ hash });
        }

        // 2. Approve Paymaster
        const allowance = await publicClient.readContract({
            address: token,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [adminAddr, paymaster]
        });
        
        if (allowance < amount) {
            console.log(`   🔓 Admin Approving Paymaster...`);
            const hash = await adminWallet.writeContract({
                address: token,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [paymaster, 115792089237316195423570985008687907853269984665640564039457584007913129639935n], // Max Uint
                chain: sepolia,
                account: adminWallet.account!
            });
            await publicClient.waitForTransactionReceipt({ hash });
        }

        // 3. Deposit For
        console.log(`   🏦 Depositing FOR User...`);
        try {
            const hash = await adminWallet.writeContract({
                address: paymaster,
                abi: PAYMASTER_ABI,
                functionName: 'depositFor',
                args: [target, amount],
                chain: sepolia,
                account: adminWallet.account!
            });
            await publicClient.waitForTransactionReceipt({ hash, timeout: 120000 });
            console.log(`      -> Deposited ${formatEther(amount)} to PM. Tx: ${hash}`);
            return true;
        } catch (e) {
            console.warn(`      ⚠️ Deposit Failed (Maybe not supported on this PM?):`, e);
            return false;
        }
    }
}
