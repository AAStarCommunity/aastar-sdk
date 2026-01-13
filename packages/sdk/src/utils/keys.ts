import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Hex, Address } from 'viem';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 密钥对接口
 */
export interface KeyPair {
    name: string;
    privateKey: Hex;
    address: Address;
}

/**
 * 密钥管理器
 * 提供密钥生成、存储、加载等工具函数
 */
export class KeyManager {
    /**
     * 生成单个密钥对
     * @param name - 密钥名称（如 'Jason', 'Anni'）
     */
    static generateKeyPair(name: string): KeyPair {
        const privateKey = generatePrivateKey();
        const account = privateKeyToAccount(privateKey);
        return {
            name,
            privateKey,
            address: account.address
        };
    }

    /**
     * 批量生成密钥对
     * @param names - 密钥名称数组
     */
    static generateKeyPairs(names: string[]): KeyPair[] {
        return names.map(name => this.generateKeyPair(name));
    }

    /**
     * 生成指定数量的密钥对（自动命名为 Operator_1, Operator_2, ...）
     * @param count - 数量
     * @param prefix - 名称前缀（默认 'Operator'）
     */
    static generateMultiple(count: number, prefix: string = 'Operator'): KeyPair[] {
        const names = Array.from({ length: count }, (_, i) => `${prefix}_${i + 1}`);
        return this.generateKeyPairs(names);
    }

    /**
     * 保存密钥到 .env 文件
     * @param filePath - 文件路径（绝对路径）
     * @param keys - 密钥对数组
     * @param overwrite - 是否覆盖已存在的文件（默认 false）
     */
    static saveToEnvFile(filePath: string, keys: KeyPair[], overwrite: boolean = false): void {
        if (fs.existsSync(filePath) && !overwrite) {
            throw new Error(`File already exists: ${filePath}. Set overwrite=true to replace.`);
        }

        const content = keys.map(k => 
            `${k.name.toUpperCase().replace(/\s+/g, '_')}_PRIVATE_KEY=${k.privateKey}`
        ).join('\n') + '\n';

        fs.writeFileSync(filePath, content, { mode: 0o600 }); // 仅所有者可读写
        console.log(`✅ Keys saved to ${filePath} (${keys.length} keys)`);
    }

    /**
     * 从 .env 文件加载密钥
     * @param filePath - 文件路径（绝对路径）
     * @returns 密钥对数组
     */
    static loadFromEnvFile(filePath: string): KeyPair[] {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        
        return lines.map(line => {
            const [key, value] = line.split('=');
            const name = key.replace(/_PRIVATE_KEY$/, '').toLowerCase().replace(/_/g, ' ');
            const privateKey = value.trim() as Hex;
            const account = privateKeyToAccount(privateKey);
            
            return {
                name,
                privateKey,
                address: account.address
            };
        });
    }

    /**
     * 保存密钥到 JSON 文件（包含地址信息）
     * @param filePath - 文件路径（绝对路径）
     * @param keys - 密钥对数组
     * @param overwrite - 是否覆盖已存在的文件（默认 false）
     */
    static saveToJsonFile(filePath: string, keys: KeyPair[], overwrite: boolean = false): void {
        if (fs.existsSync(filePath) && !overwrite) {
            throw new Error(`File already exists: ${filePath}. Set overwrite=true to replace.`);
        }

        const data = {
            generated: new Date().toISOString(),
            keys: keys.map(k => ({
                name: k.name,
                privateKey: k.privateKey,
                address: k.address
            }))
        };

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
        console.log(`✅ Keys saved to ${filePath} (${keys.length} keys)`);
    }

    /**
     * 从 JSON 文件加载密钥
     * @param filePath - 文件路径（绝对路径）
     */
    static loadFromJsonFile(filePath: string): KeyPair[] {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        return data.keys.map((k: any) => ({
            name: k.name,
            privateKey: k.privateKey as Hex,
            address: k.address as Address
        }));
    }

    /**
     * 打印密钥信息（隐藏私钥）
     * @param keys - 密钥对数组
     */
    static printKeys(keys: KeyPair[], showPrivateKey: boolean = false): void {
        console.log('\n🔑 Generated Keys:');
        console.log('─'.repeat(80));
        keys.forEach((k, i) => {
            console.log(`${i + 1}. ${k.name}`);
            console.log(`   Address: ${k.address}`);
            if (showPrivateKey) {
                console.log(`   Private Key: ${k.privateKey}`);
            } else {
                console.log(`   Private Key: ${k.privateKey.slice(0, 10)}...${k.privateKey.slice(-8)}`);
            }
        });
        console.log('─'.repeat(80));
    }
}

/**
 * 解析私钥，确保其带有 0x 前缀
 * @param key - 私钥字符串
 */
export function parseKey(key: string): Hex {
    return (key.startsWith('0x') ? key : `0x${key}`) as Hex;
}
