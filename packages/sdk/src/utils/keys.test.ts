import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeyManager, parseKey } from './keys.js';
import * as fs from 'fs';
import { isAddress } from 'viem';

vi.mock('fs');

describe('KeyManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should generate a single key pair', () => {
        const key = KeyManager.generateKeyPair('Test');
        expect(key.name).toBe('Test');
        expect(key.privateKey).toMatch(/^0x/);
        expect(isAddress(key.address)).toBe(true);
    });

    it('should generate multiple key pairs', () => {
        const keys = KeyManager.generateMultiple(3, 'Op');
        expect(keys.length).toBe(3);
        expect(keys[0].name).toBe('Op_1');
        expect(keys[2].name).toBe('Op_3');
    });

    it('should save keys to env file', () => {
        const keys = [
            { name: 'Admin', privateKey: '0x1' as `0x${string}`, address: '0x1' as `0x${string}` }
        ];
        (fs.existsSync as any).mockReturnValue(false);
        KeyManager.saveToEnvFile('/mock/.env', keys);
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            '/mock/.env',
            expect.stringContaining('ADMIN_PRIVATE_KEY=0x1'),
            expect.objectContaining({ mode: 0o600 })
        );
    });

    it('should load keys from env file', () => {
        const mockEnv = 'ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80\n';
        (fs.existsSync as any).mockReturnValue(true);
        (fs.readFileSync as any).mockReturnValue(mockEnv);
        
        const keys = KeyManager.loadFromEnvFile('/mock/.env');
        expect(keys.length).toBe(1);
        expect(keys[0].name).toBe('admin');
        expect(keys[0].privateKey).toBe('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    });

    it('should save and load keys from json file', () => {
        const keys = [
            { name: 'Test', privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`, address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as `0x${string}` }
        ];
        
        (fs.existsSync as any).mockReturnValueOnce(false).mockReturnValueOnce(true);
        (fs.readFileSync as any).mockReturnValue(JSON.stringify({ keys }));
        
        KeyManager.saveToJsonFile('/mock/keys.json', keys);
        expect(fs.writeFileSync).toHaveBeenCalled();
        
        const loaded = KeyManager.loadFromJsonFile('/mock/keys.json');
        expect(loaded).toEqual(keys);
    });

    it('should parse keys with and without prefix', () => {
        expect(parseKey('abc')).toBe('0xabc');
        expect(parseKey('0xabc')).toBe('0xabc');
    });

    it('should throw if file exists and overwrite is false', () => {
        (fs.existsSync as any).mockReturnValue(true);
        expect(() => KeyManager.saveToEnvFile('/mock/.env', [], false)).toThrow(/File already exists/);
    });
});
