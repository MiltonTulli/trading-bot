#!/usr/bin/env node
/**
 * Signal Generation Diagnostic Tool V2
 * Tests the recalibrated signal generator
 */

import fs from 'fs/promises';
import path from 'path';
import TechnicalIndicators from './indicators/index.js';
import SignalGenerator from './signals/generator-v2.js';

class SignalDiagnosticV2 {
    constructor() {
        this.indicators = new TechnicalIndicators();
        this.dataDir = './data/backtest';
        
        // Test all presets
        this.presets = ['ultra_conservative', 'conservative', 'balanced', 'active', 'aggressive', 'scalper'];
    }

    async runDiagnostic() {
        console.log('🔍 Starting Signal Generation Diagnostic V2...\n');

        // Load sample data
        const data = await this.loadSampleData();
        
        if (!data) {
            console.error('❌ Could not load sample data');
            return;
        }

        console.log(`📊 Analyzing ${data.symbol} ${data.timeframe} - ${data.candles.length} candles`);
        console.log(`   Period: ${data.candles[0].openTime.toISOString().split('T')[0]} to ${data.candles[data.candles.length - 1].openTime.toISOString().split('T')[0]}\n`);

        // Test each preset at a specific time point
        const testIndex = Math.floor(data.candles.length * 0.75); // 75% through the data
        await this.testAllPresetsAtTimePoint(data, testIndex);
        
        // Run broader signal frequency analysis
        await this.runBroadAnalysisAllPresets(data);
    }

    async loadSampleData() {
        try {
            const filename = path.join(this.dataDir, 'BTCUSDT_4h_historical.json');
            const fileContent = await fs.readFile(filename, 'utf8');
            const data = JSON.parse(fileContent);

            data.candles = data.candles.map(candle => ({
                ...candle,
                openTime: new Date(candle.openTime),
                closeTime: new Date(candle.closeTime)
            }));

            return data;
        } catch (error) {
            console.error('Error loading sample data:', error);
            return null;
        }
    }

    async testAllPresetsAtTimePoint(data, testIndex) {
        console.log(`\n=== TESTING ALL PRESETS AT INDEX ${testIndex} ===`);
        
        if (testIndex < 200) {
            console.log('⚠️  Insufficient data for analysis (need at least 200 candles)\n');
            return;
        }

        // Get candles and analysis
        const availableCandles = data.candles.slice(0, testIndex + 1);
        const currentCandle = availableCandles[availableCandles.length - 1];
        
        console.log(`📅 Date: ${currentCandle.openTime.toISOString().split('T')[0]}`);
        console.log(`💰 Price: $${currentCandle.close.toLocaleString()}\n`);

        try {
            const analysis = this.indicators.analyzeMarket(availableCandles);
            
            // Test each preset
            for (const preset of this.presets) {
                console.log(`\n🎯 PRESET: ${preset.toUpperCase()}`);
                console.log('=' + '='.repeat(preset.length + 10));
                
                const generator = new SignalGenerator({ preset });
                const signals = generator.generateSignals(analysis, data.symbol);
                
                if (signals.length > 0) {
                    console.log(`✅ Generated ${signals.length} signal(s):`);
                    
                    signals.forEach((signal, i) => {
                        console.log(`\n   Signal ${i + 1}: ${signal.type} (${signal.direction})`);
                        console.log(`      Score: ${signal.score.toFixed(1)}/100`);
                        console.log(`      Confidence: ${signal.confidence.toFixed(1)}%`);
                        console.log(`      Confirmations: ${signal.confirmations}`);
                        console.log(`      Risk/Reward: ${signal.riskRewardRatio.toFixed(2)}`);
                        console.log(`      Entry: $${signal.entryPrice.toFixed(2)} | Stop: $${signal.stopLoss.toFixed(2)}`);
                        console.log(`      Reasoning: ${signal.reasoning}`);
                        
                        // Show detailed scoring
                        if (signal.details) {
                            console.log(`      Detailed Scores:`);
                            Object.entries(signal.details).forEach(([key, detail]) => {
                                if (detail.score !== undefined) {
                                    console.log(`        ${key}: ${detail.score.toFixed(1)} pts - ${detail.reasoning?.join(', ') || 'No details'}`);
                                }
                            });
                        }
                    });
                } else {
                    console.log(`❌ No signals generated`);
                    
                    // Show why this preset failed
                    console.log(`   Minimum score required: ${generator.getMinimumScore()}`);
                    console.log(`   Minimum confidence required: ${generator.getMinimumConfidence()}%`);
                    console.log(`   Min confirmations: ${generator.settings.minConfirmations}`);
                    console.log(`   Min risk/reward: ${generator.settings.minRiskReward}`);
                }
            }

        } catch (error) {
            console.error(`❌ Analysis error:`, error.message);
        }
    }

