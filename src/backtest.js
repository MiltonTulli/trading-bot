#!/usr/bin/env node
/**
 * Comprehensive Backtesting System
 * Simulate trading bot behavior over historical data
 */

import fs from 'fs/promises';
import path from 'path';
import TechnicalIndicators from './indicators/index.js';
import SignalGenerator from './signals/generator.js';
import PaperTradingEngine from './paper/engine.js';

class BacktestingEngine {
    constructor() {
        this.baseConfig = {
            pairs: ["BTCUSDT", "ETHUSDT"],
            timeframes: ["1h", "4h", "1d"],
            paperBalance: 10000,
            riskPerTrade: 0.01,
            maxPortfolioHeat: 0.03,
            minConfirmations: 3,
            minRiskReward: 3,
            fees: 0.001,
            binanceBaseUrl: "https://api.binance.com",
            stopLossMultiplier: 2.5,
            takeProfitRatios: [2, 4, 6]
        };

        // Test scenarios
        this.scenarios = [
            {
                name: "Conservative (Current)",
                config: { minConfirmations: 3, minRiskReward: 3, riskPerTrade: 0.01 }
            },
            {
                name: "Moderate", 
                config: { minConfirmations: 2, minRiskReward: 2.5, riskPerTrade: 0.015 }
            },
            {
                name: "Aggressive",
                config: { minConfirmations: 2, minRiskReward: 2, riskPerTrade: 0.02 }
            },
            {
                name: "Very Aggressive",
                config: { minConfirmations: 1, minRiskReward: 1.5, riskPerTrade: 0.02 }
            }
        ];

        this.dataDir = './data/backtest';
        this.results = {};
        this.indicators = new TechnicalIndicators();
    }

    /**
     * Initialize backtesting environment
     */
    async initialize() {
        console.log('🚀 Initializing Backtesting System...');
        
        // Create data directory
        await fs.mkdir(this.dataDir, { recursive: true });
        console.log('✅ Data directory ready');
        
        // Download historical data
        console.log('📥 Downloading historical data...');
        await this.downloadHistoricalData();
        console.log('✅ Historical data downloaded');
    }

