
import { keccak256, stringToBytes } from 'viem';

const errors = [
    'Unauthorized()',
    'InvalidAddress()',
    'InvalidConfiguration()',
    'InsufficientBalance()',
    'DepositNotVerified()',
    'OracleError()',
    'NoSlashHistory()',
    'InsufficientRevenue()',
    'RoleNotConfigured(bytes32,bool)',
    'RoleAlreadyGranted(bytes32,address)',
    'RoleNotGranted(bytes32,address)',
    'InsufficientStake(uint256,uint256)'
];

console.log('--- ERROR HASHES ---');
errors.forEach(e => {
    const hash = keccak256(stringToBytes(e)).slice(0, 10);
    console.log(`${hash}: ${e}`);
});
