
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
console.log('ADMIN_FRESH=' + generatePrivateKey());
console.log('USER_FRESH=' + generatePrivateKey());
