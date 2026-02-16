/**
 * Backtest v2 - Multiple Presets Testing System
 * Tests all 6 presets across different market periods
 */

import fs from 'fs/promises';
import TechnicalIndicators from './indicators/index.js';
import SignalGenerator from './signals/generator.js';
import PaperTradingEngine from './paper/engine.js';

class BacktestV2 {
    constructor() {
        this.indicators = new TechnicalIndicators();
        this.results = {};
        
        // Define the 6 presets to test - OPTIMIZED v2.1
        this.presets = [
            {
                name: 'ultra_conservative',
                description: '3+ confirmations, R:R 3:1, risk 1%',
                config: { 
                    preset: 'ultra_conservative',
                    paperBalance: 10000,
                    riskPerTrade: 0.01,
                    maxPortfolioHeat: 0.05 // Allow 5% total risk
                }
            },
            {
                name: 'conservative',
                description: '3+ confirmations, R:R 2.5:1, risk 1.5%',
                config: { 
                    preset: 'conservative',
                    paperBalance: 10000,
                    riskPerTrade: 0.015,
                    maxPortfolioHeat: 0.06 // Allow 6% total risk
                }
            },
            {
                name: 'balanced',
                description: '2+ confirmations, R:R 2:1, risk 1.5%',
                config: { 
                    preset: 'balanced',
                    paperBalance: 10000,
                    riskPerTrade: 0.015,
                    maxPortfolioHeat: 0.08 // Allow 8% total risk
                }
            },
            {
                name: 'active',
                description: '2+ confirmations, R:R 1.5:1, risk 2%',
                config: { 
                    preset: 'active',
                    paperBalance: 10000,
                    riskPerTrade: 0.02,
                    maxPortfolioHeat: 0.10 // Allow 10% total risk
                }
            },
            {
                name: 'aggressive',
                description: '1+ confirmation high confidence, R:R 1.5:1, risk 2%',
                config: { 
                    preset: 'aggressive',
                    paperBalance: 10000,
                    riskPerTrade: 0.02,
                    maxPortfolioHeat: 0.12 // Allow 12% total risk
                }
            },
            {
                name: 'scalper',
                description: 'confidence > 50%, R:R 1.2:1, risk 2.5%, every 1h',
                config: { 
                    preset: 'scalper',
                    paperBalance: 10000,
                    riskPerTrade: 0.025,
                    maxPortfolioHeat: 0.15 // Allow 15% total risk
                }
            }
        ];

        // Define test periods
        this.testPeriods = [
            {
                name: 'recent_6months',
                description: 'Recent 6 months (Aug 2025 - Feb 2026)',
                files: [
                    './data/backtest/BTCUSDT_4h_historical.json',
                    './data/backtest/ETHUSDT_4h_historical.json'
                ],
                startIndex: -1000, // Last ~6 months of 4h candles
                endIndex: -1
            },
            {
                name: 'bear_2022',
                description: 'Bear Market 2022 (Jan-Jun): BTC $47K → $19K',
                files: [
                    './data/backtest/BTCUSDT_4h_bear_2022.json'
                ],
                startIndex: 0,
                endIndex: -1
            },
            {
                name: 'bull_2021', 
                description: 'Bull Market 2021 (Jan-Jun): BTC $29K → $35K',
                files: [
                    './data/backtest/BTCUSDT_4h_bull_2021.json'
                ],
                startIndex: 0,
                endIndex: -1
            },
            {
                name: 'recovery_2023',
                description: 'Recovery 2023 (Jan-Jun): BTC $16K → $30K',
                files: [
                    './data/backtest/BTCUSDT_4h_recovery_2023.json'
                ],
                startIndex: 0,
                endIndex: -1
            }
        ];
    }

