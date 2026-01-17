
import { CommunityClient } from '../src/CommunityClient';
import { UserClient } from '../src/UserClient';
import * as Exports from '../src/index';

describe('EndUser Package Exports', () => {
    it('should export CommunityClient', () => {
        expect(Exports.CommunityClient).toBeDefined();
        expect(Exports.CommunityClient).toBe(CommunityClient);
    });

    it('should export UserClient', () => {
        expect(Exports.UserClient).toBeDefined();
        expect(Exports.UserClient).toBe(UserClient);
    });
});
