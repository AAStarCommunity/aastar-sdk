
import { describe, it, expect } from 'vitest';
import * as Exports from '../src/index';

describe('Paymaster Package Exports', () => {
    it('should have exports', () => {
        expect(Exports).toBeDefined();
    });
});
