/**
 * Focused Backtest - Test Balanced & Active Presets on All Market Periods
 * Quick validation of performance across different market conditions
 */

import fs from 'fs/promises';
import TechnicalIndicators from './indicators/index.js';
import SignalGenerator from './signals/generator.js';
import PaperTradingEngine from './paper/engine.js';

class FocusedBacktest {
    constructor() {
        this.indicators = new TechnicalIndicators();
        this.results = {};
        
        // Focus on just the Balanced and Active presets
        this.presets = [
            {
                name: 'balanced',
                description: '2+ confirmations, R:R 2:1, risk 1.5%',
                config: { 
                    preset: 'balanced',
                    paperBalance: 10000,
                    riskPerTrade: 0.015,
                    maxPortfolioHeat: 0.08
                }
            },
            {
                name: 'active',
                description: '2+ confirmations, R:R 1.5:1, risk 2%',
                config: { 
                    preset: 'active',
                    paperBalance: 10000,
                    riskPerTrade: 0.02,
                    maxPortfolioHeat: 0.10
                }
            }
        ];

        // Test all available market periods
        this.testPeriods = [
            {
                name: 'recent_6months',
                description: 'Recent 6 months (Aug 2025 - Feb 2026)',
                files: ['./data/backtest/BTCUSDT_4h_historical.json'],
                startIndex: -1000,
                endIndex: -1
            },
            {
                name: 'bear_2022',
                description: 'Bear Market 2022 (Jan-Jun): BTC $47K → $19K',
                files: ['./data/backtest/BTCUSDT_4h_bear_2022.json'],
                startIndex: 0,
                endIndex: -1
            },
            {
                name: 'bull_2021', 
                description: 'Bull Market 2021 (Jan-Jun): BTC $29K → $35K',
                files: ['./data/backtest/BTCUSDT_4h_bull_2021.json'],
                startIndex: 0,
                endIndex: -1
            },
            {
                name: 'recovery_2023',
                description: 'Recovery 2023 (Jan-Jun): BTC $16K → $30K',
                files: ['./data/backtest/BTCUSDT_4h_recovery_2023.json'],
                startIndex: 0,
                endIndex: -1
            }
        ];
    }

    async runFocusedBacktest() {
        console.log('🎯 FOCUSED BACKTEST - BALANCED & ACTIVE ACROSS ALL PERIODS');
        console.log('='.repeat(65));
        console.log(`Testing ${this.presets.length} presets across ${this.testPeriods.length} periods`);
        console.log('');

        for (const period of this.testPeriods) {
            console.log(`📊 Testing Period: ${period.name.toUpperCase()}`);
            console.log(period.description);
            console.log('-'.repeat(50));

            this.results[period.name] = {};

            for (const preset of this.presets) {
                console.log(`\n🎯 Testing preset: ${preset.name.toUpperCase()}`);
                console.log(`   ${preset.description}`);

                const result = await this.backtestPreset(preset, period);
                this.results[period.name][preset.name] = result;

                console.log(`   Results: ${result.totalTrades} trades, ${result.winRate.toFixed(1)}% win rate, ${result.totalReturn.toFixed(1)}% return`);
            }
        }

        // Generate and save focused report
        await this.generateFocusedReport();
        await this.saveResults();

        console.log('\n✅ Focused backtest completed successfully!');
        console.log('📄 Report saved to ./data/backtest/report-focused.md');
        console.log('📊 Data saved to ./data/backtest/results-focused.json');
    }

    async backtestPreset(preset, period) {
        const signalGenerator = new SignalGenerator(preset.config);
        
        // Create a fresh paper trading engine for each test
        const paperEngine = new PaperTradingEngine({
            ...preset.config,
            paperBalance: preset.config.paperBalance || 10000
        });
        await paperEngine.resetPortfolio();

        let totalSignalsGenerated = 0;
        let signalsExecuted = 0;
        let analysisPoints = 0;

        // Test each file in the period
        for (const dataFile of period.files) {
            try {
                const dataObj = JSON.parse(await fs.readFile(dataFile, 'utf8'));
                const candles = dataObj.candles;
                const symbol = dataObj.symbol;
                
                // Get the specified period slice
                const startIdx = period.startIndex < 0 ? candles.length + period.startIndex : period.startIndex;
                const endIdx = period.endIndex < 0 ? candles.length + period.endIndex : period.endIndex;
                const periodCandles = candles.slice(startIdx, endIdx);

                console.log(`     Testing ${symbol}: ${periodCandles.length} candles (${periodCandles[0]?.openTime} to ${periodCandles[periodCandles.length-1]?.openTime})`);

                // Run backtest on this symbol/period (faster - every 8 bars instead of every bar)
                for (let i = 200; i < periodCandles.length - 1; i += 8) {
                    const currentCandles = periodCandles.slice(0, i + 1);
                    const currentCandle = periodCandles[i];
                    const nextCandle = periodCandles[i + 1];
                    
                    analysisPoints++;

                    try {
                        // Generate market analysis
                        const analysis = this.indicators.analyzeMarket(currentCandles);
                        const currentPrice = currentCandle.close;
                        
                        // Generate signals
                        const signals = signalGenerator.generateSignals(analysis, symbol);
                        totalSignalsGenerated += signals.length;

                        // Execute valid signals
                        for (const signal of signals) {
                            if (signalGenerator.validateSignal(signal)) {
                                const trade = await paperEngine.executeTrade(signal, currentPrice);
                                if (trade) {
                                    signalsExecuted++;
                                }
                            }
                        }

                        // Update positions with next candle price
                        if (nextCandle) {
                            await paperEngine.updatePositions({
                                [symbol]: {
                                    '4h': {
                                        currentPrice: nextCandle.close,
                                        indicators: analysis.indicators
                                    }
                                }
                            });
                        }

                    } catch (error) {
                        console.warn(`     Warning: Analysis failed at index ${i}: ${error.message}`);
                    }

                    // Log progress occasionally
                    if (i % 400 === 0) {
                        const progress = ((i - 200) / (periodCandles.length - 201)) * 100;
                        process.stdout.write(`\r     Progress: ${progress.toFixed(1)}% (${signalsExecuted} trades)`);
                    }
                }

                console.log(`\r     Completed: ${signalsExecuted} trades executed`);

            } catch (error) {
                console.error(`     Error processing ${dataFile}:`, error.message);
            }
        }

        // Get final portfolio stats
        const finalStats = paperEngine.getPerformanceMetrics();
        const recentTrades = paperEngine.getRecentTrades(5);

        return {
            preset: preset.name,
            description: preset.description,
            period: period.name,
            analysisPoints,
            totalSignalsGenerated,
            signalsExecuted,
            signalExecutionRate: (signalsExecuted / Math.max(totalSignalsGenerated, 1)) * 100,
            ...finalStats,
            recentTrades,
            startDate: 'calculated',
            endDate: 'calculated'
        };
    }

