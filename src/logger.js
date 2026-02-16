/**
 * Trade Logger Module
 * Logs all trading decisions, trades, and performance metrics
 */

import fs from 'fs/promises';
import path from 'path';

class TradeLogger {
    constructor(config) {
        this.config = config;
        this.tradesFile = './data/trades.json';
        this.decisionsFile = './data/decisions.json';
        this.performanceFile = './data/performance.json';
        
        // Ensure data directory exists
        this.ensureDataDirectory();
    }

    async ensureDataDirectory() {
        try {
            await fs.mkdir('./data', { recursive: true });
        } catch (error) {
            console.error('Error creating data directory:', error);
        }
    }

    /**
     * Log a trading decision (trade or skip)
     */
    async logDecision(decision) {
        try {
            const logEntry = {
                timestamp: new Date(),
                ...decision,
                id: `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };

            await this.appendToFile(this.decisionsFile, logEntry);
            
            if (this.config.verbose) {
                console.log(`📝 Decision logged: ${decision.action} ${decision.symbol} - ${decision.reasoning}`);
            }

        } catch (error) {
            console.error('Error logging decision:', error);
        }
    }

    /**
     * Log a completed trade
     */
    async logTrade(trade) {
        try {
            const tradeEntry = {
                timestamp: new Date(),
                tradeId: trade.id,
                symbol: trade.symbol,
                direction: trade.direction,
                entryPrice: trade.entryPrice,
                exitPrice: trade.exitPrice,
                quantity: trade.quantity,
                entryTime: trade.entryTime,
                exitTime: trade.exitTime,
                holdingPeriod: trade.exitTime - trade.entryTime,
                holdingPeriodHours: (trade.exitTime - trade.entryTime) / (1000 * 60 * 60),
                grossPnL: trade.grossPnL,
                netPnL: trade.netPnL,
                returnPercent: (trade.netPnL / (trade.entryPrice * trade.quantity)) * 100,
                fees: trade.entryFee + trade.exitFee,
                exitReason: trade.exitReason,
                maxFavorableExcursion: trade.maxFavorableExcursion,
                maxAdverseExcursion: trade.maxAdverseExcursion,
                signal: {
                    type: trade.signal?.type,
                    confidence: trade.signal?.confidence,
                    reasoning: trade.signal?.reasoning,
                    riskRewardRatio: trade.signal?.riskRewardRatio
                },
                marketConditions: trade.marketConditions || null
            };

            await this.appendToFile(this.tradesFile, tradeEntry);
            
            const result = tradeEntry.netPnL >= 0 ? '✅ WIN' : '❌ LOSS';
            console.log(`💼 Trade logged: ${result} ${trade.symbol} - P&L: $${tradeEntry.netPnL.toFixed(2)} (${tradeEntry.returnPercent.toFixed(2)}%)`);

        } catch (error) {
            console.error('Error logging trade:', error);
        }
    }

    /**
     * Log performance metrics snapshot
     */
    async logPerformanceSnapshot(metrics, portfolioState) {
        try {
            const performanceEntry = {
                timestamp: new Date(),
                equity: portfolioState.equity,
                balance: portfolioState.balance,
                openPositions: Object.keys(portfolioState.openTrades).length,
                metrics: {
                    totalReturn: metrics.totalReturn,
                    totalTrades: metrics.totalTrades,
                    winRate: metrics.winRate,
                    profitFactor: metrics.profitFactor,
                    expectancy: metrics.expectancy,
                    maxDrawdown: metrics.maxDrawdown,
                    sharpeRatio: metrics.sharpeRatio,
                    portfolioHeat: metrics.portfolioHeat
                },
                currentPositions: Object.values(portfolioState.openTrades).map(trade => ({
                    symbol: trade.symbol,
                    direction: trade.direction,
                    unrealizedPnL: trade.unrealizedPnL,
                    entryTime: trade.entryTime
                }))
            };

            await this.appendToFile(this.performanceFile, performanceEntry);

        } catch (error) {
            console.error('Error logging performance snapshot:', error);
        }
    }

    /**
     * Log market analysis results
     */
    async logMarketAnalysis(symbol, timeframe, analysis, signals) {
        try {
            const analysisEntry = {
                timestamp: new Date(),
                symbol,
                timeframe,
                currentPrice: analysis.currentPrice,
                marketRegime: analysis.assessment?.marketRegime,
                momentum: analysis.assessment?.momentum,
                trend: analysis.assessment?.trend,
                volatility: analysis.assessment?.volatility,
                indicators: {
                    rsi: {
                        current: analysis.indicators?.rsi?.current,
                        signal: analysis.indicators?.rsi?.signal
                    },
                    macd: {
                        current: analysis.indicators?.macd?.current,
                        signal: analysis.indicators?.macd?.signal
                    },
                    adx: {
                        current: analysis.indicators?.adx?.current,
                        regime: analysis.indicators?.adx?.regime
                    },
                    bollinger: {
                        position: analysis.indicators?.bollinger?.position,
                        squeeze: analysis.indicators?.bollinger?.squeeze
                    },
                    volume: {
                        ratio: analysis.indicators?.volumeAnalysis?.ratio,
                        signal: analysis.indicators?.volumeAnalysis?.signal
                    }
                },
                signalsGenerated: signals?.length || 0,
                topSignals: signals?.slice(0, 3).map(signal => ({
                    type: signal.type,
                    direction: signal.direction,
                    confidence: signal.confidence,
                    score: signal.score
                })) || []
            };

            const analysisFile = `./data/analysis_${symbol}_${timeframe}.json`;
            await this.appendToFile(analysisFile, analysisEntry);

        } catch (error) {
            console.error('Error logging market analysis:', error);
        }
    }

    /**
     * Log news analysis results
     */
    async logNewsAnalysis(newsAnalysis) {
        try {
            if (!newsAnalysis) return;

            const newsLogEntry = {
                timestamp: new Date(),
                generalSentiment: newsAnalysis.general?.sentiment,
                recentNewsCount: newsAnalysis.general?.recent?.length || 0,
                specificAnalysis: {},
                signals: newsAnalysis.signals || {},
                trendingCoins: newsAnalysis.trending?.coins?.slice(0, 5).map(coin => ({
                    name: coin.name,
                    symbol: coin.symbol,
                    score: coin.score
                })) || []
            };

            // Add specific symbol analysis
            Object.keys(newsAnalysis.specific || {}).forEach(symbol => {
                const specific = newsAnalysis.specific[symbol];
                newsLogEntry.specificAnalysis[symbol] = {
                    newsCount: specific.news?.length || 0,
                    recentCount: specific.recent?.length || 0,
                    sentiment: specific.sentiment
                };
            });

            const newsFile = './data/news_analysis.json';
            await this.appendToFile(newsFile, newsLogEntry);

        } catch (error) {
            console.error('Error logging news analysis:', error);
        }
    }

    /**
     * Generate and log performance report
     */
    async generatePerformanceReport() {
        try {
            const trades = await this.loadTrades();
            const decisions = await this.loadDecisions();
            
            if (trades.length === 0) {
                console.log('📊 No trades to analyze');
                return;
            }

            const report = this.calculateDetailedMetrics(trades, decisions);
            
            // Log the report
            await this.logDetailedReport(report);
            
            // Print summary to console
            this.printPerformanceSummary(report);

            return report;

        } catch (error) {
            console.error('Error generating performance report:', error);
        }
    }

    /**
     * Calculate detailed performance metrics
     */
    calculateDetailedMetrics(trades, decisions) {
        const now = new Date();
        const startDate = trades.length > 0 ? new Date(Math.min(...trades.map(t => new Date(t.entryTime)))) : now;
        const totalDays = Math.max(1, (now - startDate) / (1000 * 60 * 60 * 24));

        // Basic metrics
        const totalTrades = trades.length;
        const winningTrades = trades.filter(t => t.netPnL > 0);
        const losingTrades = trades.filter(t => t.netPnL <= 0);
        
        const totalProfit = winningTrades.reduce((sum, t) => sum + t.netPnL, 0);
        const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.netPnL, 0));
        
        const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
        const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 99 : 0;
        
        const avgWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
        const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;
        
        // Risk metrics
        const returns = trades.map(t => t.returnPercent);
        const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0;
        const stdDev = returns.length > 1 
            ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1))
            : 0;
        
        const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
        
        // Drawdown analysis
        let runningPnL = 0;
        let peakPnL = 0;
        let maxDrawdown = 0;
        let currentDrawdownStart = null;
        let longestDrawdownDays = 0;
        
        trades.forEach((trade, index) => {
            runningPnL += trade.netPnL;
            if (runningPnL > peakPnL) {
                peakPnL = runningPnL;
                if (currentDrawdownStart) {
                    const drawdownDays = (new Date(trade.exitTime) - currentDrawdownStart) / (1000 * 60 * 60 * 24);
                    longestDrawdownDays = Math.max(longestDrawdownDays, drawdownDays);
                    currentDrawdownStart = null;
                }
            } else {
                if (!currentDrawdownStart) {
                    currentDrawdownStart = new Date(trade.exitTime);
                }
                const currentDrawdown = (peakPnL - runningPnL) / Math.max(peakPnL, 1);
                maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
            }
        });

        // Strategy breakdown
        const strategyStats = {};
        trades.forEach(trade => {
            const strategy = trade.signal?.type || 'unknown';
            if (!strategyStats[strategy]) {
                strategyStats[strategy] = {
                    count: 0,
                    wins: 0,
                    totalPnL: 0,
                    avgReturn: 0
                };
            }
            strategyStats[strategy].count++;
            if (trade.netPnL > 0) strategyStats[strategy].wins++;
            strategyStats[strategy].totalPnL += trade.netPnL;
        });

        // Calculate strategy averages
        Object.values(strategyStats).forEach(stats => {
            stats.winRate = stats.count > 0 ? (stats.wins / stats.count) * 100 : 0;
            stats.avgPnL = stats.count > 0 ? stats.totalPnL / stats.count : 0;
        });

        // Time-based analysis
        const tradingFrequency = totalTrades / totalDays;
        const avgHoldingTime = trades.length > 0 
            ? trades.reduce((sum, t) => sum + t.holdingPeriodHours, 0) / trades.length
            : 0;

        // Decision analysis
        const totalDecisions = decisions.length;
        const tradeDecisions = decisions.filter(d => d.action === 'trade').length;
        const skipDecisions = decisions.filter(d => d.action === 'skip').length;
        const executionRate = totalDecisions > 0 ? (tradeDecisions / totalDecisions) * 100 : 0;

        return {
            timestamp: new Date(),
            period: {
                startDate,
                endDate: now,
                totalDays: totalDays.toFixed(0)
            },
            trades: {
                total: totalTrades,
                winning: winningTrades.length,
                losing: losingTrades.length,
                winRate: winRate.toFixed(2),
                profitFactor: profitFactor.toFixed(2)
            },
            returns: {
                totalProfit: totalProfit.toFixed(2),
                totalLoss: totalLoss.toFixed(2),
                netProfit: (totalProfit - totalLoss).toFixed(2),
                avgWin: avgWin.toFixed(2),
                avgLoss: avgLoss.toFixed(2),
                avgReturn: avgReturn.toFixed(2),
                expectancy: ((avgWin * winRate/100) - (avgLoss * (100-winRate)/100)).toFixed(2)
            },
            risk: {
                maxDrawdown: (maxDrawdown * 100).toFixed(2),
                longestDrawdownDays: longestDrawdownDays.toFixed(0),
                stdDev: stdDev.toFixed(2),
                sharpeRatio: sharpeRatio.toFixed(2)
            },
            timing: {
                tradingFrequency: tradingFrequency.toFixed(2),
                avgHoldingTimeHours: avgHoldingTime.toFixed(1),
                executionRate: executionRate.toFixed(2)
            },
            strategies: strategyStats,
            decisions: {
                total: totalDecisions,
                trades: tradeDecisions,
                skips: skipDecisions,
                executionRate: executionRate.toFixed(2)
            }
        };
    }

    /**
     * Print performance summary to console
     */
    printPerformanceSummary(report) {
        console.log('\n📊 === PERFORMANCE REPORT ===');
        console.log(`📅 Period: ${report.period.totalDays} days`);
        console.log(`💰 Net P&L: $${report.returns.netProfit}`);
        console.log(`📈 Win Rate: ${report.trades.winRate}%`);
        console.log(`🎯 Profit Factor: ${report.trades.profitFactor}`);
        console.log(`📉 Max Drawdown: ${report.risk.maxDrawdown}%`);
        console.log(`⚡ Sharpe Ratio: ${report.risk.sharpeRatio}`);
        console.log(`🔄 Trading Frequency: ${report.timing.tradingFrequency} trades/day`);
        console.log(`⏱️ Avg Holding: ${report.timing.avgHoldingTimeHours}h`);
        
        if (Object.keys(report.strategies).length > 0) {
            console.log('\n📋 Strategy Breakdown:');
            Object.entries(report.strategies).forEach(([strategy, stats]) => {
                console.log(`  ${strategy}: ${stats.count} trades, ${stats.winRate.toFixed(1)}% WR, $${stats.totalPnL.toFixed(2)} P&L`);
            });
        }
        console.log('=========================\n');
    }

    /**
     * Load trades from file
     */
    async loadTrades() {
        try {
            const data = await fs.readFile(this.tradesFile, 'utf8');
            return data.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
        } catch (error) {
            return [];
        }
    }

    /**
     * Load decisions from file
     */
    async loadDecisions() {
        try {
            const data = await fs.readFile(this.decisionsFile, 'utf8');
            return data.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
        } catch (error) {
            return [];
        }
    }

    /**
     * Log detailed report
     */
    async logDetailedReport(report) {
        try {
            const reportFile = './data/performance_reports.json';
            await this.appendToFile(reportFile, report);
        } catch (error) {
            console.error('Error logging detailed report:', error);
        }
    }

    /**
     * Append data to a file (JSONL format)
     */
    async appendToFile(filename, data) {
        try {
            const jsonLine = JSON.stringify(data) + '\n';
            await fs.appendFile(filename, jsonLine);
        } catch (error) {
            console.error(`Error appending to file ${filename}:`, error);
        }
    }

    /**
     * Get recent performance data for dashboard
     */
    async getRecentPerformance(days = 7) {
        try {
            const trades = await this.loadTrades();
            const cutoff = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
            
            const recentTrades = trades.filter(trade => new Date(trade.timestamp) >= cutoff);
            
            if (recentTrades.length === 0) {
                return null;
            }

            const totalPnL = recentTrades.reduce((sum, trade) => sum + trade.netPnL, 0);
            const wins = recentTrades.filter(trade => trade.netPnL > 0).length;
            const winRate = (wins / recentTrades.length) * 100;

            return {
                period: `${days} days`,
                trades: recentTrades.length,
                netPnL: totalPnL,
                winRate,
                avgPnL: totalPnL / recentTrades.length,
                bestTrade: Math.max(...recentTrades.map(t => t.netPnL)),
                worstTrade: Math.min(...recentTrades.map(t => t.netPnL))
            };
        } catch (error) {
            console.error('Error getting recent performance:', error);
            return null;
        }
    }

    /**
     * Clean old log files (keep last N entries)
     */
    async cleanOldLogs(maxEntries = 10000) {
        const files = [this.decisionsFile, this.tradesFile, this.performanceFile];
        
        for (const file of files) {
            try {
                const data = await fs.readFile(file, 'utf8');
                const lines = data.split('\n').filter(line => line.trim());
                
                if (lines.length > maxEntries) {
                    const recentLines = lines.slice(-maxEntries);
                    await fs.writeFile(file, recentLines.join('\n') + '\n');
                    console.log(`Cleaned ${file}: kept ${recentLines.length} recent entries`);
                }
            } catch (error) {
                // File doesn't exist or can't be read, skip
            }
        }
    }
}

export default TradeLogger;