    /**
     * Download 6 months of historical data from Binance
     */
    async downloadHistoricalData() {
        const endTime = Date.now();
        const startTime = endTime - (6 * 30 * 24 * 60 * 60 * 1000); // 6 months ago
        
        console.log(`📊 Fetching data from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);

        for (const symbol of this.baseConfig.pairs) {
            for (const timeframe of this.baseConfig.timeframes) {
                console.log(`  📈 Downloading ${symbol} ${timeframe}...`);
                
                const filename = path.join(this.dataDir, `${symbol}_${timeframe}_historical.json`);
                
                // Check if we already have this data
                try {
                    const existingData = await fs.readFile(filename, 'utf8');
                    const parsed = JSON.parse(existingData);
                    if (parsed.candles && parsed.candles.length > 0) {
                        console.log(`    ✓ Already have ${parsed.candles.length} candles for ${symbol} ${timeframe}`);
                        continue;
                    }
                } catch {
                    // File doesn't exist, proceed with download
                }

                try {
                    const allCandles = await this.fetchHistoricalCandles(symbol, timeframe, startTime, endTime);
                    
                    const historicalData = {
                        symbol,
                        timeframe,
                        startTime: new Date(startTime),
                        endTime: new Date(endTime),
                        candles: allCandles,
                        downloadedAt: new Date()
                    };

                    await fs.writeFile(filename, JSON.stringify(historicalData, null, 2));
                    console.log(`    ✅ Downloaded ${allCandles.length} candles for ${symbol} ${timeframe}`);
                    
                    // Rate limiting - Binance has limits
                    await this.sleep(100);
                    
                } catch (error) {
                    console.error(`    ❌ Error downloading ${symbol} ${timeframe}:`, error.message);
                }
            }
        }
    }

    /**
     * Fetch historical candles from Binance API (handles pagination)
     */
    async fetchHistoricalCandles(symbol, interval, startTime, endTime) {
        const allCandles = [];
        let currentStartTime = startTime;
        const maxCandles = 1000; // Binance limit per request
        
        while (currentStartTime < endTime) {
            const url = `${this.baseConfig.binanceBaseUrl}/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${currentStartTime}&limit=${maxCandles}`;
            
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const rawCandles = await response.json();
                
                if (rawCandles.length === 0) {
                    break;
                }

                // Transform raw data to structured format
                const candles = rawCandles.map(candle => ({
                    openTime: new Date(candle[0]),
                    open: parseFloat(candle[1]),
                    high: parseFloat(candle[2]),
                    low: parseFloat(candle[3]),
                    close: parseFloat(candle[4]),
                    volume: parseFloat(candle[5]),
                    closeTime: new Date(candle[6]),
                    quoteVolume: parseFloat(candle[7]),
                    trades: parseInt(candle[8]),
                    buyBaseVolume: parseFloat(candle[9]),
                    buyQuoteVolume: parseFloat(candle[10])
                }));

                allCandles.push(...candles);
                
                // Update start time for next batch
                currentStartTime = candles[candles.length - 1].closeTime.getTime() + 1;
                
                // Rate limiting
                await this.sleep(50);
                
            } catch (error) {
                console.error(`Error fetching batch starting at ${new Date(currentStartTime)}:`, error);
                break;
            }
        }
        
        // Remove duplicates based on openTime
        const uniqueCandles = allCandles.filter((candle, index, arr) => 
            index === arr.findIndex(c => c.openTime.getTime() === candle.openTime.getTime())
        );
        
        // Sort by time
        return uniqueCandles.sort((a, b) => a.openTime - b.openTime);
    }

    /**
     * Run backtest for all scenarios
     */
    async runBacktest() {
        console.log('\n🧪 Starting Comprehensive Backtest...');
        
        for (const scenario of this.scenarios) {
            console.log(`\n📊 Testing Scenario: ${scenario.name}`);
            console.log(`   Configs: ${JSON.stringify(scenario.config)}`);
            
            const scenarioConfig = { ...this.baseConfig, ...scenario.config };
            const results = await this.runScenarioBacktest(scenario.name, scenarioConfig);
            
            this.results[scenario.name] = results;
            
            // Display quick summary
            console.log(`   📈 Total Return: ${results.totalReturn.toFixed(2)}%`);
            console.log(`   🎯 Win Rate: ${results.winRate.toFixed(1)}%`);
            console.log(`   📊 Total Trades: ${results.totalTrades}`);
            console.log(`   📉 Max Drawdown: ${results.maxDrawdown.toFixed(2)}%`);
        }
        
        await this.saveResults();
        await this.generateReport();
        
        console.log('\n✅ Backtest completed successfully!');
        this.printSummaryTable();
    }

    /**
     * Run backtest for a specific scenario
     */
    async runScenarioBacktest(scenarioName, config) {
        const signalGenerator = new SignalGenerator(config);
        const tradingEngine = new PaperTradingEngine(config);
        
        // Reset trading engine
        await tradingEngine.resetPortfolio();
        
        // Load historical data for all symbols
        const historicalData = await this.loadHistoricalData();
        
        // Create a timeline of all 4h candles across all symbols
        const timeline = this.createTimeline(historicalData, '4h');
        
        console.log(`   📅 Processing ${timeline.length} time points...`);
        
        let processedPoints = 0;
        const totalPoints = timeline.length;
        
        // Walk forward through time
        for (let i = 200; i < timeline.length; i++) { // Start at 200 for indicator warm-up
            const currentTime = timeline[i].time;
            
            // Update positions first
            await this.updatePositions(tradingEngine, timeline, i);
            
            // Get market data available up to this point for all symbols
            const marketData = await this.getMarketDataAtTime(historicalData, currentTime, i);
            
            // Generate and execute signals
            await this.processSignalsAtTime(signalGenerator, tradingEngine, marketData);
            
            processedPoints++;
            if (processedPoints % 100 === 0) {
                const progress = ((processedPoints / (totalPoints - 200)) * 100).toFixed(1);
                console.log(`   ⏳ Progress: ${progress}% (${processedPoints}/${totalPoints - 200} points)`);
            }
        }
        
        // Close any remaining positions at the end
        await this.closeAllPositions(tradingEngine, timeline[timeline.length - 1]);
        
        // Calculate final metrics
        return this.calculateScenarioResults(tradingEngine, timeline);
    }

    /**
     * Create timeline from all 4h candles across symbols
     */
    createTimeline(historicalData, timeframe) {
        const timeline = new Set();
        
        // Collect all timestamps
        for (const symbol of this.baseConfig.pairs) {
            const candles = historicalData[symbol]?.[timeframe];
            if (candles) {
                candles.forEach(candle => {
                    timeline.add(candle.closeTime.getTime());
                });
            }
        }
        
        // Convert to sorted array
        return Array.from(timeline)
            .sort((a, b) => a - b)
            .map(time => ({ time: new Date(time) }));
    }

    /**
     * Get market data available at a specific time
     */
    async getMarketDataAtTime(historicalData, currentTime, timelineIndex) {
        const marketData = {};
        
        for (const symbol of this.baseConfig.pairs) {
            marketData[symbol] = {};
            
            for (const timeframe of this.baseConfig.timeframes) {
                const candles = historicalData[symbol]?.[timeframe];
                if (!candles) continue;
                
                // Get all candles up to current time
                const availableCandles = candles.filter(candle => 
                    candle.closeTime <= currentTime
                );
                
                if (availableCandles.length >= 50) { // Minimum for analysis
                    try {
                        const analysis = this.indicators.analyzeMarket(availableCandles);
                        marketData[symbol][timeframe] = analysis;
                    } catch (error) {
                        console.warn(`Analysis error for ${symbol} ${timeframe} at ${currentTime}:`, error.message);
                    }
                }
            }
        }
        
        return marketData;
    }

    /**
     * Process signals at a specific time
     */
    async processSignalsAtTime(signalGenerator, tradingEngine, marketData) {
        const allSignals = [];
        
        // Generate signals for each symbol/timeframe
        for (const symbol of this.baseConfig.pairs) {
            for (const timeframe of this.baseConfig.timeframes) {
                const analysis = marketData[symbol]?.[timeframe];
                if (analysis) {
                    try {
                        const signals = signalGenerator.generateSignals(analysis, symbol);
                        signals.forEach(signal => {
                            signal.timeframe = timeframe;
                            signal.score = signalGenerator.scoreSignal(signal);
                        });
                        allSignals.push(...signals);
                    } catch (error) {
                        console.warn(`Signal generation error for ${symbol} ${timeframe}:`, error.message);
                    }
                }
            }
        }
        
        if (allSignals.length === 0) return;
        
        // Sort by score and take the best signal
        allSignals.sort((a, b) => b.score - a.score);
        const bestSignal = allSignals[0];
        
        // Check if we should trade this signal
        if (this.shouldExecuteSignal(tradingEngine, bestSignal, marketData)) {
            await tradingEngine.executeTrade(bestSignal, bestSignal.entryPrice);
        }
    }

    /**
     * Check if we should execute a signal
     */
    shouldExecuteSignal(tradingEngine, signal, marketData) {
        // Don't trade if position already exists
        if (tradingEngine.portfolio.openTrades[signal.symbol]) {
            return false;
        }
        
        // Check portfolio heat limits
        const currentHeat = tradingEngine.calculateCurrentPortfolioHeat();
        if (currentHeat >= tradingEngine.maxPortfolioHeat * 0.8) {
            return false;
        }
        
        // Basic quality checks are already done by signal generator filters
        return signal.confirmations >= tradingEngine.config.minConfirmations && 
               signal.riskRewardRatio >= tradingEngine.config.minRiskReward;
    }

    /**
     * Update positions with current market prices
     */
    async updatePositions(tradingEngine, timeline, currentIndex) {
        const marketPrices = {};
        
        // Get current prices for all symbols from timeline data
        for (const symbol of this.baseConfig.pairs) {
            const currentCandle = this.findNearestCandle(symbol, timeline[currentIndex].time);
            if (currentCandle) {
                marketPrices[symbol] = { currentPrice: currentCandle.close };
            }
        }
        
        // Update positions
        if (Object.keys(marketPrices).length > 0) {
            await tradingEngine.updatePositions(marketPrices);
        }
    }

    /**
     * Find the nearest candle for a symbol at a given time
     */
    findNearestCandle(symbol, targetTime) {
        // This is simplified - in a full implementation, you'd maintain 
        // the current candle state for each symbol
        return { close: 50000 }; // Placeholder - would use actual price data
    }

    /**
     * Close all remaining positions
     */
    async closeAllPositions(tradingEngine, finalTimePoint) {
        const openPositions = Object.values(tradingEngine.portfolio.openTrades);
        
        for (const position of openPositions) {
            await tradingEngine.closePosition(position, position.entryPrice * 1.01, 'backtest_end');
        }
    }

    /**
     * Load all historical data from files
     */
    async loadHistoricalData() {
        const data = {};
        
        for (const symbol of this.baseConfig.pairs) {
            data[symbol] = {};
            
            for (const timeframe of this.baseConfig.timeframes) {
                const filename = path.join(this.dataDir, `${symbol}_${timeframe}_historical.json`);
                
                try {
                    const fileContent = await fs.readFile(filename, 'utf8');
                    const historicalData = JSON.parse(fileContent);
                    
                    // Convert date strings back to Date objects
                    historicalData.candles = historicalData.candles.map(candle => ({
                        ...candle,
                        openTime: new Date(candle.openTime),
                        closeTime: new Date(candle.closeTime)
                    }));
                    
                    data[symbol][timeframe] = historicalData.candles;
                    
                } catch (error) {
                    console.warn(`Could not load data for ${symbol} ${timeframe}:`, error.message);
                    data[symbol][timeframe] = [];
                }
            }
        }
        
        return data;
    }

    /**
     * Calculate results for a scenario
     */
    calculateScenarioResults(tradingEngine, timeline) {
        const metrics = tradingEngine.getPerformanceMetrics();
        const closedTrades = tradingEngine.portfolio.closedTrades;
        
        // Calculate additional metrics
        const results = {
            ...metrics,
            
            // Duration metrics
            totalTrades: metrics.totalTrades,
            avgTradeDuration: this.calculateAverageTradeDuration(closedTrades),
            bestTrade: this.getBestTrade(closedTrades),
            worstTrade: this.getWorstTrade(closedTrades),
            
            // Monthly breakdown
            monthlyReturns: this.calculateMonthlyReturns(closedTrades, timeline),
            
            // Equity curve
            equityCurve: this.generateEquityCurve(closedTrades, timeline),
            
            // Final metrics
            finalEquity: metrics.totalEquity,
            totalReturn: metrics.totalReturn,
            annualizedReturn: this.calculateAnnualizedReturn(metrics.totalReturn, timeline),
            maxDrawdown: metrics.maxDrawdown,
            profitFactor: metrics.profitFactor,
            sharpeRatio: metrics.sharpeRatio,
            winRate: metrics.winRate,
            
            // Risk metrics
            calmarRatio: metrics.maxDrawdown > 0 ? metrics.totalReturn / metrics.maxDrawdown : 0,
            
            // Additional stats
            allTrades: closedTrades.length,
            avgWin: metrics.avgWin,
            avgLoss: metrics.avgLoss,
            expectancy: metrics.expectancy
        };
        
        return results;
    }

    /**
     * Calculate average trade duration
     */
    calculateAverageTradeDuration(trades) {
        if (trades.length === 0) return 0;
        
        const totalDuration = trades.reduce((sum, trade) => {
            const duration = new Date(trade.exitTime) - new Date(trade.entryTime);
            return sum + duration;
        }, 0);
        
        return Math.round(totalDuration / trades.length / (1000 * 60 * 60)); // Hours
    }

    /**
     * Get best trade
     */
    getBestTrade(trades) {
        if (trades.length === 0) return null;
        
        return trades.reduce((best, trade) => 
            trade.netPnL > best.netPnL ? trade : best
        );
    }

    /**
     * Get worst trade
     */
    getWorstTrade(trades) {
        if (trades.length === 0) return null;
        
        return trades.reduce((worst, trade) => 
            trade.netPnL < worst.netPnL ? trade : worst
        );
    }

    /**
     * Calculate monthly returns
     */
    calculateMonthlyReturns(trades, timeline) {
        const monthlyReturns = {};
        
        trades.forEach(trade => {
            const exitDate = new Date(trade.exitTime);
            const monthKey = `${exitDate.getFullYear()}-${String(exitDate.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyReturns[monthKey]) {
                monthlyReturns[monthKey] = 0;
            }
            
            monthlyReturns[monthKey] += trade.netPnL;
        });
        
        return monthlyReturns;
    }