    async generateFocusedReport() {
        let report = `# Focused Backtest Report - Multi-Period Analysis\n\n`;
        report += `Generated: ${new Date().toISOString()}\n`;
        report += `Testing Balanced & Active presets across ${this.testPeriods.length} market periods\n\n`;

        // Cross-period comparison table
        report += `## Multi-Period Performance Comparison\n\n`;
        report += `| Period | Preset | Trades | Win Rate | Total Return | Max DD | Profit Factor | Sharpe | Expectancy |\n`;
        report += `|--------|--------|--------|----------|--------------|--------|---------------|---------|------------|\n`;
        
        for (const [periodName, periodResults] of Object.entries(this.results)) {
            for (const preset of this.presets) {
                const result = periodResults[preset.name];
                if (result) {
                    report += `| ${periodName.padEnd(15)} `;
                    report += `| ${preset.name.padEnd(10)} `;
                    report += `| ${result.totalTrades.toString().padStart(6)} `;
                    report += `| ${result.winRate.toFixed(1).padStart(7)}% `;
                    report += `| ${result.totalReturn.toFixed(1).padStart(10)}% `;
                    report += `| ${result.maxDrawdown.toFixed(1).padStart(6)}% `;
                    report += `| ${result.profitFactor.toFixed(2).padStart(13)} `;
                    report += `| ${result.sharpeRatio.toFixed(2).padStart(7)} `;
                    report += `| ${result.expectancy.toFixed(2).padStart(10)} |\n`;
                }
            }
        }

        report += `\n## Period-by-Period Analysis\n\n`;
        
        for (const [periodName, periodResults] of Object.entries(this.results)) {
            const period = this.testPeriods.find(p => p.name === periodName);
            report += `### ${periodName.toUpperCase().replace('_', ' ')}\n`;
            report += `${period.description}\n\n`;
            
            for (const preset of this.presets) {
                const result = periodResults[preset.name];
                if (result) {
                    report += `#### ${preset.name.toUpperCase()}\n`;
                    report += `- **Total Trades:** ${result.totalTrades}\n`;
                    report += `- **Win Rate:** ${result.winRate.toFixed(1)}% (${result.winningTrades}W / ${result.losingTrades}L)\n`;
                    report += `- **Total Return:** ${result.totalReturn.toFixed(1)}%\n`;
                    report += `- **Max Drawdown:** ${result.maxDrawdown.toFixed(1)}%\n`;
                    report += `- **Signals Generated/Executed:** ${result.totalSignalsGenerated}/${result.signalsExecuted} (${result.signalExecutionRate.toFixed(1)}%)\n\n`;
                }
            }
        }

        // Summary findings
        report += `## Key Findings\n\n`;
        
        let bestReturnsByPeriod = {};
        let tradeCountByPeriod = {};
        
        for (const [periodName, periodResults] of Object.entries(this.results)) {
            let bestReturn = -Infinity;
            let bestPreset = '';
            let totalTrades = 0;
            
            for (const [presetName, result] of Object.entries(periodResults)) {
                if (result.totalReturn > bestReturn) {
                    bestReturn = result.totalReturn;
                    bestPreset = presetName;
                }
                totalTrades += result.totalTrades;
            }
            
            bestReturnsByPeriod[periodName] = { preset: bestPreset, return: bestReturn };
            tradeCountByPeriod[periodName] = totalTrades;
        }
        
        report += `### Best Performance by Period:\n`;
        for (const [periodName, best] of Object.entries(bestReturnsByPeriod)) {
            report += `- **${periodName}**: ${best.preset} (${best.return.toFixed(1)}%)\n`;
        }
        
        report += `\n### Trading Activity by Period:\n`;
        for (const [periodName, count] of Object.entries(tradeCountByPeriod)) {
            report += `- **${periodName}**: ${count} total trades\n`;
        }

        await fs.writeFile('./data/backtest/report-focused.md', report);
    }

    async saveResults() {
        await fs.writeFile('./data/backtest/results-focused.json', JSON.stringify(this.results, null, 2));
    }
}

// Run backtest if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const backtest = new FocusedBacktest();
    await backtest.runFocusedBacktest();
}

export default FocusedBacktest;