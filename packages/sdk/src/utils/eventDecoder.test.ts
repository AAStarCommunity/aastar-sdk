import { describe, it, expect, vi } from 'vitest';
import { decodeContractEvents, logDecodedEvents } from './eventDecoder.js';
import { keccak256, encodeAbiParameters, stringToBytes, type Hex, type Address } from 'viem';

describe('eventDecoder', () => {
    it('should decode known events', () => {
        // Manual topic construction for RoleGranted(bytes32,address,address)
        const ROLE_GRANTED_SIG = keccak256(stringToBytes('RoleGranted(bytes32,address,address)'));
        const roleId = keccak256(stringToBytes('COMMUNITY'));
        const account = '0x0000000000000000000000000000000000000001';
        const sender = '0x0000000000000000000000000000000000000002';

        const topics = [
            ROLE_GRANTED_SIG,
            roleId,
            encodeAbiParameters([{ type: 'address' }], [account as Address]),
            encodeAbiParameters([{ type: 'address' }], [sender as Address])
        ];

        const logs = [{
            data: '0x' as Hex,
            topics: topics as any
        }];

        const decoded = decodeContractEvents(logs);
        expect(decoded).toHaveLength(1);
        expect(decoded[0].contractName).toBe('Registry');
        expect(decoded[0].eventName).toBe('RoleGranted');
    });

    it('should skip invalid logs', () => {
        const logs = [{ data: 'invalid', topics: [] }];
        const decoded = decodeContractEvents(logs);
        expect(decoded).toHaveLength(0);
    });

    it('should handle decoding errors gracefully', () => {
        const logs = [{ data: '0x123', topics: ['0x0000000000000000000000000000000000000000000000000000000000000000'] }];
        const decoded = decodeContractEvents(logs);
        expect(decoded).toHaveLength(0);
    });

    it('should log decoded events', () => {
        const consoleSpy = vi.spyOn(console, 'log');
        const events = [{
            contractName: 'Test',
            eventName: 'Event',
            args: { amount: 100n, user: '0x0000000000000000000000000000000000000001' }
        }];

        logDecodedEvents(events);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Test] Event: Event'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('amount: 100'));
        consoleSpy.mockRestore();
    });
});
