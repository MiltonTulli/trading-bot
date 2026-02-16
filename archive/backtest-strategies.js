/**
 * Strategy Backtesting System
 * Tests all 6 strategies across all historical periods
 * Finds the most profitable strategy that actually works
 */

import fs from 'fs/promises';
import path from 'path';

// Import all strategies
import TrendFollowingStrategy from './strategies/trend-following.js';
import MeanReversionStrategy from './strategies/mean-reversion.js';
import BreakoutStrategy from './strategies/breakout.js';
import MultiTimeframeMomentumStrategy from './strategies/multi-tf-momentum.js';
import HybridAdaptiveStrategy from './strategies/hybrid-adaptive.js';
import SMAXoverStrategy from './strategies/sma-crossover.js';

class StrategyBacktester {
    constructor() {
        this.strategies = [
            { name: 'trend-following', class: TrendFollowingStrategy, description: 'Trend Following (EMA50/SMA200)' },
            { name: 'mean-reversion', class: MeanReversionStrategy, description: 'Mean Reversion (Bollinger Bands)' },
            { name: 'breakout', class: BreakoutStrategy, description: 'Breakout (Consolidation Range)' },
            { name: 'multi-tf-momentum', class: MultiTimeframeMomentumStrategy, description: 'Multi-Timeframe Momentum' },
            { name: 'hybrid-adaptive', class: HybridAdaptiveStrategy, description: 'Hybrid Adaptive (ADX Regime)' },
            { name: 'sma-crossover', class: SMAXoverStrategy, description: 'EMA 9/21 Crossover' }
        ];

        this.testPeriods = [
            { name: '2021_bull', file: 'BTCUSDT_4h_bull_2021.json', description: '2021 Bull Market' },
            { name: '2022_bear', file: 'BTCUSDT_4h_bear_2022.json', description: '2022 Bear Market' },
            { name: '2023_recovery', file: 'BTCUSDT_4h_recovery_2023.json', description: '2023 Recovery' },
            { name: 'recent', file: 'BTCUSDT_4h_historical.json', description: '2024-2025 Recent' }
        ];

        this.riskLevels = [0.01, 0.02]; // 1% and 2% risk per trade
        this.initialBalance = 10000;
        this.feeRate = 0.001; // 0.1% each way
    }

    async runAllTests() {
        console.log('🚀 Starting comprehensive strategy backtesting...\n');
        
        const allResults = {};
        
        // Test each strategy across all periods and risk levels
        for (const strategyInfo of this.strategies) {
            console.log(`📊 Testing ${strategyInfo.description}...`);
            allResults[strategyInfo.name] = {};
            
            const strategy = new strategyInfo.class();
            
            for (const period of this.testPeriods) {
                console.log(`  📈 Period: ${period.description}`);
                allResults[strategyInfo.name][period.name] = {};
                
                try {
                    const candles = await this.loadHistoricalData(period.file);
                    
                    for (const riskLevel of this.riskLevels) {
                        console.log(`    💰 Risk: ${(riskLevel * 100).toFixed(1)}%`);
                        
                        const result = await this.backtestStrategy(strategy, candles, {
                            riskPerTrade: riskLevel,
                            periodName: period.name,
                            strategyName: strategyInfo.name
                        });
                        
                        allResults[strategyInfo.name][period.name][`risk_${(riskLevel * 100).toFixed(0)}pct`] = result;
                        
                        console.log(`      Return: ${result.totalReturn.toFixed(2)}%, Trades: ${result.totalTrades}, Win Rate: ${result.winRate.toFixed(1)}%`);
                    }
                } catch (error) {
                    console.error(`    ❌ Error testing ${period.description}: ${error.message}`);
                    allResults[strategyInfo.name][period.name] = { error: error.message };
                }
            }
            console.log('');
        }

        // Analyze and rank results
        const analysis = this.analyzeResults(allResults);
        
        // Save results
        await this.saveResults(allResults, analysis);
        
        return { results: allResults, analysis };
    }

    async loadHistoricalData(filename) {
        const filePath = path.join(process.cwd(), 'data', 'backtest', filename);
        const data = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(data);
        
        // Handle different data structures
        if (parsed.candles && Array.isArray(parsed.candles)) {
            // Data structure: { candles: [...] }
            return parsed.candles.map(candle => ({
                timestamp: new Date(candle.openTime).getTime(),
                open: parseFloat(candle.open),
                high: parseFloat(candle.high),
                low: parseFloat(candle.low),
                close: parseFloat(candle.close),
                volume: parseFloat(candle.volume)
            }));
        } else if (Array.isArray(parsed)) {
            // Data structure: [...]
            return parsed.map(candle => ({
                timestamp: candle.timestamp || new Date(candle.openTime).getTime(),
                open: parseFloat(candle.open),
                high: parseFloat(candle.high),
                low: parseFloat(candle.low),
                close: parseFloat(candle.close),
                volume: parseFloat(candle.volume)
            }));
        }
        
        throw new Error(`Unknown data format in ${filename}`);
    }

