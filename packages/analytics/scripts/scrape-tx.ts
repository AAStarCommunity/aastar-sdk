
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';
import { createRequire } from 'module';

import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const csvWriter = require('csv-writer').createObjectCsvWriter;

const INPUT_CSV = path.resolve(__dirname, '../data/gasless_data_collection.csv');
const OUTPUT_CSV = path.resolve(__dirname, '../data/gasless_metrics_detailed.csv');

interface TxData {
    Timestamp: string;
    Label: string;
    TxHash: string;
}

interface ScrapedData {
    GasUsed: string;
    L2FeesPaid: string;
    L1FeesPaid: string;
    L1GasUsed: string;
    L1FeeScalar: string;
    ActualGasUsed: string;
    ActualGasCost: string;
    APNTS_Cost: string;
    XPNTS_Cost: string;
    LogDebt: string;
}

async function loadInputData(): Promise<TxData[]> {
    if (!fs.existsSync(INPUT_CSV)) {
        console.error(`❌ Input file ${INPUT_CSV} not found!`);
        return [];
    }
    const content = fs.readFileSync(INPUT_CSV, 'utf-8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',');
    
    // Simple CSV parser
    const data: TxData[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < 3) continue;
        data.push({
            Timestamp: cols[0],
            Label: cols[1],
            TxHash: cols[2]
        });
    }
    return data;
}

