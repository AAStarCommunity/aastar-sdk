
import { describe, it, expect } from 'vitest';
import * as Exports from '../src/index';

describe('Paymaster Package Exports', () => {
    it('should have exports', () => {
        expect(Exports).toBeDefined();
    });

    it('exports the UserOperation outcome types used by submit and wait', () => {
        expect(Exports.UserOperationNotYetValidError).toBeTypeOf('function');
        expect(Exports.UserOperationFailedError).toBeTypeOf('function');
        expect(Exports.UserOperationReceiptError).toBeTypeOf('function');
        expect(Exports.readUserOperationResult).toBeTypeOf('function');
        expect(Exports.PaymasterClient.waitForUserOperationResult).toBeTypeOf('function');
    });
});
