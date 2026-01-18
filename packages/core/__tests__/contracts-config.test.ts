import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContractConfigManager } from '../src/config/ContractConfigManager';
import { CORE_ADDRESSES } from '../src/contract-addresses';

// Mock values
const VALID_ADDR = '0x1111111111111111111111111111111111111111';

// We need to mock the module to test validation failure cases
vi.mock('../src/contract-addresses', () => ({
  CORE_ADDRESSES: {
    registry: '0x1111111111111111111111111111111111111111',
    gToken: '0x1111111111111111111111111111111111111111',
    gTokenStaking: '0x1111111111111111111111111111111111111111',
    superPaymaster: '0x1111111111111111111111111111111111111111',
    paymasterV4: '0x1111111111111111111111111111111111111111',
    paymasterFactory: '0x1111111111111111111111111111111111111111',
    entryPoint: '0x1111111111111111111111111111111111111111'
  }
}));

describe('ContractConfigManager', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return valid config when all addresses are present', () => {
    const config = ContractConfigManager.getConfig();
    expect(config.registry).toBe(VALID_ADDR);
    expect(config.superPaymaster).toBe(VALID_ADDR);
  });

  it('should throw error if critical address is missing', async () => {
    // Re-import to affect the module
    vi.doMock('../src/contract-addresses', () => ({
        CORE_ADDRESSES: {
            registry: undefined, // Missing critical
            gToken: VALID_ADDR,
            superPaymaster: VALID_ADDR,
            paymasterV4: VALID_ADDR
        }
    }));
    
    // We need to re-import the class under test to pick up the new mock
    const { ContractConfigManager: CCM } = await import('../src/config/ContractConfigManager');
    
    expect(() => CCM.getConfig()).toThrow('Invalid Contract Configuration');
    expect(() => CCM.getConfig()).toThrow('Missing: registry');
  });

  it('should throw error if address is invalid format', async () => {
    vi.doMock('../src/contract-addresses', () => ({
        CORE_ADDRESSES: {
            registry: 'invalid-address',
            gToken: VALID_ADDR,
            superPaymaster: VALID_ADDR,
            paymasterV4: VALID_ADDR
        }
    }));
    
    const { ContractConfigManager: CCM } = await import('../src/config/ContractConfigManager');
    
    expect(() => CCM.getConfig()).toThrow('Invalid Contract Configuration');
    expect(() => CCM.getConfig()).toThrow('Invalid Format: registry');
  });
});
