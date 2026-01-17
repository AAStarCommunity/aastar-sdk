
import { PaymasterOperatorClient } from '../src/PaymasterOperatorClient';
import { ProtocolClient } from '../src/ProtocolClient';
import * as Exports from '../src/index';

describe('Operator Package Exports', () => {
    it('should export PaymasterOperatorClient', () => {
        expect(Exports.PaymasterOperatorClient).toBeDefined();
        expect(Exports.PaymasterOperatorClient).toBe(PaymasterOperatorClient);
    });

    it('should export ProtocolClient', () => {
        expect(Exports.ProtocolClient).toBeDefined();
        expect(Exports.ProtocolClient).toBe(ProtocolClient);
    });
});