async function scrapeTx(page: any, txHash: string): Promise<Partial<ScrapedData>> {
    const url = `https://optimistic.etherscan.io/tx/${txHash}`;
    console.log(`   🔗 Visiting Overview: ${url}`);
    
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // 1. Reveal hidden gas details
        try {
            await page.evaluate(`() => {
                const btn = Array.from(document.querySelectorAll('a, button')).find(el => el.textContent.includes('Click to show more'));
                if (btn) btn.click();
            }`);
            await new Promise(r => setTimeout(r, 1000)); // wait for expansion
        } catch (e) {}

        const extractRow = async (label: string) => {
            const script = `((text) => {
                const rows = Array.from(document.querySelectorAll('.row'));
                const row = rows.find(r => r.textContent && r.textContent.includes(text));
                if (!row) return '';
                const cols = row.querySelectorAll('div[class*="col-"]');
                if (cols.length >= 2) return cols[1].textContent.trim() || '';
                return '';
            })(${JSON.stringify(label)})`; // Safely pass label
            return await page.evaluate(script) as string;
        };

        const usageStr = await extractRow('Gas Limit & Usage by Txn:');
        console.log(`   📊 Usage debug raw: ${usageStr.replace(/\s+/g, ' ')}`);
        
        // Robust extract: find number after "|"
        // Example: "983,059 | 270,459 (27.51%)"
        const usageClean = usageStr.replace(/\s+/g, ' ');
        const gasUsedMatch = usageClean.match(/\|\s*([\d,]+)/);
        const gasUsed = gasUsedMatch ? gasUsedMatch[1].replace(/,/g, '') : 'N/A';

        const l2Fees = await extractRow('L2 Fees Paid:');
        const l1Fees = await extractRow('L1 Fees Paid:');
        const l1GasUsedRow = await extractRow('L1 Gas Used by Txn:');
        const l1Scalar = await extractRow('L1 Fee Scalar:');

        // 2. Navigate to Logs tab for Event Data
        console.log(`   🔗 Visiting Logs: ${url}#eventlog`);
        const logUrl = `${url}#eventlog`;
        await page.goto(logUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        const logScript = `(() => {
            const results = {
                actualGasUsed: 'N/A',
                actualGasCost: 'N/A',
                apntsCost: 'N/A',
                xpntsCost: 'N/A',
                debtRecorded: 'N/A'
            };

            const logEntries = Array.from(document.querySelectorAll('[id^="logI_"]'));
            
            const findValueInEntry = (entry, eventName, paramName) => {
                // Check if this log is for the target event
                if (!entry.innerText.includes(eventName)) return null;

                // 1. Look in decoded data section (most reliable)
                const decRows = Array.from(entry.querySelectorAll('[id^="event_dec_data_"] li'));
                for (const li of decRows) {
                    if (li.innerText.includes(paramName)) {
                        const valElem = li.querySelector('.font-monospace, .text-break');
                        if (valElem) return valElem.innerText.trim().split(' ')[0].replace(/,/g, '');
                    }
                }

                // 2. Fallback: Search all rows/flexes in this entry
                const allRows = Array.from(entry.querySelectorAll('.row, .d-flex'));
                for (const row of allRows) {
                    if (row.innerText.includes(paramName)) {
                        // Value usually in the second major column/div
                        const cols = row.querySelectorAll('div, dd');
                        if (cols.length > 0) {
                            const lastCol = cols[cols.length - 1];
                            const val = lastCol.innerText.trim().split(' ')[0].replace(/,/g, '');
                            if (val && !isNaN(parseInt(val))) return val;
                        }
                    }
                }
                return null;
            };

            logEntries.forEach(entry => {
                if (results.actualGasUsed === 'N/A') results.actualGasUsed = findValueInEntry(entry, 'UserOperationEvent', 'actualGasUsed') || 'N/A';
                if (results.actualGasCost === 'N/A') results.actualGasCost = findValueInEntry(entry, 'UserOperationEvent', 'actualGasCost') || 'N/A';
                if (results.apntsCost === 'N/A') results.apntsCost = findValueInEntry(entry, 'TransactionSponsored', 'aPNTsCost') || 'N/A';
                if (results.xpntsCost === 'N/A') results.xpntsCost = findValueInEntry(entry, 'TransactionSponsored', 'xPNTsCost') || 'N/A';
                if (results.debtRecorded === 'N/A') results.debtRecorded = findValueInEntry(entry, 'DebtRecorded', 'amount') || 'N/A';
            });

            return results;
        })()`;
        
        const logData: any = await page.evaluate(logScript);
        console.log(`   📊 Log debug: ${JSON.stringify(logData)}`);

        return {
            GasUsed: gasUsed,
            L2FeesPaid: l2Fees.split(' ')[0] || 'N/A',
            L1FeesPaid: l1Fees.split(' ')[0] || 'N/A',
            L1GasUsed: l1GasUsedRow || 'N/A',
            L1FeeScalar: l1Scalar || 'N/A',
            ActualGasUsed: logData.actualGasUsed,
            ActualGasCost: logData.actualGasCost,
            APNTS_Cost: logData.apntsCost,
            XPNTS_Cost: logData.xpntsCost,
            LogDebt: logData.debtRecorded
        };

    } catch (e: any) {
        console.warn(`   ⚠️ Error scraping ${txHash}: ${e.message}`);
        return {};
    }
}

async function loadExistingHashes(): Promise<Set<string>> {
    const hashes = new Set<string>();
    if (!fs.existsSync(OUTPUT_CSV)) return hashes;
    
    const content = fs.readFileSync(OUTPUT_CSV, 'utf-8');
    const lines = content.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols[2]) hashes.add(cols[2].trim());
    }
    return hashes;
}

