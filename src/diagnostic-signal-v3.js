/**
 * Signal Generation Diagnostic v3
 * Analyze why signals aren't being generated
 */

import fs from 'fs/promises';
import TechnicalIndicators from './indicators/index.js';
import SignalGenerator from './signals/generator.js';

class SignalDiagnostic {
    constructor() {
        this.indicators = new TechnicalIndicators();
    }

    async runDiagnostic() {
        console.log('🔍 SIGNAL GENERATION DIAGNOSTIC v3');
        console.log('==================================\n');

        try {
            // Test each preset on historical data
            const presets = ['ultra_conservative', 'conservative', 'balanced', 'active', 'aggressive', 'scalper'];
            const results = {};

            for (const preset of presets) {
                console.log(`📊 Testing preset: ${preset.toUpperCase()}`);
                console.log('-'.repeat(50));

                const generator = new SignalGenerator({ preset });
                const presetResults = await this.testPreset(generator, preset);
                results[preset] = presetResults;

                console.log(`   Signals generated: ${presetResults.totalSignals}`);
                console.log(`   Average score: ${presetResults.avgScore.toFixed(1)}`);
                console.log(`   Score distribution: ${JSON.stringify(presetResults.scoreDistribution)}\n`);
            }

            // Summary
            console.log('\n📈 SUMMARY');
            console.log('==========');
            Object.entries(results).forEach(([preset, data]) => {
                console.log(`${preset.padEnd(20)}: ${data.totalSignals} signals (avg score: ${data.avgScore.toFixed(1)})`);
            });

            // Save detailed results
            await fs.writeFile('./data/diagnostic-signals-v3.json', JSON.stringify(results, null, 2));
            console.log('\n💾 Detailed results saved to ./data/diagnostic-signals-v3.json');

        } catch (error) {
            console.error('❌ Diagnostic failed:', error);
        }
    }

    async testPreset(generator, preset) {
        const testFiles = [
            './data/backtest/BTCUSDT_4h_historical.json',
            './data/backtest/ETHUSDT_4h_historical.json'
        ];

        let allSignals = [];
        let allScores = [];
        let sampleCount = 0;

        for (const file of testFiles) {
            try {
                const dataObj = JSON.parse(await fs.readFile(file, 'utf8'));
                const candles = dataObj.candles.slice(-500); // Last 500 4h candles (about 3 months)
                const symbol = dataObj.symbol || 'TEST';
                
                // Test on multiple points
                for (let i = 200; i < candles.length - 1; i += 10) {
                    sampleCount++;
                    const analysis = this.indicators.analyzeMarket(candles.slice(0, i + 1));
                    const signals = generator.generateSignals(analysis, symbol);
                    
                    allSignals.push(...signals);
                    signals.forEach(signal => allScores.push(signal.score));

                    // Log detailed info for first few samples
                    if (sampleCount <= 3) {
                        console.log(`\n  📅 Sample ${sampleCount} (${candles[i].timestamp}):`);
                        console.log(`     Price: $${analysis.currentPrice.toFixed(2)}`);
                        console.log(`     RSI: ${analysis.indicators.rsi?.current?.toFixed(1) || 'N/A'}`);
                        console.log(`     ADX: ${analysis.indicators.adx?.current?.adx?.toFixed(1) || 'N/A'}`);
                        console.log(`     Volume ratio: ${analysis.indicators.volumeAnalysis?.ratio?.toFixed(2) || 'N/A'}`);
                        console.log(`     Trend: ${analysis.indicators.emas?.trendAlignment?.direction || 'N/A'}`);
                        console.log(`     Market regime: ${analysis.assessment?.marketRegime?.type || 'N/A'}`);
                        
                        if (signals.length > 0) {
                            signals.forEach(signal => {
                                console.log(`     🎯 SIGNAL: ${signal.type} (score: ${signal.score}, conf: ${signal.confidence.toFixed(1)}%)`);
                                console.log(`        ${signal.reasoning.slice(0, 100)}...`);
                            });
                        } else {
                            console.log(`     ❌ No signals generated`);
                        }
                    }
                }
            } catch (error) {
                console.error(`   ❌ Error processing ${file}:`, error.message);
            }
        }

        // Calculate statistics
        const avgScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
        
        const scoreDistribution = {
            '0-20': allScores.filter(s => s < 20).length,
            '20-40': allScores.filter(s => s >= 20 && s < 40).length,
            '40-60': allScores.filter(s => s >= 40 && s < 60).length,
            '60-80': allScores.filter(s => s >= 60 && s < 80).length,
            '80+': allScores.filter(s => s >= 80).length
        };

        return {
            totalSignals: allSignals.length,
            signalsPerSample: allSignals.length / sampleCount,
            avgScore,
            scoreDistribution,
            sampleCount,
            signalTypes: this.countSignalTypes(allSignals)
        };
    }

    countSignalTypes(signals) {
        const types = {};
        signals.forEach(signal => {
            types[signal.type] = (types[signal.type] || 0) + 1;
        });
        return types;
    }
}

// Run diagnostic
const diagnostic = new SignalDiagnostic();
await diagnostic.runDiagnostic();