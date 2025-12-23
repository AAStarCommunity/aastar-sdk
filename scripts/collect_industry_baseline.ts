#!/usr/bin/env node
/**
 * L2 Baseline Data Collector
 * 
 * Scrapes industry baseline gas cost data from:
 * - https://l2beat.com/scaling/costs (real-time data)
 * - https://l2fees.info/ (reference data)
 * 
 * Stores data in data/industry_baseline_{timestamp}.json
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const OUTPUT_FILE = path.join(DATA_DIR, `industry_baseline_${new Date().toISOString().split('T')[0]}.json`);

interface L2CostData {
    name: string;
    avgCostUSD: number;
    avgCostETH: number;
    avgCostGas: number;
    perUserOp: number;
    total: string;
    source: 'l2beat' | 'l2fees' | 'manual';
    timestamp: string;
}

interface BaselineSnapshot {
    timestamp: string;
    sources: {
        l2beat?: string;
        l2fees?: string;
    };
    chains: L2CostData[];
    averages: {
        costUSD: number;
        costGwei: number;
        gasUsed: number;
    };
}

// Manual data extracted from user's l2beat.com snapshot (30-day average)
const MANUAL_L2BEAT_DATA: Partial<L2CostData>[] = [
    { name: 'Lighter', avgCostUSD: 1.70, perUserOp: 0.06, total: '7.64B' },
    { name: 'Starknet', avgCostUSD: 108.55, perUserOp: 8.50, total: '22.73M' },
    { name: 'OP Mainnet', avgCostUSD: 125.04, perUserOp: 0.02, total: '48.28M' },
    { name: 'Unichain', avgCostUSD: 131.74, perUserOp: 0.21, total: '22.51M' },
    { name: 'Ink', avgCostUSD: 153.44, perUserOp: 0.01, total: '15.88M' },
    { name: 'Base Chain', avgCostUSD: 168.59, perUserOp: 0.01, total: '418.58M' },
    { name: 'Arbitrum One', avgCostUSD: 214.55, perUserOp: 0.64, total: '89.10M' },
    { name: 'Linea', avgCostUSD: 290.27, perUserOp: 8.26, total: '2.77M' },
    { name: 'ZKsync Era', avgCostUSD: 359.01, perUserOp: 22.53, total: '987.91K' },
    { name: 'Abstract', avgCostUSD: 359.08, perUserOp: 15.21, total: '9.01M' },
    { name: 'BOB', avgCostUSD: 464.72, perUserOp: 0.25, total: '331.84K' },
    { name: 'Zircuit', avgCostUSD: 545.51, perUserOp: 3.85, total: '1.51M' },
    { name: 'Katana', avgCostUSD: 1420, perUserOp: 11.94, total: '985.98K' },
    { name: 'Scroll', avgCostUSD: 1440, perUserOp: 17.01, total: '2.21M' },
];

async function fetchL2BeatData(): Promise<L2CostData[]> {
    console.log('📊 Fetching L2Beat cost data...');
    
    try {
        const response = await axios.get('https://l2beat.com/scaling/costs', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        const $ = cheerio.load(response.data);
        const chains: L2CostData[] = [];
        
        // L2Beat uses dynamic rendering, so we might not get full data via cheerio
        // For now, we'll use the manual snapshot and try to parse what we can
        
        console.log('   ⚠️  L2Beat uses dynamic rendering. Using manual snapshot for now.');
        
        const timestamp = new Date().toISOString();
        return MANUAL_L2BEAT_DATA.map(d => ({
            name: d.name!,
            avgCostUSD: d.avgCostUSD!,
            avgCostETH: 0, // Will calculate from USD
            avgCostGas: 0, // Will estimate
            perUserOp: d.perUserOp!,
            total: d.total!,
            source: 'manual' as const,
            timestamp
        }));
    } catch (e: any) {
        console.warn(`   ⚠️  Failed to fetch L2Beat: ${e.message}`);
        return [];
    }
}

async function fetchL2FeesData(): Promise<L2CostData[]> {
    console.log('📊 Fetching L2Fees cost data...');
    
    try {
        const response = await axios.get('https://l2fees.info/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        const $ = cheerio.load(response.data);
        const chains: L2CostData[] = [];
        
        // Try to parse table data
        $('table tr').each((i, row) => {
            if (i === 0) return; // Skip header
            
            const cells = $(row).find('td');
            if (cells.length < 3) return;
            
            const name = $(cells[0]).text().trim();
            const costText = $(cells[1]).text().trim();
            
            // Parse cost (usually in format like "$0.05")
            const costMatch = costText.match(/\$?(\d+\.?\d*)/);
            if (!costMatch) return;
            
            const avgCostUSD = parseFloat(costMatch[1]);
            
            chains.push({
                name,
                avgCostUSD,
                avgCostETH: 0,
                avgCostGas: 0,
                perUserOp: 0,
                total: 'N/A',
                source: 'l2fees',
                timestamp: new Date().toISOString()
            });
        });
        
        if (chains.length > 0) {
            console.log(`   ✅ Found ${chains.length} chains from L2Fees`);
            return chains;
        } else {
            console.warn('   ⚠️  No data parsed from L2Fees. Site structure may have changed.');
            return [];
        }
    } catch (e: any) {
        console.warn(`   ⚠️  Failed to fetch L2Fees: ${e.message}`);
        return [];
    }
}

function calculateAverages(chains: L2CostData[], ethPrice: number = 3500): BaselineSnapshot['averages'] {
    // Filter outliers (remove top 10% and bottom 10%)
    const sorted = chains.map(c => c.avgCostUSD).sort((a, b) => a - b);
    const p10 = Math.floor(sorted.length * 0.1);
    const p90 = Math.floor(sorted.length * 0.9);
    const filtered = sorted.slice(p10, p90);
    
    const avgCostUSD = filtered.reduce((sum, v) => sum + v, 0) / filtered.length;
    
    // Estimate gas cost in Gwei
    // Assuming typical L2 gas price ~0.001 Gwei and ~200k gas for complex AA tx
    // avgCostUSD = gasUsed * gasPrice (in ETH) * ethPrice
    // gasPrice (Gwei) = (avgCostUSD / ethPrice) / gasUsed * 1e9
    
    const estimatedGasUsed = 200000; // Typical AA transfer
    const costInETH = avgCostUSD / ethPrice;
    const gasPriceGwei = (costInETH / estimatedGasUsed) * 1e9;
    
    return {
        costUSD: parseFloat(avgCostUSD.toFixed(4)),
        costGwei: parseFloat(gasPriceGwei.toFixed(6)),
        gasUsed: estimatedGasUsed
    };
}

async function main() {
    console.log('🔍 Collecting L2 Industry Baseline Data...\n');
    
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    // Fetch data from both sources
    const l2beatChains = await fetchL2BeatData();
    const l2feesChains = await fetchL2FeesData();
    
    // Merge and deduplicate
    const allChains = [...l2beatChains, ...l2feesChains];
    const uniqueChains = allChains.reduce((acc, chain) => {
        const existing = acc.find(c => c.name.toLowerCase() === chain.name.toLowerCase());
        if (!existing) {
            acc.push(chain);
        } else if (chain.source === 'l2beat') {
            // Prefer l2beat data over l2fees
            const idx = acc.indexOf(existing);
            acc[idx] = chain;
        }
        return acc;
    }, [] as L2CostData[]);
    
    console.log(`\n📈 Collected ${uniqueChains.length} unique chains`);
    
    // Calculate industry averages
    const averages = calculateAverages(uniqueChains);
    
    console.log('\n📊 Industry Baseline (30-day average):');
    console.log(`   Average Cost (USD): $${averages.costUSD}`);
    console.log(`   Estimated Gas Price (Gwei): ${averages.costGwei}`);
    console.log(`   Estimated Gas Used: ${averages.gasUsed}`);
    
    // Create snapshot
    const snapshot: BaselineSnapshot = {
        timestamp: new Date().toISOString(),
        sources: {
            l2beat: 'https://l2beat.com/scaling/costs',
            l2fees: 'https://l2fees.info/'
        },
        chains: uniqueChains,
        averages
    };
    
    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(snapshot, null, 2));
    console.log(`\n✅ Baseline data saved to: ${OUTPUT_FILE}`);
    
    // Also create/update a "latest" symlink
    const latestFile = path.join(DATA_DIR, 'industry_baseline_latest.json');
    fs.writeFileSync(latestFile, JSON.stringify(snapshot, null, 2));
    console.log(`✅ Latest baseline updated: ${latestFile}`);
}

main().catch(console.error);