    async backtestStrategy(strategy, candles, config) {
        // Generate signals
        const signals = strategy.generateSignals(candles, config);
        
        if (signals.length === 0) {
            return {
                totalReturn: 0,
                totalTrades: 0,
                winRate: 0,
                profitFactor: 0,
                maxDrawdown: 0,
                sharpeRatio: 0,
                avgTrade: 0,
                error: 'No signals generated'
            };
        }

        // Simulate trading
        const trades = this.simulateTrades(signals, candles);
        
        // Calculate performance metrics
        return this.calculatePerformance(trades, config);
    }

    simulateTrades(signals, candles) {
        const trades = [];
        const candlesByTimestamp = {};
        
        // Create lookup for faster candle access
        for (const candle of candles) {
            candlesByTimestamp[candle.timestamp] = candle;
        }

        for (const signal of signals) {
            const entryCandle = candlesByTimestamp[signal.timestamp];
            if (!entryCandle) continue;

            // Find exit point
            let exitPrice = null;
            let exitTimestamp = null;
            let exitReason = '';

            // Look for exit conditions in subsequent candles
            const entryIndex = candles.findIndex(c => c.timestamp === signal.timestamp);
            if (entryIndex === -1) continue;

            for (let i = entryIndex + 1; i < candles.length; i++) {
                const candle = candles[i];
                
                // Check stop loss
                if ((signal.type === 'LONG' && candle.low <= signal.stop) ||
                    (signal.type === 'SHORT' && candle.high >= signal.stop)) {
                    exitPrice = signal.stop;
                    exitTimestamp = candle.timestamp;
                    exitReason = 'STOP';
                    break;
                }
                
                // Check target
                if (signal.target) {
                    if ((signal.type === 'LONG' && candle.high >= signal.target) ||
                        (signal.type === 'SHORT' && candle.low <= signal.target)) {
                        exitPrice = signal.target;
                        exitTimestamp = candle.timestamp;
                        exitReason = 'TARGET';
                        break;
                    }
                }
                
                // Exit after 50 candles if no target hit (prevent stuck trades)
                if (i - entryIndex >= 50) {
                    exitPrice = candle.close;
                    exitTimestamp = candle.timestamp;
                    exitReason = 'TIMEOUT';
                    break;
                }
            }

            // If no exit found, use last candle
            if (!exitPrice) {
                const lastCandle = candles[candles.length - 1];
                exitPrice = lastCandle.close;
                exitTimestamp = lastCandle.timestamp;
                exitReason = 'END_OF_DATA';
            }

            // Calculate trade result
            let grossPnL = 0;
            if (signal.type === 'LONG') {
                grossPnL = exitPrice - signal.entry;
            } else {
                grossPnL = signal.entry - exitPrice;
            }

            // Apply fees
            const entryFee = signal.entry * this.feeRate;
            const exitFee = exitPrice * this.feeRate;
            const netPnL = grossPnL - entryFee - exitFee;
            
            const returnPct = (netPnL / signal.entry) * 100;
            const isWin = netPnL > 0;

            trades.push({
                entryTimestamp: signal.timestamp,
                exitTimestamp,
                type: signal.type,
                entry: signal.entry,
                exit: exitPrice,
                stop: signal.stop,
                target: signal.target,
                grossPnL,
                netPnL,
                returnPct,
                isWin,
                exitReason,
                holdingPeriod: this.calculateHoldingPeriod(signal.timestamp, exitTimestamp),
                confidence: signal.confidence,
                reason: signal.reason
            });
        }

        return trades;
    }

