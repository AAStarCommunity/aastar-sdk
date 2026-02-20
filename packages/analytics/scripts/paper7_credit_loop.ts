import * as fs from 'fs';
import * as path from 'path';
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  formatEther,
  http,
  keccak256,
  parseAbi,
  parseEther,
  toBytes,
  toHex,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { fileURLToPath } from 'url';

import { loadNetworkConfig, type NetworkName } from '../tests/regression/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

type CliArgs = {
  network: NetworkName;
  out?: string;
};

function parseArgs(argv: string[]): CliArgs {
  let network: NetworkName = 'anvil';
  let out: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--network') {
      network = argv[++i] as NetworkName;
    } else if (a === '--out') {
      out = argv[++i];
    }
  }

  return { network, out };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.network !== 'anvil') {
    throw new Error(`paper7_credit_loop.ts requires anvil (uses anvil_* RPC methods). Got: ${args.network}`);
  }

  const config = loadNetworkConfig(args.network);

  const RPC_URL = config.rpcUrl || 'http://127.0.0.1:8545';
  const SUPER_PAYMASTER = config.contracts.superPaymaster as Hex;
  const REGISTRY_ADDR = config.contracts.registry as Hex;
  const ADMIN_KEY = (process.env.ADMIN_KEY ||
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as Hex;
  const GTOKEN_ADDR = config.contracts.gToken as Hex;
  const STAKING_ADDR = config.contracts.gTokenStaking as Hex;

  const XPNTS_ADDR = config.contracts.aPNTs as Hex;

  const loadAbi = (name: string) => {
    const p = path.resolve(__dirname, `../packages/core/src/abis/${name}.json`);
    if (!fs.existsSync(p)) throw new Error(`ABI not found: ${p}`);
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.abi)) return parsed.abi;
    throw new Error(`Unexpected ABI format: ${p}`);
  };

  const REGISTRY_ABI = loadAbi('Registry');
  const XPNTS_ABI = loadAbi('xPNTsToken');
  const GTOKEN_ABI = loadAbi('GToken');

  const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
  const adminAccount = privateKeyToAccount(ADMIN_KEY);
  const adminWallet = createWalletClient({ account: adminAccount, chain: foundry, transport: http(RPC_URL) });

  const userAccount = privateKeyToAccount(keccak256(toBytes(`paper7_user_${Date.now()}`)));
  const userAddr = userAccount.address;
  const userWallet = createWalletClient({ account: userAccount, chain: foundry, transport: http(RPC_URL) });

  const ENDUSER_ROLE = keccak256(toBytes('ENDUSER'));
  await (adminWallet as any).request({ method: 'anvil_setBalance', params: [userAddr, toHex(parseEther('100.0'))] });

  await adminWallet.writeContract({
    address: GTOKEN_ADDR,
    abi: GTOKEN_ABI,
    functionName: 'mint',
    args: [userAddr, parseEther('100')],
  });

  const hashApprove = await userWallet.writeContract({
    address: GTOKEN_ADDR,
    abi: GTOKEN_ABI,
    functionName: 'approve',
    args: [STAKING_ADDR, parseEther('100')],
  });
  const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: hashApprove });

  const roleData = encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'account', type: 'address' },
          { name: 'community', type: 'address' },
          { name: 'avatarURI', type: 'string' },
          { name: 'ensName', type: 'string' },
          { name: 'stakeAmount', type: 'uint256' },
        ],
      },
    ],
    [
      {
        account: userAddr,
        community: adminAccount.address,
        avatarURI: 'ipfs://avatar',
        ensName: 'user.eth',
        stakeAmount: 0n,
      },
    ],
  );

  try {
    const hash = await userWallet.writeContract({
      address: REGISTRY_ADDR,
      abi: REGISTRY_ABI,
      functionName: 'registerRoleSelf',
      args: [ENDUSER_ROLE, roleData],
    });
    await publicClient.waitForTransactionReceipt({ hash });
  } catch {}

  const tierTx = await adminWallet.writeContract({
    address: REGISTRY_ADDR,
    abi: REGISTRY_ABI,
    functionName: 'setCreditTier',
    args: [1n, parseEther('100')],
    account: adminAccount,
  });
  const setTierReceipt = await publicClient.waitForTransactionReceipt({ hash: tierTx });

  const creditLimit = (await publicClient.readContract({
    address: REGISTRY_ADDR,
    abi: REGISTRY_ABI,
    functionName: 'getCreditLimit',
    args: [userAddr],
  })) as bigint;

  const tokenOwner = (await publicClient.readContract({
    address: XPNTS_ADDR,
    abi: XPNTS_ABI,
    functionName: 'communityOwner',
    args: [],
  })) as Address;

  await (adminWallet as any).request({ method: 'anvil_impersonateAccount', params: [tokenOwner] });
  await (adminWallet as any).request({ method: 'anvil_setBalance', params: [tokenOwner, toHex(parseEther('1.0'))] });
  const ownerWallet = createWalletClient({ account: tokenOwner, chain: foundry, transport: http(RPC_URL) });
  await ownerWallet.writeContract({
    address: XPNTS_ADDR,
    abi: XPNTS_ABI,
    functionName: 'setSuperPaymasterAddress',
    args: [SUPER_PAYMASTER],
  });
  await (adminWallet as any).request({ method: 'anvil_stopImpersonatingAccount', params: [tokenOwner] });

  const debtBefore = (await publicClient.readContract({
    address: XPNTS_ADDR,
    abi: XPNTS_ABI,
    functionName: 'getDebt',
    args: [userAddr],
  })) as bigint;

  await (adminWallet as any).request({ method: 'anvil_impersonateAccount', params: [SUPER_PAYMASTER] });
  await (adminWallet as any).request({ method: 'anvil_setBalance', params: [SUPER_PAYMASTER, toHex(parseEther('10.0'))] });
  const spWallet = createWalletClient({ account: SUPER_PAYMASTER as Address, chain: foundry, transport: http(RPC_URL) });
  const DEBT_AMOUNT = parseEther('10');
  const hashDebt = await spWallet.writeContract({
    address: XPNTS_ADDR,
    abi: XPNTS_ABI,
    functionName: 'recordDebt',
    args: [userAddr, DEBT_AMOUNT],
  });
  const recordDebtReceipt = await publicClient.waitForTransactionReceipt({ hash: hashDebt });
  await (adminWallet as any).request({ method: 'anvil_stopImpersonatingAccount', params: [SUPER_PAYMASTER] });

  const debtAfterRecord = (await publicClient.readContract({
    address: XPNTS_ADDR,
    abi: XPNTS_ABI,
    functionName: 'getDebt',
    args: [userAddr],
  })) as bigint;

  await (adminWallet as any).request({ method: 'anvil_impersonateAccount', params: [tokenOwner] });
  await (adminWallet as any).request({ method: 'anvil_setBalance', params: [tokenOwner, toHex(parseEther('10.0'))] });
  const ownerWallet2 = createWalletClient({ account: tokenOwner, chain: foundry, transport: http(RPC_URL) });
  const MINT_AMOUNT = parseEther('20');
  const hashMint = await ownerWallet2.writeContract({
    address: XPNTS_ADDR,
    abi: XPNTS_ABI,
    functionName: 'mint',
    args: [userAddr, MINT_AMOUNT],
  });
  const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: hashMint });
  await (adminWallet as any).request({ method: 'anvil_stopImpersonatingAccount', params: [tokenOwner] });

  const debtAfterRepay = (await publicClient.readContract({
    address: XPNTS_ADDR,
    abi: XPNTS_ABI,
    functionName: 'getDebt',
    args: [userAddr],
  })) as bigint;

  const summary = {
    network: args.network,
    admin: adminAccount.address,
    user: userAddr,
    xpnts: XPNTS_ADDR,
    superPaymaster: SUPER_PAYMASTER,
    registry: REGISTRY_ADDR,
    creditLimitWei: creditLimit.toString(),
    creditLimitEth: formatEther(creditLimit),
    debtBeforeWei: debtBefore.toString(),
    debtAfterRecordWei: debtAfterRecord.toString(),
    debtAfterRepayWei: debtAfterRepay.toString(),
    gasUsed: {
      approve: approveReceipt.gasUsed.toString(),
      setCreditTier: setTierReceipt.gasUsed.toString(),
      recordDebt: recordDebtReceipt.gasUsed.toString(),
      mint: mintReceipt.gasUsed.toString(),
    },
    tx: {
      approve: hashApprove,
      setTier: tierTx,
      recordDebt: hashDebt,
      mint: hashMint,
    },
  };

  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(summary, null, 2));
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
