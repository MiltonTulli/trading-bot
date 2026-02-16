#!/usr/bin/env node
import { backtest, printResults } from './backtest-iter.js';

// Round 6: Final optimizations
const iterations = [
    {
        _label: '⭐ CURRENT BEST (ITER 31): maxPos 2 + trail 2.5x + TP 3x + trend',
        preset: 'active', risk: 0.01, trailingStop: true, trailATRMult: 2.5, tpMult: 3, trendAlign: true, maxPositions: 2
    },
    // Try different TP multipliers on the best config
    {
        _label: 'ITER 37: ITER31 but TP 2.5x',
        preset: 'active', risk: 0.01, trailingStop: true, trailATRMult: 2.5, tpMult: 2.5, trendAlign: true, maxPositions: 2
    },
    {
        _label: 'ITER 38: ITER31 but TP 4x',
        preset: 'active', risk: 0.01, trailingStop: true, trailATRMult: 2.5, tpMult: 4, trendAlign: true, maxPositions: 2
    },
    {
        _label: 'ITER 39: ITER31 but no TP (pure trail)',
        preset: 'active', risk: 0.01, trailingStop: true, trailATRMult: 2.5, noTP: true, trendAlign: true, maxPositions: 2
    },
    // Try trail multiplier variants
    {
        _label: 'ITER 40: ITER31 but trail 2x',
        preset: 'active', risk: 0.01, trailingStop: true, trailATRMult: 2, tpMult: 3, trendAlign: true, maxPositions: 2
    },
    {
        _label: 'ITER 41: ITER31 but trail 3x',
        preset: 'active', risk: 0.01, trailingStop: true, trailATRMult: 3, tpMult: 3, trendAlign: true, maxPositions: 2
    },
    // Aggressive with maxPos 2 + trend
    {
        _label: 'ITER 42: Aggressive + maxPos 2 + trail 2.5x + TP 3x + trend',
        preset: 'aggressive', risk: 0.01, trailingStop: true, trailATRMult: 2.5, tpMult: 3, trendAlign: true, maxPositions: 2
    },
    // Higher risk with the safe config
    {
        _label: 'ITER 43: ITER31 but risk 1.5%',
        preset: 'active', risk: 0.015, trailingStop: true, trailATRMult: 2.5, tpMult: 3, trendAlign: true, maxPositions: 2
    },
    // Balanced preset
    {
        _label: 'ITER 44: Balanced + maxPos 2 + trail 2.5x + TP 3x + trend',
        preset: 'balanced', risk: 0.01, trailingStop: true, trailATRMult: 2.5, tpMult: 3, trendAlign: true, maxPositions: 2
    },
];

console.log('🚀 ROUND 6 - Final fine-tuning');
console.log('Starting balance: $10,000 | BTC/USDT 4h');
console.log('='.repeat(65));

for (const cfg of iterations) {
    const r = backtest(cfg);
    printResults(cfg._label, r);
}