    calculatePerformance(trades, config) {
        if (trades.length === 0) {
            return {
                totalReturn: 0,
                totalTrades: 0,
                winRate: 0,
                profitFactor: 0,
                maxDrawdown: 0,
                sharpeRatio: 0,
                avgTrade: 0
            };
        }

        let balance = this.initialBalance;
        let peak = this.initialBalance;
        let maxDrawdown = 0;
        let totalPnL = 0;
        let totalGross = 0;
        let totalLoss = 0;
        let wins = 0;

        const returns = [];
        
        for (const trade of trades) {
            const positionValue = balance * config.riskPerTrade;
            const dollarPnL = (trade.returnPct / 100) * positionValue;
            
            balance += dollarPnL;
            totalPnL += dollarPnL;
            
            if (trade.isWin) {
                wins++;
                totalGross += Math.abs(dollarPnL);
            } else {
                totalLoss += Math.abs(dollarPnL);
            }
            
            // Track drawdown
            if (balance > peak) {
                peak = balance;
            }
            const drawdown = ((peak - balance) / peak) * 100;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
            
            returns.push(trade.returnPct);
        }

        const totalReturn = ((balance - this.initialBalance) / this.initialBalance) * 100;
        const winRate = (wins / trades.length) * 100;
        const profitFactor = totalLoss > 0 ? totalGross / totalLoss : totalGross > 0 ? 999 : 0;
        const avgTrade = totalPnL / trades.length;
        
        // Simple Sharpe ratio approximation
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const returnStd = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
        const sharpeRatio = returnStd > 0 ? avgReturn / returnStd : 0;

        return {
            totalReturn,
            totalTrades: trades.length,
            winRate,
            profitFactor,
            maxDrawdown,
            sharpeRatio,
            avgTrade,
            winningTrades: wins,
            losingTrades: trades.length - wins,
            avgWin: wins > 0 ? totalGross / wins : 0,
            avgLoss: (trades.length - wins) > 0 ? totalLoss / (trades.length - wins) : 0,
            trades: trades.slice(0, 10) // Include first 10 trades for analysis
        };
    }

    calculateHoldingPeriod(entryTimestamp, exitTimestamp) {
        return Math.floor((exitTimestamp - entryTimestamp) / (1000 * 60 * 60 * 4)); // 4-hour periods
    }

    analyzeResults(allResults) {
        const analysis = {
            summary: {},
            rankings: [],
            profitable: [],
            criteria: {
                minPositiveReturns: 3, // out of 4 periods
                minWinRate: 45,
                minProfitFactor: 1.3,
                minTradesPerPeriod: 20
            }
        };

        // Analyze each strategy
        for (const [strategyName, strategyResults] of Object.entries(allResults)) {
            const strategyAnalysis = {
                name: strategyName,
                description: this.strategies.find(s => s.name === strategyName)?.description || strategyName,
                periodResults: {},
                avgMetrics: {},
                meetsCriteria: false,
                score: 0
            };

            let totalPeriods = 0;
            let positivePeriods = 0;
            let avgReturn = 0;
            let avgWinRate = 0;
            let avgProfitFactor = 0;
            let avgTrades = 0;

            for (const [periodName, periodResults] of Object.entries(strategyResults)) {
                if (periodResults.error) continue;

                // Use 2% risk results for main analysis (more realistic)
                const result = periodResults.risk_2pct || periodResults.risk_1pct;
                if (!result) continue;

                strategyAnalysis.periodResults[periodName] = result;
                
                totalPeriods++;
                if (result.totalReturn > 0) positivePeriods++;
                
                avgReturn += result.totalReturn;
                avgWinRate += result.winRate;
                avgProfitFactor += result.profitFactor;
                avgTrades += result.totalTrades;
            }

            if (totalPeriods > 0) {
                strategyAnalysis.avgMetrics = {
                    avgReturn: avgReturn / totalPeriods,
                    avgWinRate: avgWinRate / totalPeriods,
                    avgProfitFactor: avgProfitFactor / totalPeriods,
                    avgTrades: avgTrades / totalPeriods,
                    positivePeriods,
                    totalPeriods
                };

                // Check if meets criteria
                const meetsReturnCriteria = positivePeriods >= analysis.criteria.minPositiveReturns;
                const meetsWinRateCriteria = strategyAnalysis.avgMetrics.avgWinRate >= analysis.criteria.minWinRate;
                const meetsProfitFactorCriteria = strategyAnalysis.avgMetrics.avgProfitFactor >= analysis.criteria.minProfitFactor;
                const meetsTradesCriteria = strategyAnalysis.avgMetrics.avgTrades >= analysis.criteria.minTradesPerPeriod;

                strategyAnalysis.meetsCriteria = meetsReturnCriteria && meetsWinRateCriteria && 
                                                meetsProfitFactorCriteria && meetsTradesCriteria;

                // Calculate score
                strategyAnalysis.score = 
                    (positivePeriods / totalPeriods) * 40 +
                    Math.max(0, Math.min(strategyAnalysis.avgMetrics.avgReturn / 5, 20)) +
                    Math.max(0, Math.min((strategyAnalysis.avgMetrics.avgWinRate - 40) / 2, 20)) +
                    Math.max(0, Math.min((strategyAnalysis.avgMetrics.avgProfitFactor - 1) * 20, 20));

                if (strategyAnalysis.meetsCriteria) {
                    analysis.profitable.push(strategyAnalysis);
                }
            }

            analysis.summary[strategyName] = strategyAnalysis;
        }

        // Rank all strategies by score
        analysis.rankings = Object.values(analysis.summary)
            .filter(s => s.avgMetrics.totalPeriods > 0)
            .sort((a, b) => b.score - a.score);

        // Sort profitable strategies
        analysis.profitable.sort((a, b) => b.score - a.score);

        return analysis;
    }

