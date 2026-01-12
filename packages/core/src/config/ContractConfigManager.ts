import { Address, isAddress } from 'viem';
import { CORE_ADDRESSES } from '../contract-addresses.js';

export interface SuperPaymasterConfig {
    registry: Address;
    gToken: Address;
    gTokenStaking: Address;
    superPaymaster: Address;
    paymasterFactory: Address;
    paymasterV4: Address;
    entryPoint: Address;
}

export class ContractConfigManager {
    /**
     * Get validated core configuration
     */
    public static getConfig(): SuperPaymasterConfig {
        const config = {
            registry: CORE_ADDRESSES.registry,
            gToken: CORE_ADDRESSES.gToken,
            gTokenStaking: CORE_ADDRESSES.gTokenStaking,
            superPaymaster: CORE_ADDRESSES.superPaymaster,
            paymasterV4: CORE_ADDRESSES.paymasterV4,
            paymasterFactory: CORE_ADDRESSES.paymasterFactory,
            entryPoint: CORE_ADDRESSES.entryPoint || '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address
        };

        this.validate(config);
        return config;
    }

    /**
     * Validate configuration addresses
     */
    private static validate(config: Record<string, Address | undefined>) {
        const missing: string[] = [];
        const invalid: string[] = [];

        // Critical contracts that MUST exist for experiments
        const critical = ['registry', 'gToken', 'superPaymaster', 'paymasterV4'];

        for (const [key, addr] of Object.entries(config)) {
            if (!addr) {
                if (critical.includes(key)) {
                    missing.push(key);
                }
            } else if (!isAddress(addr)) {
                invalid.push(`${key} (${addr})`);
            }
        }

        if (missing.length > 0 || invalid.length > 0) {
            throw new Error(`
                Invalid Contract Configuration:
                Missing: ${missing.join(', ')}
                Invalid Format: ${invalid.join(', ')}
                
                Please ensure your .env file is correctly sourced from 'projects/SuperPaymaster/.env.sepolia'
            `);
        }
    }
}