    async runAllBacktests() {
        console.log('🚀 BACKTEST v2 - COMPREHENSIVE PRESET TESTING');
        console.log('='.repeat(60));
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

        // Generate and save comprehensive report
        await this.generateReport();
        await this.saveResults();

        console.log('\n✅ Backtest v2 completed successfully!');
        console.log('📄 Report saved to ./data/backtest/report-v2.md');
        console.log('📊 Data saved to ./data/backtest/results-v2.json');
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

                // Run backtest on this symbol/period
                for (let i = 200; i < periodCandles.length - 1; i++) {
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

                        // Update positions with next candle price (simulate next bar)
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
                    if (i % 100 === 0) {
                        const progress = ((i - 200) / (periodCandles.length - 201)) * 100;
                        process.stdout.write(`\r     Progress: ${progress.toFixed(1)}% (${signalsExecuted} trades)`);
                    }
                }

                console.log(`\r     ${symbol} complete: ${signalsExecuted} trades executed`);

            } catch (error) {
                console.error(`     ❌ Error processing ${dataFile}:`, error.message);
            }
        }

        // Get final results
        const performance = paperEngine.getPerformanceMetrics();
        const finalPositions = paperEngine.getCurrentPositions();
        const recentTrades = paperEngine.getRecentTrades(20);

        return {
            preset: preset.name,
            description: preset.description,
            period: period.name,
            analysisPoints,
            totalSignalsGenerated,
            signalsExecuted,
            signalExecutionRate: totalSignalsGenerated > 0 ? (signalsExecuted / totalSignalsGenerated) * 100 : 0,
            
            // Performance metrics
            totalEquity: performance.totalEquity,
            totalReturn: performance.totalReturn,
            totalTrades: performance.totalTrades,
            winningTrades: performance.winningTrades,
            losingTrades: performance.losingTrades,
            winRate: performance.winRate,
            profitFactor: performance.profitFactor,
            avgWin: performance.avgWin,
            avgLoss: performance.avgLoss,
            expectancy: performance.expectancy,
            maxDrawdown: performance.maxDrawdown,
            sharpeRatio: performance.sharpeRatio,
            openPositions: performance.openPositions,
            portfolioHeat: performance.portfolioHeat,
            maxConsecutiveLosses: performance.maxConsecutiveLosses,
            avgRiskPerTrade: performance.avgRiskPerTrade,

            // Additional data
            finalPositions,
            recentTrades,
            startDate: period.files.length > 0 ? 'calculated' : 'unknown',
            endDate: period.files.length > 0 ? 'calculated' : 'unknown'
        };
    }

    async generateReport() {
        let report = `# Backtest v2 Report - Preset Comparison\n\n`;
        report += `Generated: ${new Date().toISOString()}\n`;
        report += `Testing ${this.presets.length} presets across ${this.testPeriods.length} periods\n\n`;

        // Summary table for each period
        for (const [periodName, periodResults] of Object.entries(this.results)) {
            report += `## ${periodName.replace('_', ' ').toUpperCase()}\n\n`;
            
            // Performance comparison table
            report += `| Preset | Trades | Win Rate | Total Return | Max DD | Profit Factor | Sharpe | Expectancy |\n`;
            report += `|--------|--------|----------|--------------|--------|---------------|---------|------------|\n`;
            
            for (const preset of this.presets) {
                const result = periodResults[preset.name];
                if (result) {
                    report += `| ${preset.name.padEnd(15)} `;
                    report += `| ${result.totalTrades.toString().padStart(6)} `;
                    report += `| ${result.winRate.toFixed(1).padStart(7)}% `;
                    report += `| ${result.totalReturn.toFixed(1).padStart(10)}% `;
                    report += `| ${result.maxDrawdown.toFixed(1).padStart(6)}% `;
                    report += `| ${result.profitFactor.toFixed(2).padStart(13)} `;
                    report += `| ${result.sharpeRatio.toFixed(2).padStart(7)} `;
                    report += `| ${result.expectancy.toFixed(2).padStart(10)} |\n`;
                }
            }
            
            report += `\n`;

            // Detailed results for each preset
            report += `### Detailed Results\n\n`;
            for (const preset of this.presets) {
                const result = periodResults[preset.name];
                if (result) {
                    report += `#### ${preset.name.toUpperCase()}\n`;
                    report += `${preset.description}\n\n`;
                    report += `- **Signals Generated:** ${result.totalSignalsGenerated}\n`;
                    report += `- **Signals Executed:** ${result.signalsExecuted} (${result.signalExecutionRate.toFixed(1)}%)\n`;
                    report += `- **Total Trades:** ${result.totalTrades}\n`;
                    report += `- **Win Rate:** ${result.winRate.toFixed(1)}% (${result.winningTrades}W / ${result.losingTrades}L)\n`;
                    report += `- **Total Return:** ${result.totalReturn.toFixed(1)}% ($${(result.totalEquity - 10000).toFixed(0)} profit)\n`;
                    report += `- **Max Drawdown:** ${result.maxDrawdown.toFixed(1)}%\n`;
                    report += `- **Profit Factor:** ${result.profitFactor.toFixed(2)}\n`;
                    report += `- **Avg Win/Loss:** $${result.avgWin.toFixed(0)} / $${result.avgLoss.toFixed(0)}\n`;
                    report += `- **Expectancy:** $${result.expectancy.toFixed(2)} per trade\n`;
                    report += `- **Sharpe Ratio:** ${result.sharpeRatio.toFixed(2)}\n`;
                    report += `- **Max Consecutive Losses:** ${result.maxConsecutiveLosses}\n`;
                    report += `- **Avg Risk Per Trade:** ${result.avgRiskPerTrade.toFixed(1)}%\n`;
                    
                    if (result.recentTrades.length > 0) {
                        report += `\n**Recent Trades (last 5):**\n`;
                        result.recentTrades.slice(0, 5).forEach((trade, idx) => {
                            const pnlSymbol = trade.returnPercent > 0 ? '✅' : '❌';
                            report += `${idx + 1}. ${pnlSymbol} ${trade.symbol} ${trade.direction} ${trade.returnPercent.toFixed(1)}% (${trade.exitReason})\n`;
                        });
                    }
                    
                    report += `\n`;
                }
            }
        }

        // Analysis and Recommendations
        report += `## Analysis & Recommendations\n\n`;
        
        // Find best performing presets by different metrics
        let bestReturn = { preset: '', return: -Infinity };
        let bestSharpe = { preset: '', sharpe: -Infinity };
        let bestWinRate = { preset: '', winRate: 0 };
        let mostTrades = { preset: '', trades: 0 };
        
        for (const [periodName, periodResults] of Object.entries(this.results)) {
            for (const [presetName, result] of Object.entries(periodResults)) {
                if (result.totalReturn > bestReturn.return) {
                    bestReturn = { preset: presetName, return: result.totalReturn };
                }
                if (result.sharpeRatio > bestSharpe.sharpe) {
                    bestSharpe = { preset: presetName, sharpe: result.sharpeRatio };
                }
                if (result.winRate > bestWinRate.winRate) {
                    bestWinRate = { preset: presetName, winRate: result.winRate };
                }
                if (result.totalTrades > mostTrades.trades) {
                    mostTrades = { preset: presetName, trades: result.totalTrades };
                }
            }
        }

        report += `### Key Findings\n\n`;
        report += `- **Best Total Return:** ${bestReturn.preset} (${bestReturn.return.toFixed(1)}%)\n`;
        report += `- **Best Risk-Adjusted Return:** ${bestSharpe.preset} (Sharpe: ${bestSharpe.sharpe.toFixed(2)})\n`;
        report += `- **Highest Win Rate:** ${bestWinRate.preset} (${bestWinRate.winRate.toFixed(1)}%)\n`;
        report += `- **Most Active:** ${mostTrades.preset} (${mostTrades.trades} trades)\n\n`;

        // Trading frequency analysis
        report += `### Trading Frequency Analysis\n\n`;
        for (const [periodName, periodResults] of Object.entries(this.results)) {
            report += `**${periodName}** - Trades per preset:\n`;
            for (const preset of this.presets) {
                const result = periodResults[preset.name];
                if (result && result.totalTrades >= 10) {
                    report += `✅ ${preset.name}: ${result.totalTrades} trades (SUFFICIENT)\n`;
                } else if (result) {
                    report += `⚠️  ${preset.name}: ${result.totalTrades} trades (TOO FEW)\n`;
                } else {
                    report += `❌ ${preset.name}: No data\n`;
                }
            }
        }

        await fs.writeFile('./data/backtest/report-v2.md', report);
    }

    async saveResults() {
        await fs.writeFile('./data/backtest/results-v2.json', JSON.stringify(this.results, null, 2));
    }

    // Utility method to download additional periods (placeholder)
    async downloadAdditionalPeriods() {
        console.log('📥 Additional period download would be implemented here');
        console.log('   - Bear 2022: Jan-Jun 2022 (BTC $47K → $19K)');
        console.log('   - Bull 2021: Jan-Jun 2021 (BTC $29K → $35K)');
        console.log('   - Recovery 2023: Jan-Jun 2023 (BTC $16K → $30K)');
        console.log('   This would use Binance API to fetch BTCUSDT 4h candles');
    }
}

// Run backtest if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const backtest = new BacktestV2();
    await backtest.runAllBacktests();
}