    async saveResults(allResults, analysis) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Save raw results
        const resultsPath = path.join(process.cwd(), 'data', 'backtest', 'strategy-comparison.json');
        await fs.writeFile(resultsPath, JSON.stringify(allResults, null, 2));
        
        // Generate and save report
        const report = this.generateReport(analysis);
        const reportPath = path.join(process.cwd(), 'data', 'backtest', 'strategy-report.md');
        await fs.writeFile(reportPath, report);
        
        console.log(`📄 Results saved to: ${resultsPath}`);
        console.log(`📊 Report saved to: ${reportPath}`);
    }

    generateReport(analysis) {
        let report = `# Trading Strategy Backtesting Report\n\n`;
        report += `Generated: ${new Date().toISOString()}\n\n`;
        
        // Executive Summary
        report += `## Executive Summary\n\n`;
        
        if (analysis.profitable.length > 0) {
            report += `✅ **PROFITABLE STRATEGIES FOUND: ${analysis.profitable.length}**\n\n`;
            report += `**TOP PERFORMER:** ${analysis.profitable[0].description}\n`;
            report += `- Average Return: ${analysis.profitable[0].avgMetrics.avgReturn.toFixed(2)}%\n`;
            report += `- Win Rate: ${analysis.profitable[0].avgMetrics.avgWinRate.toFixed(1)}%\n`;
            report += `- Profit Factor: ${analysis.profitable[0].avgMetrics.avgProfitFactor.toFixed(2)}\n`;
            report += `- Positive Periods: ${analysis.profitable[0].avgMetrics.positivePeriods}/${analysis.profitable[0].avgMetrics.totalPeriods}\n\n`;
        } else {
            report += `❌ **NO PROFITABLE STRATEGIES FOUND**\n\n`;
            report += `All strategies failed to meet the success criteria:\n`;
            report += `- Positive returns in at least ${analysis.criteria.minPositiveReturns} of 4 periods\n`;
            report += `- Win rate > ${analysis.criteria.minWinRate}%\n`;
            report += `- Profit factor > ${analysis.criteria.minProfitFactor}\n`;
            report += `- At least ${analysis.criteria.minTradesPerPeriod} trades per period\n\n`;
        }

        // Strategy Rankings Table
        report += `## Strategy Rankings\n\n`;
        report += `| Rank | Strategy | Avg Return | Win Rate | Profit Factor | Positive Periods | Score | Meets Criteria |\n`;
        report += `|------|----------|------------|----------|---------------|------------------|-------|----------------|\n`;
        
        analysis.rankings.forEach((strategy, index) => {
            const rank = index + 1;
            const avgReturn = strategy.avgMetrics.avgReturn.toFixed(2);
            const winRate = strategy.avgMetrics.avgWinRate.toFixed(1);
            const profitFactor = strategy.avgMetrics.avgProfitFactor.toFixed(2);
            const positivePeriods = `${strategy.avgMetrics.positivePeriods}/${strategy.avgMetrics.totalPeriods}`;
            const score = strategy.score.toFixed(1);
            const meetsCriteria = strategy.meetsCriteria ? '✅' : '❌';
            
            report += `| ${rank} | ${strategy.description} | ${avgReturn}% | ${winRate}% | ${profitFactor} | ${positivePeriods} | ${score} | ${meetsCriteria} |\n`;
        });

        // Detailed Results by Period
        report += `\n## Detailed Results by Market Period\n\n`;
        
        for (const period of this.testPeriods) {
            report += `### ${period.description}\n\n`;
            report += `| Strategy | Return (2%) | Win Rate | Profit Factor | Total Trades | Max DD |\n`;
            report += `|----------|-------------|----------|---------------|--------------|--------|\n`;
            
            for (const strategy of analysis.rankings) {
                const result = strategy.periodResults[period.name];
                if (result && !result.error) {
                    const totalReturn = result.totalReturn.toFixed(2);
                    const winRate = result.winRate.toFixed(1);
                    const profitFactor = result.profitFactor.toFixed(2);
                    const totalTrades = result.totalTrades;
                    const maxDD = result.maxDrawdown.toFixed(2);
                    
                    report += `| ${strategy.description} | ${totalReturn}% | ${winRate}% | ${profitFactor} | ${totalTrades} | ${maxDD}% |\n`;
                } else {
                    report += `| ${strategy.description} | ERROR | - | - | - | - |\n`;
                }
            }
            report += `\n`;
        }

        // Recommendations
        report += `## Recommendations\n\n`;
        
        if (analysis.profitable.length > 0) {
            report += `### 🎯 IMPLEMENT THESE STRATEGIES:\n\n`;
            analysis.profitable.slice(0, 2).forEach((strategy, index) => {
                report += `**${index + 1}. ${strategy.description}**\n`;
                report += `- Score: ${strategy.score.toFixed(1)}/100\n`;
                report += `- Average Return: ${strategy.avgMetrics.avgReturn.toFixed(2)}%\n`;
                report += `- Win Rate: ${strategy.avgMetrics.avgWinRate.toFixed(1)}%\n`;
                report += `- Profit Factor: ${strategy.avgMetrics.avgProfitFactor.toFixed(2)}\n`;
                report += `- Consistent across ${strategy.avgMetrics.positivePeriods}/${strategy.avgMetrics.totalPeriods} periods\n\n`;
            });
        } else {
            report += `### 🚨 NEXT STEPS - NO PROFITABLE STRATEGIES:\n\n`;
            report += `Since no strategy met our profitability criteria, consider:\n\n`;
            report += `1. **Market Reality Check**: Crypto markets may not provide consistent edge with pure technical indicators\n`;
            report += `2. **Lower Expectations**: Reduce criteria (e.g., 2/4 positive periods instead of 3/4)\n`;
            report += `3. **Combine with Fundamentals**: Add macro, sentiment, or on-chain data\n`;
            report += `4. **Different Assets**: Test on different crypto pairs or traditional assets\n`;
            report += `5. **Alternative Approaches**: Consider ML, news sentiment, or arbitrage strategies\n\n`;
            
            // Show best performing strategy even if it doesn't meet criteria
            if (analysis.rankings.length > 0) {
                const best = analysis.rankings[0];
                report += `**BEST OF BAD OPTIONS:** ${best.description}\n`;
                report += `- Still had ${best.avgMetrics.avgReturn.toFixed(2)}% average return\n`;
                report += `- ${best.avgMetrics.positivePeriods}/${best.avgMetrics.totalPeriods} positive periods\n`;
                report += `- Could be refined or used in combination with others\n\n`;
            }
        }

        // Technical Notes
        report += `## Technical Notes\n\n`;
        report += `- **Risk Level**: 2% per trade (realistic for crypto volatility)\n`;
        report += `- **Fees**: 0.1% per side (0.2% round-trip)\n`;
        report += `- **Execution**: Next candle open (realistic, no look-ahead bias)\n`;
        report += `- **Data**: 4H BTCUSDT across bull, bear, recovery, and recent periods\n`;
        report += `- **Exit Logic**: Stop loss, target, or 50-bar timeout\n\n`;
        
        report += `---\n\n`;
        report += `*This report was generated by the automated strategy backtesting system.*\n`;
        
        return report;
    }
}

// Main execution
async function main() {
    try {
        const backtester = new StrategyBacktester();
        const results = await backtester.runAllTests();
        
        console.log('\n🎯 BACKTESTING COMPLETE!');
        console.log(`\n📊 Summary:`);
        console.log(`   Strategies tested: ${Object.keys(results.analysis.summary).length}`);
        console.log(`   Profitable strategies: ${results.analysis.profitable.length}`);
        console.log(`   Best strategy: ${results.analysis.rankings[0]?.description || 'None'}`);
        
        if (results.analysis.profitable.length > 0) {
            console.log(`\n✅ SUCCESS! Found ${results.analysis.profitable.length} profitable strategies.`);
            console.log(`   Top performer: ${results.analysis.profitable[0].description}`);
            console.log(`   Average return: ${results.analysis.profitable[0].avgMetrics.avgReturn.toFixed(2)}%`);
        } else {
            console.log(`\n❌ No strategies met profitability criteria.`);
            console.log(`   Best performer: ${results.analysis.rankings[0]?.description || 'None'}`);
        }
        
    } catch (error) {
        console.error('❌ Backtesting failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default StrategyBacktester;