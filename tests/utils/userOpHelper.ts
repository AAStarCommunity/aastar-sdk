/**
 * UserOperation 辅助工具
 * 
 * 用于构建、签名和估算 ERC-4337 UserOperation
 */

import { 
    type Address, 
    type Hex, 
    type PublicClient,
    type WalletClient,
    encodeFunctionData,
    concat,
    toHex,
    pad
} from 'viem';
import type { Account } from 'viem/accounts';

export interface UserOperation {
    sender: Address;
    nonce: bigint;
    initCode: Hex;
    callData: Hex;
    accountGasLimits: Hex;
    preVerificationGas: bigint;
    gasFees: Hex;
    paymasterAndData: Hex;
    signature: Hex;
}

/**
 * 构建 UserOperation
 */
export async function buildUserOperation(params: {
    publicClient: PublicClient;
    sender: Address;
    callData: Hex;
    entryPoint: Address;
}): Promise<Partial<UserOperation>> {
    const { publicClient, sender, callData, entryPoint } = params;

    // 获取 nonce
    const nonce = await publicClient.readContract({
        address: entryPoint,
        abi: [{
            name: 'getNonce',
            type: 'function',
            stateMutability: 'view',
            inputs: [
                { name: 'sender', type: 'address' },
                { name: 'key', type: 'uint192' }
            ],
            outputs: [{ name: '', type: 'uint256' }]
        }],
        functionName: 'getNonce',
        args: [sender, 0n]
    }) as bigint;

    // 检查账户是否已部署
    const code = await publicClient.getBytecode({ address: sender });
    const isDeployed = code && code !== '0x';

    return {
        sender,
        nonce,
        initCode: isDeployed ? '0x' : '0x', // 如果未部署，需要提供 factory + factoryData
        callData,
        accountGasLimits: concat([
            pad(toHex(150000n), { size: 16 }), // verificationGasLimit
            pad(toHex(150000n), { size: 16 })  // callGasLimit
        ]),
        preVerificationGas: 50000n,
        gasFees: concat([
            pad(toHex(1000000000n), { size: 16 }), // maxPriorityFeePerGas
            pad(toHex(2000000000n), { size: 16 })  // maxFeePerGas
        ]),
        paymasterAndData: '0x',
        signature: '0x'
    };
}

/**
 * 签名 UserOperation
 */
export async function signUserOperation(params: {
    userOp: Partial<UserOperation>;
    account: Account;
    entryPoint: Address;
    chainId: number;
}): Promise<Hex> {
    const { userOp, account, entryPoint, chainId } = params;

    // 构建 UserOp hash
    const userOpHash = getUserOpHash({
        userOp: userOp as UserOperation,
        entryPoint,
        chainId
    });

    // 签名
    const signature = await account.signMessage({
        message: { raw: userOpHash }
    });

    return signature;
}

/**
 * 获取 UserOp Hash
 */
export function getUserOpHash(params: {
    userOp: UserOperation;
    entryPoint: Address;
    chainId: number;
}): Hex {
    const { userOp, entryPoint, chainId } = params;

    // 简化版本：实际应该使用 keccak256(abi.encode(...))
    // 这里返回一个占位符，实际使用时需要正确实现
    return `0x${Buffer.from(
        `${userOp.sender}${userOp.nonce}${entryPoint}${chainId}`
    ).toString('hex').padEnd(64, '0')}` as Hex;
}

/**
 * 编码简单转账 callData
 */
export function encodeTransferCallData(params: {
    to: Address;
    value: bigint;
}): Hex {
    const { to, value } = params;

    // SimpleAccount.execute(address dest, uint256 value, bytes calldata func)
    return encodeFunctionData({
        abi: [{
            name: 'execute',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
                { name: 'dest', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'func', type: 'bytes' }
            ],
            outputs: []
        }],
        functionName: 'execute',
        args: [to, value, '0x']
    });
}

/**
 * 编码 ERC20 转账 callData
 */
export function encodeERC20TransferCallData(params: {
    token: Address;
    to: Address;
    amount: bigint;
}): Hex {
    const { token, to, amount } = params;

    // ERC20.transfer(address to, uint256 amount)
    const transferData = encodeFunctionData({
        abi: [{
            name: 'transfer',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
                { name: 'to', type: 'address' },
                { name: 'amount', type: 'uint256' }
            ],
            outputs: [{ name: '', type: 'bool' }]
        }],
        functionName: 'transfer',
        args: [to, amount]
    });

    // SimpleAccount.execute(address dest, uint256 value, bytes calldata func)
    return encodeFunctionData({
        abi: [{
            name: 'execute',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
                { name: 'dest', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'func', type: 'bytes' }
            ],
            outputs: []
        }],
        functionName: 'execute',
        args: [token, 0n, transferData]
    });
}