    async runBroadAnalysisAllPresets(data) {
        console.log('\n\n🔍 BROAD SIGNAL FREQUENCY ANALYSIS - ALL PRESETS');
        console.log('='.repeat(60));
        
        const results = {};
        
        // Initialize results for each preset
        this.presets.forEach(preset => {
            results[preset] = {
                totalPeriods: 0,
                periodsWithSignals: 0,
                totalSignals: 0,
                signalTypes: {},
                avgScore: 0,
                avgConfidence: 0,
                scoreSum: 0,
                confidenceSum: 0
            };
        });

        const sampleInterval = 50;
        const startIndex = 200;
        
        for (let i = startIndex; i < data.candles.length; i += sampleInterval) {
            const availableCandles = data.candles.slice(0, i + 1);
            
            try {
                const analysis = this.indicators.analyzeMarket(availableCandles);
                
                // Test each preset
                for (const preset of this.presets) {
                    const generator = new SignalGenerator({ preset });
                    const signals = generator.generateSignals(analysis, data.symbol);
                    
                    const result = results[preset];
                    result.totalPeriods++;
                    
                    if (signals.length > 0) {
                        result.periodsWithSignals++;
                        result.totalSignals += signals.length;
                        
                        signals.forEach(signal => {
                            result.signalTypes[signal.type] = (result.signalTypes[signal.type] || 0) + 1;
                            result.scoreSum += signal.score;
                            result.confidenceSum += signal.confidence;
                        });
                    }
                }
                
            } catch (error) {
                // Skip this period
            }
        }

        // Calculate averages
        Object.values(results).forEach(result => {
            result.avgScore = result.totalSignals > 0 ? result.scoreSum / result.totalSignals : 0;
            result.avgConfidence = result.totalSignals > 0 ? result.confidenceSum / result.totalSignals : 0;
        });

        // Print results table
        console.log('\n📊 PRESET COMPARISON:');
        console.log('');
        console.log('Preset            | Periods | Signal% | Total Signals | Avg Score | Avg Confidence | Signals/Period');
        console.log('------------------|---------|---------|---------------|-----------|----------------|---------------');
        
        this.presets.forEach(preset => {
            const r = results[preset];
            const signalRate = r.totalPeriods > 0 ? (r.periodsWithSignals / r.totalPeriods * 100) : 0;
            const signalsPerPeriod = r.totalPeriods > 0 ? (r.totalSignals / r.totalPeriods) : 0;
            
            const row = `${preset.padEnd(17)} | ${String(r.totalPeriods).padStart(7)} | ${signalRate.toFixed(1).padStart(6)}% | ` +
                       `${String(r.totalSignals).padStart(13)} | ${r.avgScore.toFixed(1).padStart(9)} | ` +
                       `${r.avgConfidence.toFixed(1).padStart(13)}% | ${signalsPerPeriod.toFixed(3).padStart(13)}`;
            console.log(row);
        });

        console.log('');

        // Show best performing presets
        const sortedBySignals = this.presets.map(preset => ({
            preset,
            ...results[preset]
        })).sort((a, b) => b.totalSignals - a.totalSignals);

        console.log('🏆 TOP SIGNAL GENERATORS:');
        sortedBySignals.slice(0, 3).forEach((result, i) => {
            const signalRate = result.totalPeriods > 0 ? (result.periodsWithSignals / result.totalPeriods * 100) : 0;
            console.log(`   ${i + 1}. ${result.preset}: ${result.totalSignals} signals (${signalRate.toFixed(1)}% of periods)`);
        });

        console.log('\n📈 SIGNAL TYPE BREAKDOWN:');
        const allSignalTypes = new Set();
        Object.values(results).forEach(r => {
            Object.keys(r.signalTypes).forEach(type => allSignalTypes.add(type));
        });

        Array.from(allSignalTypes).forEach(signalType => {
            console.log(`\n   ${signalType.toUpperCase()}:`);
            this.presets.forEach(preset => {
                const count = results[preset].signalTypes[signalType] || 0;
                if (count > 0) {
                    console.log(`      ${preset}: ${count} signals`);
                }
            });
        });

        // Summary
        console.log('\n💡 DIAGNOSTIC SUMMARY:');
        const totalSignalsAllPresets = Object.values(results).reduce((sum, r) => sum + r.totalSignals, 0);
        const avgSignalsPerPreset = totalSignalsAllPresets / this.presets.length;
        
        console.log(`   📊 Total signals across all presets: ${totalSignalsAllPresets}`);
        console.log(`   📈 Average signals per preset: ${avgSignalsPerPreset.toFixed(1)}`);
        
        const activePresets = Object.values(results).filter(r => r.totalSignals >= 5).length;
        console.log(`   ✅ Presets generating 5+ signals: ${activePresets}/${this.presets.length}`);
        
        if (totalSignalsAllPresets > 0) {
            console.log(`   🎯 Signal generation FIXED! V2 produces signals across multiple presets.`);
        } else {
            console.log(`   ❌ Signal generation still needs work.`);
        }
    }
}

// Main execution
async function runDiagnostic() {
    const diagnostic = new SignalDiagnosticV2();
    await diagnostic.runDiagnostic();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runDiagnostic().catch(console.error);
}

export default SignalDiagnosticV2;