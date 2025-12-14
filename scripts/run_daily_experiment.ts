import { runEOATest } from './02_test_eoa.js';
// We need to export main functions from the other scripts, assumed they are exported.
// I will check or dynamically import.
// Current scripts execute if process.argv match, and export 'runX'.
import { runStandardAATest } from './03_test_standard_aa.js'; // Pimlico
import { runPaymasterV4Test } from './04_test_paymaster_v4.js'; // Group B
import { runSuperPaymasterTest } from './05_test_superpaymaster.js'; // Group C

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Config: 48 runs per 24 hours = 2 runs per hour = every 30 minutes.
// Jitter: +/- 10 minutes (600,000 ms)
const BASE_INTERVAL = 30 * 60 * 1000; 
const JITTER_MAX = 10 * 60 * 1000;

async function runBatch(batchId: number) {
    console.log(`\n🔔 Starting Batch #${batchId} at ${new Date().toISOString()}`);
    
    try {
        console.log("   --- [1/4] Running EOA Test ---");
        await runEOATest();
        await sleep(30000); // 30s buffer

        console.log("   --- [2/4] Running Pimlico Test ---");
        await runStandardAATest(); 
        await sleep(30000);

        console.log("   --- [3/4] Running Group B (V4) Test ---");
        await runPaymasterV4Test();
        await sleep(30000);

        console.log("   --- [4/4] Running Group C (SuperPaymaster) Test ---");
        await runSuperPaymasterTest();
    
        console.log(`✅ Batch #${batchId} Complete.`);
    } catch (e) {
        console.error(`❌ Batch #${batchId} Failed Partial:`, e);
    }
}

async function main() {
    console.log("⏰ Daily Experiment Orchestrator Started");
    console.log("   Target: 48 runs / 24h (Avg every 30 mins)");
    
    let runCount = 0;
    
    while (true) {
        runCount++;
        await runBatch(runCount);
        
        // Calculate next wait
        const jitter = Math.floor(Math.random() * (JITTER_MAX * 2)) - JITTER_MAX; // -10 to +10 min
        const waitTime = BASE_INTERVAL + jitter;
        
        // Ensure strictly positive wait (min 5 mins)
        const finalWait = Math.max(tokensWait(5), waitTime);
        
        console.log(`💤 Sleeping for ${Math.round(finalWait / 60000)} minutes... (Next: ${new Date(Date.now() + finalWait).toISOString()})`);
        
        await sleep(finalWait);
    }
}

function tokensWait(minutes: number) {
    return minutes * 60 * 1000;
}

main().catch(console.error);
