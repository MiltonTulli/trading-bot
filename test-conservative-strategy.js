/**
 * Quick test of the Conservative Hybrid Strategy
 */

import fs from 'fs/promises';
import ConservativeHybridStrategy from './src/strategies/conservative-hybrid.js';

async function testConservativeStrategy() {
    console.log('🧪 Testing Conservative Hybrid Strategy...\n');
    
    const strategy = new ConservativeHybridStrategy();
    
    // Test periods
    const periods = [
        { name: '2021 Bull', file: 'data/backtest/BTCUSDT_4h_bull_2021.json' },
        { name: '2022 Bear', file: 'data/backtest/BTCUSDT_4h_bear_2022.json' },
        { name: '2023 Recovery', file: 'data/backtest/BTCUSDT_4h_recovery_2023.json' },
        { name: 'Recent', file: 'data/backtest/BTCUSDT_4h_historical.json' }
    ];
    
    const results = [];
    
    for (const period of periods) {
        console.log(`📊 Testing ${period.name}...`);
        
        try {
            // Load data
            const data = await fs.readFile(period.file, 'utf8');
            const parsed = JSON.parse(data);
            const candles = parsed.candles.map(candle => ({
                timestamp: new Date(candle.openTime).getTime(),
                open: parseFloat(candle.open),
                high: parseFloat(candle.high),
                low: parseFloat(candle.low),
                close: parseFloat(candle.close),
                volume: parseFloat(candle.volume)
            }));
            
            // Generate signals
            const signals = strategy.generateSignals(candles, { riskPerTrade: 0.015 });
            
            console.log(`   Signals generated: ${signals.length}`);
            
            if (signals.length > 0) {
                console.log(`   First signal: ${signals[0].type} at ${new Date(signals[0].timestamp).toISOString()}`);
                console.log(`   R/R: ${signals[0].riskReward?.toFixed(2)}:1`);
                console.log(`   Confidence: ${signals[0].confidence.toFixed(1)}%`);
                console.log(`   Reason: ${signals[0].reason}`);
            }
            
            results.push({
                period: period.name,
                signals: signals.length,
                avgConfidence: signals.length > 0 ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length : 0,
                avgRR: signals.length > 0 ? signals.reduce((sum, s) => sum + (s.riskReward || 0), 0) / signals.length : 0
            });
            
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
            results.push({
                period: period.name,
                error: error.message
            });
        }
        
        console.log('');
    }
    
    // Summary
    console.log('📈 CONSERVATIVE STRATEGY SUMMARY:');
    console.log('='.repeat(50));
    
    let totalSignals = 0;
    let totalConfidence = 0;
    let totalRR = 0;
    let validPeriods = 0;
    
    for (const result of results) {
        if (result.error) {
            console.log(`${result.period}: ERROR - ${result.error}`);
        } else {
            console.log(`${result.period}: ${result.signals} signals, ${result.avgConfidence.toFixed(1)}% confidence, ${result.avgRR.toFixed(2)}:1 R/R`);
            totalSignals += result.signals;
            totalConfidence += result.avgConfidence;
            totalRR += result.avgRR;
            validPeriods++;
        }
    }
    
    if (validPeriods > 0) {
        console.log(`\nOVERALL:`);
        console.log(`- Total signals: ${totalSignals}`);
        console.log(`- Average signals per period: ${(totalSignals / validPeriods).toFixed(1)}`);
        console.log(`- Average confidence: ${(totalConfidence / validPeriods).toFixed(1)}%`);
        console.log(`- Average R/R: ${(totalRR / validPeriods).toFixed(2)}:1`);
        console.log(`\n⚠️  Note: This conservative approach trades much less frequently (by design)`);
        console.log(`   Expected: 1-5 signals per 6-month period vs 20+ for other strategies`);
    }
}

testConservativeStrategy().catch(console.error);