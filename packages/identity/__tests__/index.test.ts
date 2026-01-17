
import { describe, it, expect } from 'vitest';
import * as Exports from '../src/index';

describe('Identity Package Exports', () => {
    it('should have exports', () => {
        expect(Exports).toBeDefined();
    });
});
