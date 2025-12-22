
import { parseAbi } from 'viem';

export const SUPERPAYMASTER_ABI = parseAbi([
    'function deposit(uint256)',
    'function operators(address) view returns (address, bool, bool, address, uint96, uint256, uint256, uint256, uint256)',
    'function getAvailableCredit(address, address) view returns (uint256)',
    'function postOp(uint8,bytes,uint256,uint256)'
]);

export const REGISTRY_ABI = parseAbi([
    'function hasRole(bytes32, address) view returns (bool)',
    'function getCreditLimit(address) view returns (uint256)',
    'function registerRole(bytes32, address, bytes)',
    'function setCreditLimit(address, uint256)'
]);

export const XPNT_ABI = parseAbi([
    'function balanceOf(address) view returns (uint256)',
    'function getDebt(address) view returns (uint256)',
    'function recordDebt(address, uint256)'
]);

export const ENTRYPOINT_ADDRESS = '0x5FF137D4B0FDCD49DcA30c7CF57E578a026d2789';
