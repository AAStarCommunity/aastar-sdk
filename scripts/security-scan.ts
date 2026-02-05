import * as fs from 'fs';
import * as path from 'path';

/**
 * Security Scanner for Pre-commit Hook (V2 - Robust Edition)
 * Detects potential private key leakage using refined patterns and a comprehensive whitelist.
 */

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const NC = '\x1b[0m';

// Excluded directories and files
const EXCLUDED_DIRS = [
    'node_modules', '.git', '.netlify', '.svelte-kit', 'build', 'dist', '.next',
    'contracts/broadcast', 'contracts/cache', 'contracts/lib', 'test-results',
    'playwright-report', '.auth', 'vendor', 'cache', 'out', 'singleton-paymaster',
    'deprecated', 'artifacts', 'test-accounts'
];

// Scan extensions
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.sol', '.md', '.json', '.env', '.toml', '.yaml', '.yml'];

// Whitelisted (Known public test keys that are safe for local development)
const WHITELISTED_KEYS = new Set([
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Anvil #0
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // Anvil #1
    '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', // Anvil #2
    '0x7c8521197cd533c301a916120409a63c809181144001a1c93a0280eb46c6495d', // Anvil #3
    '0xed9d22440f937debb5459315c8525671b4a31d9d6fbb63473de291682e11c7e9', // Anvil #4
    '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffbb', // Anvil #5
    '0x577f77cb881a8624f52648216505e2196c733945e38fe651eb647703480e7658', // Anvil #6
    '0xae505a29adf29acc2cd393bd72e749ecf2c24f45e79673ad2c64ddd745f7f080', // Anvil #7
    '0x18f93a292d303140023ec14ea024390e49666863bdbbe659995b8f5ca2dfb688', // Anvil #8
    '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6', // Anvil #9
    '0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0', // Test Key
    '0xa0fecea9e4754594e6c5a563fe1bd79a9192b7212d7425c2ab2158c1807d32a1', // Test Key
    '0x0c52a28d94e411a01580d995eb0b0a90256e7eef32f7eaddfc9f0c889afd67ce', // Test Key
    '0x0a7108e34f0d05eddc6e80ee380f5d81dcae2030263f75e42a4c015f59ccd8a4', // Test Key
    '0x2717524c39f8b8ab74c902dc712e590fee36993774119c1e06d31daa4b0fbc81', // Test Key
    '0x7c28d50030917fb555bb19ac888f973b28eff37a7853cdb2da46d23fb46e4724', // Test Key
    '0xc801db57d05466a8f16d645c39f59aeb0c1aee15b3a07b4f5680d3349f094009', // Test/Doc Key
    '0x1b9c251d318c3c8576b96beddfdc4ec2ffbff762d70325787bde31559db83a21', // Test/Doc Key
    '0x3595eeedc937820248e5c46bd4f6b987d7bdc95bca796347c9ade4a793cdef9e', // Test/Doc Key
    '0x0000000000000000000000000000000000000000000000000000000000000000', // Zero Key
    '0x0000000000000000000000000000000000000000000000000000000000000001', // Dummy Key
    '0x0000000000000000000000000000000000000000000000000000000000000002', // Dummy Key
]);

// Improved regex with capture group for the hex part
const SECRET_REGEX = /(key|secret|pk|private).{0,15}(0x[a-fA-F0-9]{64})/gi;

function scanFile(filePath: string): boolean {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let fileHasLeak = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;
        
        // Reset regex state and search in line
        const lineRegex = new RegExp(SECRET_REGEX.source, 'gi');
        while ((match = lineRegex.exec(line)) !== null) {
            const hex = match[2].toLowerCase();
            if (!WHITELISTED_KEYS.has(hex)) {
                if (!fileHasLeak) {
                    console.log(`${RED}❌ [CRITICAL] Potential Secret detected in: ${filePath}${NC}`);
                    fileHasLeak = true;
                }
                console.log(`   L${i + 1}: ${line.trim()}`);
            }
        }
    }
    return fileHasLeak;
}

function walkDir(dir: string, callback: (file: string) => void) {
    if (!fs.existsSync(dir)) return;
    
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        
        // Check if directory is in excluded list
        if (EXCLUDED_DIRS.some(excluded => {
            const normalizedPath = dirPath.replace(/\\/g, '/');
            return normalizedPath.endsWith('/' + excluded) || normalizedPath.includes('/' + excluded + '/');
        })) return;

        try {
            const stats = fs.statSync(dirPath);
            if (stats.isDirectory()) {
                walkDir(dirPath, callback);
            } else {
                callback(dirPath);
            }
        } catch (e) {
            // Ignore missing files or permission errors
        }
    });
}

function main() {
    console.log(`${BLUE}🔒 Local Security Scan: Checking for private keys...${NC}\n`);
    const rootDir = process.cwd();
    let totalFilesWithFindings = 0;
    let fileCount = 0;

    walkDir(rootDir, (filePath) => {
        const ext = path.extname(filePath);
        if (SCAN_EXTENSIONS.includes(ext)) {
            fileCount++;
            if (scanFile(filePath)) {
                totalFilesWithFindings++;
            }
        }
    });

    console.log(`\n📋 Scanned ${fileCount} files.`);

    if (totalFilesWithFindings > 0) {
        console.log(`\n${RED}========================================${NC}`);
        console.log(`${RED}🚨 SECURITY ALERT: ${totalFilesWithFindings} files contain potential secrets!${NC}`);
        console.log(`${YELLOW}⚠️  Commit BLOCKED. Please remove sensitive data or refine the scan.${NC}`);
        console.log(`${RED}========================================${NC}\n`);
        process.exit(1);
    } else {
        console.log(`${GREEN}✅ No potential secrets detected. Local security check passed!${NC}`);
        process.exit(0);
    }
}

main();
