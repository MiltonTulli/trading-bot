#!/usr/bin/env node
/**
 * Trading Bot — Breakout #2 Strategy
 * 
 * Single strategy: price breaks above/below N-candle high/low with volume filter.
 * Params: lookback=10, volMult=2.0, SL=3%, TP=6%, posSize=20%, leverage=5x
 * 
 * Usage:
 *   npm start           → Start trading loop (checks every 4h)
 *   node src/index.js once  → Single check (for cron)
 *   node src/index.js test  → Test initialization
 */

import { runBreakoutEngine } from './breakout-engine.js';

const INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

async function tick() {
    try {
        const r = await runBreakoutEngine();
        console.log(
            `[${r.time}] ${r.action} | ${r.mode} | $${r.price} | Bal: $${r.balance} | Pos: ${r.position} | W:${r.stats.wins} L:${r.stats.losses} PnL:$${r.stats.totalPnL}`
        );
        return r;
    } catch (err) {
        console.error(`[${new Date().toISOString()}] ERROR:`, err.message);
    }
}

// ─── CLI ───────────────────────────────────────────────────────────

const command = process.argv[2] || 'run';

switch (command) {
    case 'once':
        // Single iteration, then exit
        const result = await tick();
        if (result) console.log(JSON.stringify(result, null, 2));
        process.exit(0);
        break;

    case 'test':
        console.log('🧪 Testing bot initialization...');
        const testResult = await tick();
        if (testResult) {
            console.log('✅ Bot works correctly');
            process.exit(0);
        } else {
            console.error('❌ Bot test failed');
            process.exit(1);
        }
        break;

    case 'run':
    default:
        console.log('🚀 Breakout #2 Trading Bot starting...');
        console.log('   Interval: 4h | lookback=10, vol×2, SL=3%, TP=6%, 5x lev');
        await tick();
        setInterval(tick, INTERVAL_MS);
        break;
}
