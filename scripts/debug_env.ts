import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Current __dirname:', __dirname);
const envPath = path.resolve(__dirname, '../../env/.env');
console.log('Loading env from:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('Error loading .env:', result.error);
} else {
    console.log('.env loaded successfully');
    console.log('SUPER_PAYMASTER_ADDRESS:', process.env.SUPER_PAYMASTER_ADDRESS);
}
