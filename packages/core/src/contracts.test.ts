import { describe, it, expect } from 'vitest';
import { 
    getContracts, 
    getContract, 
    getCoreContracts, 
    getTokenContracts,
    getEntryPoint,
    isContractNetworkSupported,
    getContractNetworks,
    getDeploymentDate
} from './contracts.js';

describe('Contracts', () => {
    it('should get contracts for sepolia', () => {
        const contracts = getContracts('sepolia');
        expect(contracts.core.registry).toBeDefined();
    });

    it('should throw for unsupported network', () => {
        expect(() => getContracts('mainnet' as any)).toThrow('not supported');
    });

    it('should get a specific contract', () => {
        const addr = getContract('sepolia', 'official', 'entryPoint');
        expect(addr).toBeDefined();
        expect(addr.startsWith('0x')).toBe(true);
    });

    it('should throw for invalid category or contract', () => {
        expect(() => getContract('sepolia', 'invalid' as any, 'entryPoint')).toThrow('Category');
        expect(() => getContract('sepolia', 'official', 'invalid')).toThrow('Contract');
    });

    it('should get core and token contracts', () => {
        expect(getCoreContracts('sepolia').registry).toBeDefined();
        expect(getTokenContracts('sepolia').xPNTsFactory).toBeDefined();
    });

    it('should get entry point', () => {
        expect(getEntryPoint('sepolia')).toBeDefined();
    });

    it('should check network support', () => {
        expect(isContractNetworkSupported('sepolia')).toBe(true);
        expect(isContractNetworkSupported('mainnet')).toBe(false);
    });

    it('should list contract networks', () => {
        const networks = getContractNetworks();
        expect(networks).toContain('sepolia');
    });

    it('should get deployment date', () => {
        const date = getDeploymentDate('sepolia', 'registry');
        expect(date).toBeDefined();
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});