async function main() {
    console.log("🕷️ Starting Optimism Etherscan Scraper (Hi-Fi Mode)...");
    
    const allTxs = await loadInputData();
    const existingHashes = await loadExistingHashes();
    
    const txs = allTxs.filter(tx => !existingHashes.has(tx.TxHash));
    
    console.log(`   📋 Total Transactions: ${allTxs.length}`);
    console.log(`   ⏭️ Already Scraped:  ${existingHashes.size}`);
    console.log(`   🔍 New to Scrape:   ${txs.length}`);
    
    if (txs.length === 0) {
        console.log("✅ No new transactions to scrape. Exiting.");
        return;
    }

    // Output Setup - Use append: true if file exists to avoid losing data
    const fileExists = fs.existsSync(OUTPUT_CSV);
    const writer = csvWriter({
        path: OUTPUT_CSV,
        header: [
            { id: 'Timestamp', title: 'Timestamp' },
            { id: 'Label', title: 'Label' },
            { id: 'TxHash', title: 'TxHash' },
            { id: 'GasUsed', title: 'L2GasUsed' },
            { id: 'L1GasUsed', title: 'L1GasUsed' },
            { id: 'L1FeesPaid', title: 'L1FeesPaid(ETH)' },
            { id: 'L2FeesPaid', title: 'L2FeesPaid(ETH)' },
            { id: 'ActualGasUsed', title: 'ActualGasUsed(UserOp)' },
            { id: 'ActualGasCost', title: 'ActualGasCost(UserOp)' },
            { id: 'APNTS_Cost', title: 'aPNTs_Cost' },
            { id: 'XPNTS_Cost', title: 'xPNTs_Cost' },
            { id: 'LogDebt', title: 'Log_Debt' }
        ],
        append: fileExists
    });

    const browser = await puppeteer.launch({ 
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    for (const tx of txs) {
        if (!tx.TxHash.startsWith('0x')) continue;

        console.log(`\n🔍 Processing: ${tx.Label} (${tx.TxHash})`);
        const data = await scrapeTx(page, tx.TxHash);
        
        const formatWei = (wei: string | undefined | null, precision = 10) => {
            if (!wei || wei === 'N/A') return 'N/A';
            try {
                const val = BigInt(wei);
                const eth = Number(val) / 1e18;
                return eth.toFixed(precision);
            } catch { return wei; }
        };

        const formatCommas = (num: string | undefined | null) => {
            if (!num || num === 'N/A') return 'N/A';
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        };

        const actualGasUsedStr = (data.ActualGasUsed && data.ActualGasUsed !== 'N/A') ? data.ActualGasUsed : '0';
        const actualGasUsedNum = parseInt(actualGasUsedStr.replace(/,/g, '')) || 0;
        
        let actualGasCostNum = BigInt(0);
        try {
             if (data.ActualGasCost && data.ActualGasCost !== 'N/A') {
                 actualGasCostNum = BigInt(data.ActualGasCost);
             }
        } catch (e) {}

        const derivedGasPriceGwei = (actualGasUsedNum > 0 && actualGasCostNum > 0n)
            ? (Number(actualGasCostNum) / actualGasUsedNum / 1e9).toFixed(4) 
            : '0';

        const record = {
            Timestamp: tx.Timestamp,
            Label: tx.Label,
            TxHash: tx.TxHash,
            GasUsed: data.GasUsed || 'N/A',
            L1GasUsed: data.L1GasUsed || 'N/A',
            L1FeesPaid: data.L1FeesPaid || 'N/A',
            L2FeesPaid: data.L2FeesPaid || 'N/A',
            ActualGasUsed: actualGasUsedStr !== '0' ? actualGasUsedStr : 'N/A',
            ActualGasCost: data.ActualGasCost || 'N/A',
            APNTS_Cost: formatWei(data.APNTS_Cost, 8),
            XPNTS_Cost: formatWei(data.XPNTS_Cost, 8),
            LogDebt: formatWei(data.LogDebt, 8)
        };
        
        await writer.writeRecords([record]);
        
        console.log(`   ⛽ L2 Gas Usage: ${formatCommas(record.GasUsed)} (UserOp Actual: ${formatCommas(record.ActualGasUsed)})`);
        console.log(`   📉 Formula: (${formatCommas(record.ActualGasUsed)} gas × ${derivedGasPriceGwei} Gwei) + ${record.L1FeesPaid} (L1 Fee)`);
        console.log(`   💵 Total Charged: ${formatCommas(record.ActualGasCost)} WEI`);
        console.log(`   💰 xPNT Charge:   ${record.XPNTS_Cost}`);

        await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`\n✅ Scraping Complete. New data appended to ${OUTPUT_CSV}`);
    await browser.close();
}

main().catch(console.error);
