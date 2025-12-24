/**
 * Community Configurations
 * Registry v2.2.0 deployed on 2025-11-08
 */
import { TEST_COMMUNITIES, TEST_TOKEN_ADDRESSES, TOKEN_ADDRESSES } from './contract-addresses';
export var NodeType;
(function (NodeType) {
    NodeType[NodeType["PAYMASTER_AOA"] = 0] = "PAYMASTER_AOA";
    NodeType[NodeType["PAYMASTER_SUPER"] = 1] = "PAYMASTER_SUPER";
    NodeType[NodeType["ANODE"] = 2] = "ANODE";
    NodeType[NodeType["KMS"] = 3] = "KMS";
})(NodeType || (NodeType = {}));
/**
 * AAstar Community
 * - SuperPaymaster shared mode (AOA+)
 * - Uses aPNTs for gas payments
 * - MySBT for identity verification
 */
export const AASTAR_COMMUNITY = {
    name: 'AAstar Community',
    ensName: 'aastar.eth',
    address: TEST_COMMUNITIES.aastar,
    xPNTsToken: TEST_TOKEN_ADDRESSES.aPNTs,
    supportedSBTs: [TOKEN_ADDRESSES.mySBT],
    nodeType: NodeType.PAYMASTER_SUPER,
    isActive: true,
    allowPermissionlessMint: true,
    stakedAmount: '50', // 50 GT
    registeredAt: 1762588812, // 2025-11-08
};
/**
 * Bread Community
 * - Independent AOA Paymaster mode
 * - Uses bPNTs for gas payments
 * - MySBT for identity verification
 */
export const BREAD_COMMUNITY = {
    name: 'Bread Community',
    ensName: 'bread.eth',
    address: TEST_COMMUNITIES.bread,
    xPNTsToken: TEST_TOKEN_ADDRESSES.bPNTs,
    supportedSBTs: [TOKEN_ADDRESSES.mySBT],
    nodeType: NodeType.PAYMASTER_AOA,
    isActive: true,
    allowPermissionlessMint: false,
    stakedAmount: '50', // 50 GT
    registeredAt: 1762588812, // 2025-11-08
};
/**
 * All communities indexed by address
 */
export const COMMUNITIES = {
    [TEST_COMMUNITIES.aastar]: AASTAR_COMMUNITY,
    [TEST_COMMUNITIES.bread]: BREAD_COMMUNITY,
};
/**
 * Get community configuration by address
 */
export function getCommunityConfig(address) {
    return COMMUNITIES[address.toLowerCase()];
}
/**
 * Get all community configurations
 */
export function getAllCommunityConfigs() {
    return Object.values(COMMUNITIES);
}
/**
 * Check if address is a registered community
 */
export function isRegisteredCommunity(address) {
    return address.toLowerCase() in COMMUNITIES;
}
