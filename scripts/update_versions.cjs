// CommonJS (.cjs) so it is tracked in git — the root `*.js` ignore rule would
// otherwise exclude a .js version. `__dirname`/`__filename` are native CJS globals.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const newVersion = process.argv[2];

if (!newVersion) {
    console.error('❌ Error: Please provide a new version number argument.');
    console.error('Usage: node update_versions.cjs <version>');
    process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const packagesDir = path.join(rootDir, 'packages');
const rootPkgPath = path.join(rootDir, 'package.json');

// 递归收集所有 package.json 文件路径
function getAllPackageJson(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            if (file !== 'node_modules') {
                getAllPackageJson(filePath, fileList);
            }
        } else if (file === 'package.json') {
            fileList.push(filePath);
        }
    });
    return fileList;
}

let pkgFiles = [rootPkgPath];
if (fs.existsSync(packagesDir)) {
    pkgFiles = pkgFiles.concat(getAllPackageJson(packagesDir));
}

console.log(`🔄 Updating all packages to version: ${newVersion}...`);

let successCount = 0;

pkgFiles.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        const pkg = JSON.parse(content);
        const oldVersion = pkg.version;
        
        // 只有版本号不同时才更新
        if (pkg.version !== newVersion) {
            pkg.version = newVersion;
            fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
            console.log(`✅ Updated ${path.relative(rootDir, file)}: ${oldVersion} -> ${newVersion}`);
            successCount++;
        } else {
            console.log(`⏹️  Skipped ${path.relative(rootDir, file)} (already ${newVersion})`);
        }
    } catch (e) {
        console.error(`❌ Failed to update ${file}: ${e.message}`);
    }
});

// --- New Logic: SDK Integrity Hash Automation ---
console.log(`\n🛡️  Calculating SDK Integrity Hash (excluding .md files)...`);

try {
    // 1. Calculate stable hash
    const hashCommand = "git ls-files -z | grep -zvE '\\.md$' | xargs -0 sha256sum | sha256sum | awk '{print $1}'";
    const integrityHash = execSync(hashCommand, { cwd: rootDir, encoding: 'utf8' }).trim();
    
    if (!integrityHash) throw new Error("Generated hash is empty");
    console.log(`🔑 Integrity Hash: ${integrityHash}`);

    // 2. Identify files to update
    const docsToUpdate = [
        path.join(rootDir, 'README.md'),
        path.join(rootDir, 'CHANGELOG.md'),
        path.join(rootDir, 'docs/guide/installation.md'),
        path.join(rootDir, 'docs/guide/getting-started.md'),
        path.join(rootDir, 'docs/Configuration_Sync.md'),
        path.join(rootDir, 'docs/API_REFERENCE.md')
    ];

    docsToUpdate.forEach(docPath => {
        if (!fs.existsSync(docPath)) return;
        
        let content = fs.readFileSync(docPath, 'utf8');
        let modified = false;

        // Pattern 1: Expected Hash for vX.Y.Z: HASH
        const hashRegex = new RegExp(`(Expected Hash for v)[\\d\\.]+([^\\n\\\`]*?)\`?[a-f0-9]{64}\`?`, 'g');
        if (hashRegex.test(content)) {
            content = content.replace(hashRegex, `$1${newVersion}$2\`${integrityHash}\``);
            modified = true;
        }

        // Pattern 2: Current Code Integrity Hash (vX.Y.Z): HASH
        // Handles cases like **Current Code Integrity Hash (v0.16.16)**: `hash`
        const currentHashRegex = new RegExp(`(Current Code Integrity Hash \\(v)[\\d\\.]+([^\\n\\\`]*?)\`?[a-f0-9]{64}\`?`, 'g');
        if (currentHashRegex.test(content)) {
            content = content.replace(currentHashRegex, `$1${newVersion}$2\`${integrityHash}\``);
            modified = true;
        }

        // Pattern 3: CHANGELOG specifically
        const changelogRegex = /## \[([\d\.]+)\] - \d{4}-\d{2}-\d{2}\n\*\*SDK Code Integrity Hash\*\*: `[a-f0-9]{64}`/;
        if (docPath.endsWith('CHANGELOG.md') && changelogRegex.test(content)) {
             content = content.replace(changelogRegex, `## [${newVersion}] - ${new Date().toISOString().split('T')[0]}\n**SDK Code Integrity Hash**: \`${integrityHash}\``);
             modified = true;
        }

        // Pattern 4: hand-written "**Version**: X.Y.Z" doc headers (e.g. docs/API_REFERENCE.md),
        // so they track the release instead of drifting (this is what re-introduced a stale
        // 0.16.23 / MIT into the synced docs). License is a constant (Apache-2.0), not
        // version-driven, so only the version is auto-updated here.
        const docVersionRegex = /(\*\*Version\*\*:\s*)\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?/g;
        if (docVersionRegex.test(content)) {
            content = content.replace(docVersionRegex, `$1${newVersion}`);
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(docPath, content);
            console.log(`📝 updated integrity hash in ${path.relative(rootDir, docPath)}`);
        }
    });

} catch (error) {
    console.warn(`⚠️  Integrity Hash sync skipped or failed: ${error.message}`);
}
// --- End of New Logic ---

if (successCount > 0) {
    console.log(`🎉 Successfully updated ${successCount} files.`);
} else {
    console.log(`✨ All files are already up to date.`);
}
