/**
 * L4 Test Utils: Contract Verifier
 * 
 * 验证合约部署、版本和依赖关系
 */

import { type Address, type PublicClient } from 'viem';
import { 
    registryActions, 
    paymasterV4Actions,
    stakingActions,
    xPNTsFactoryActions 
} from '../../packages/core/src/index.js';

export interface ContractInfo {
    name: string;
    address: Address;
    version?: string;
    isDeployed: boolean;
    error?: string;
}

export interface WiringCheck {
    from: string;
    to: string;
    relationship: string;
    isValid: boolean;
    actualValue?: Address;
    expectedValue?: Address;
    error?: string;
}

/**
 * 验证合约基本信息（地址、版本）
 */
export async function verifyContractInfo(
    client: PublicClient,
    name: string,
    address: Address,
    expectedVersion?: string
): Promise<ContractInfo> {
    try {
        // 检查合约代码是否存在
        const code = await client.getBytecode({ address });
        const isDeployed = code && code !== '0x';

        if (!isDeployed) {
            return {
                name,
                address,
                isDeployed: false,
                error: 'No bytecode at address'
            };
        }

        // 尝试读取版本（如果合约有 version() 函数）
        let version: string | undefined;
        try {
            // 大多数合约都有 version() 函数
            version = await client.readContract({
                address,
                abi: [{ type: 'function', name: 'version', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'pure' }],
                functionName: 'version'
            }) as string;
        } catch {
            // 某些合约可能没有 version 函数
            version = undefined;
        }

        // 验证版本（如果提供了期望值）
        if (expectedVersion && version && version !== expectedVersion) {
            return {
                name,
                address,
                version,
                isDeployed: true,
                error: `Version mismatch: expected ${expectedVersion}, got ${version}`
            };
        }

        return {
            name,
            address,
            version,
            isDeployed: true
        };
    } catch (error: any) {
        return {
            name,
            address,
            isDeployed: false,
            error: error.message
        };
    }
}

/**
 * 验证合约间的依赖关系
 */
export async function verifyWiringMatrix(
    client: PublicClient,
    checks: Array<{
        from: string;
        fromAddress: Address;
        to: string;
        toAddress: Address;
        relationship: string;
        getter: () => Promise<Address>;
    }>
): Promise<WiringCheck[]> {
    const results: WiringCheck[] = [];

    for (const check of checks) {
        try {
            const actualValue = await check.getter();
            const isValid = actualValue.toLowerCase() === check.toAddress.toLowerCase();

            results.push({
                from: check.from,
                to: check.to,
                relationship: check.relationship,
                isValid,
                actualValue,
                expectedValue: check.toAddress,
                error: isValid ? undefined : `Expected ${check.toAddress}, got ${actualValue}`
            });
        } catch (error: any) {
            results.push({
                from: check.from,
                to: check.to,
                relationship: check.relationship,
                isValid: false,
                error: error.message
            });
        }
    }

    return results;
}

/**
 * 验证 Paymaster V4 配置（SBT 和 GasToken）
 */
export async function verifyPaymasterConfig(
    client: PublicClient,
    paymasterAddress: Address,
    expectedSBT: Address,
    expectedGasTokens: Address[]
): Promise<{
    owner: Address;
    version: string;
    xpntsFactory: Address;
    sbtSupported: boolean;
    gasTokensSupported: { token: Address; supported: boolean }[];
    errors: string[];
}> {
    const errors: string[] = [];
    const pmAPI = paymasterV4Actions(paymasterAddress)(client);

    try {
        const owner = await pmAPI.owner();
        const version = await pmAPI.version();
        const xpntsFactory = await pmAPI.xpntsFactory();

        // 验证 SBT
        const sbtSupported = await pmAPI.isSBTSupported({ sbt: expectedSBT });
        if (!sbtSupported) {
            errors.push(`SBT ${expectedSBT} not supported`);
        }

        // 验证 GasTokens
        const gasTokensSupported = [];
        for (const token of expectedGasTokens) {
            const supported = await pmAPI.isGasTokenSupported({ gasToken: token });
            gasTokensSupported.push({ token, supported });
            if (!supported) {
                errors.push(`GasToken ${token} not supported`);
            }
        }

        return {
            owner,
            version,
            xpntsFactory,
            sbtSupported,
            gasTokensSupported,
            errors
        };
    } catch (error: any) {
        errors.push(`Failed to read Paymaster config: ${error.message}`);
        throw new Error(errors.join('; '));
    }
}

/**
 * 生成合约验证报告
 */
export function generateContractReport(
    contracts: ContractInfo[],
    wiring: WiringCheck[]
): string {
    const lines: string[] = [];
    lines.push('# 合约环境验证报告\n');

    // 合约信息
    lines.push('## 合约部署状态\n');
    const deployed = contracts.filter(c => c.isDeployed).length;
    lines.push(`总计: ${contracts.length} 个合约`);
    lines.push(`已部署: ${deployed} 个`);
    lines.push(`未部署: ${contracts.length - deployed} 个\n`);

    lines.push('| 合约名称 | 地址 | 版本 | 状态 |');
    lines.push('|---------|------|------|------|');
    for (const contract of contracts) {
        const status = contract.isDeployed ? '✅' : '❌';
        const version = contract.version || 'N/A';
        const note = contract.error ? ` (${contract.error})` : '';
        lines.push(`| ${contract.name} | \`${contract.address}\` | ${version} | ${status}${note} |`);
    }

    // 依赖关系
    lines.push('\n## 合约依赖关系\n');
    const validWiring = wiring.filter(w => w.isValid).length;
    lines.push(`总计: ${wiring.length} 个依赖关系`);
    lines.push(`有效: ${validWiring} 个`);
    lines.push(`无效: ${wiring.length - validWiring} 个\n`);

    lines.push('| 来源 | 目标 | 关系 | 状态 |');
    lines.push('|------|------|------|------|');
    for (const wire of wiring) {
        const status = wire.isValid ? '✅' : '❌';
        const note = wire.error ? ` (${wire.error})` : '';
        lines.push(`| ${wire.from} | ${wire.to} | ${wire.relationship} | ${status}${note} |`);
    }

    return lines.join('\n');
}