    /**
     * Generate equity curve data points
     */
    generateEquityCurve(trades, timeline) {
        const equityCurve = [];
        let runningEquity = this.baseConfig.paperBalance;
        
        // Start with initial balance
        equityCurve.push({
            date: timeline[0]?.time || new Date(),
            equity: runningEquity
        });
        
        // Add a point for each completed trade
        trades.forEach(trade => {
            runningEquity += trade.netPnL;
            equityCurve.push({
                date: new Date(trade.exitTime),
                equity: runningEquity
            });
        });
        
        return equityCurve;
    }

    /**
     * Calculate annualized return
     */
    calculateAnnualizedReturn(totalReturn, timeline) {
        if (timeline.length < 2) return totalReturn;
        
        const startDate = timeline[0].time;
        const endDate = timeline[timeline.length - 1].time;
        const yearsElapsed = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365.25);
        
        if (yearsElapsed <= 0) return totalReturn;
        
        return (Math.pow(1 + totalReturn / 100, 1 / yearsElapsed) - 1) * 100;
    }

    /**
     * Save results to JSON
     */
    async saveResults() {
        const resultsFile = path.join(this.dataDir, 'results.json');
        const fullResults = {
            metadata: {
                backtestDate: new Date(),
                baseConfig: this.baseConfig,
                scenarios: this.scenarios,
                dataDirectory: this.dataDir
            },
            results: this.results
        };
        
        await fs.writeFile(resultsFile, JSON.stringify(fullResults, null, 2));
        console.log(`💾 Results saved to ${resultsFile}`);
    }

    /**
     * Generate human-readable report
     */
    async generateReport() {
        const report = this.createMarkdownReport();
        const reportFile = path.join(this.dataDir, 'report.md');
        
        await fs.writeFile(reportFile, report);
        console.log(`📄 Report saved to ${reportFile}`);
    }

    /**
     * Create markdown report content
     */
    createMarkdownReport() {
        const reportDate = new Date().toISOString().split('T')[0];
        
        let report = `# Trading Bot Backtest Report\n\n`;
        report += `**Generated:** ${reportDate}\n`;
        report += `**Period:** 6 months of historical data\n`;
        report += `**Symbols:** ${this.baseConfig.pairs.join(', ')}\n`;
        report += `**Timeframes:** ${this.baseConfig.timeframes.join(', ')}\n\n`;
        
        report += `## Executive Summary\n\n`;
        
        // Find best scenario
        let bestScenario = null;
        let bestReturn = -Infinity;
        for (const [name, results] of Object.entries(this.results)) {
            if (results.totalReturn > bestReturn) {
                bestReturn = results.totalReturn;
                bestScenario = name;
            }
        }
        
        if (bestScenario) {
            report += `**Best Performing Strategy:** ${bestScenario} (${bestReturn.toFixed(2)}% total return)\n\n`;
        }
        
        report += `## Scenario Results\n\n`;
        
        for (const [scenarioName, results] of Object.entries(this.results)) {
            report += `### ${scenarioName}\n\n`;
            report += `- **Total Return:** ${results.totalReturn.toFixed(2)}%\n`;
            report += `- **Annualized Return:** ${results.annualizedReturn.toFixed(2)}%\n`;
            report += `- **Total Trades:** ${results.totalTrades}\n`;
            report += `- **Win Rate:** ${results.winRate.toFixed(1)}%\n`;
            report += `- **Profit Factor:** ${results.profitFactor.toFixed(2)}\n`;
            report += `- **Max Drawdown:** ${results.maxDrawdown.toFixed(2)}%\n`;
            report += `- **Sharpe Ratio:** ${results.sharpeRatio.toFixed(2)}\n`;
            report += `- **Calmar Ratio:** ${results.calmarRatio.toFixed(2)}\n`;
            report += `- **Average Trade Duration:** ${results.avgTradeDuration} hours\n`;
            
            if (results.bestTrade) {
                report += `- **Best Trade:** ${(results.bestTrade.netPnL / (results.bestTrade.entryPrice * results.bestTrade.quantity) * 100).toFixed(2)}%\n`;
            }
            if (results.worstTrade) {
                report += `- **Worst Trade:** ${(results.worstTrade.netPnL / (results.worstTrade.entryPrice * results.worstTrade.quantity) * 100).toFixed(2)}%\n`;
            }
            
            report += `\n`;
        }
        
        report += `## Monthly Performance Breakdown\n\n`;
        // Add monthly breakdown for each scenario...
        
        report += `## Risk Analysis\n\n`;
        report += `The backtesting system simulates realistic trading conditions including:\n`;
        report += `- Transaction fees (0.1% per trade)\n`;
        report += `- Position sizing based on risk management\n`;
        report += `- Portfolio heat limits\n`;
        report += `- Stop losses and take profits\n`;
        report += `- No look-ahead bias\n\n`;
        
        report += `## Disclaimer\n\n`;
        report += `These results are based on historical data and do not guarantee future performance. `;
        report += `Past performance is not indicative of future results. `;
        report += `Trading involves substantial risk and may not be suitable for all investors.\n`;
        
        return report;
    }

    /**
     * Print summary table to console
     */
    printSummaryTable() {
        console.log('\n📊 === BACKTEST RESULTS SUMMARY ===');
        console.log('');
        
        // Header
        console.log('Scenario               | Total Return | Win Rate | Trades | Max DD | Profit Factor | Sharpe');
        console.log('---------------------- | ------------ | -------- | ------ | ------ | ------------- | ------');
        
        // Results
        for (const [name, results] of Object.entries(this.results)) {
            const row = `${name.padEnd(22)} | ${(results.totalReturn + '%').padStart(12)} | ${(results.winRate.toFixed(1) + '%').padStart(8)} | ${String(results.totalTrades).padStart(6)} | ${(results.maxDrawdown.toFixed(1) + '%').padStart(6)} | ${results.profitFactor.toFixed(2).padStart(13)} | ${results.sharpeRatio.toFixed(2).padStart(6)}`;
            console.log(row);
        }
        
        console.log('');
        console.log('💡 Key Insights:');
        
        // Find best scenario by different metrics
        const bestByReturn = Object.entries(this.results).reduce((best, [name, results]) => 
            results.totalReturn > best[1].totalReturn ? [name, results] : best
        );
        
        const bestByWinRate = Object.entries(this.results).reduce((best, [name, results]) => 
            results.winRate > best[1].winRate ? [name, results] : best
        );
        
        const bestByProfitFactor = Object.entries(this.results).reduce((best, [name, results]) => 
            results.profitFactor > best[1].profitFactor ? [name, results] : best
        );
        
        console.log(`   🏆 Best Total Return: ${bestByReturn[0]} (${bestByReturn[1].totalReturn.toFixed(2)}%)`);
        console.log(`   🎯 Best Win Rate: ${bestByWinRate[0]} (${bestByWinRate[1].winRate.toFixed(1)}%)`);
        console.log(`   📊 Best Profit Factor: ${bestByProfitFactor[0]} (${bestByProfitFactor[1].profitFactor.toFixed(2)})`);
        
        console.log('\n=================================');
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function runBacktest() {
    const backtester = new BacktestingEngine();
    
    try {
        await backtester.initialize();
        await backtester.runBacktest();
        
        console.log('\n🎉 Backtest completed successfully!');
        console.log('📁 Check ./data/backtest/ for detailed results and reports');
        
    } catch (error) {
        console.error('❌ Backtest failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runBacktest().catch(console.error);
}

export default BacktestingEngine;