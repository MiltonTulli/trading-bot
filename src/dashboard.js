#!/usr/bin/env node
/**
 * CLI Dashboard
 * Real-time display of trading system status
 */

import TradingBot from './index.js';
import fs from 'fs/promises';

class TradingDashboard {
    constructor() {
        this.bot = new TradingBot();
        this.refreshInterval = 30000; // 30 seconds
        this.isRunning = false;
    }

    /**
     * Initialize the dashboard
     */
    async initialize() {
        try {
            await this.bot.initialize();
            console.log('📊 Dashboard initialized');
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            throw error;
        }
    }

    /**
     * Start the dashboard
     */
    async start() {
        this.isRunning = true;
        console.log('🚀 Starting Trading Dashboard...\n');
        
        while (this.isRunning) {
            try {
                // Clear screen
                console.clear();
                
                // Display dashboard
                await this.displayDashboard();
                
                // Wait for next refresh
                await this.sleep(this.refreshInterval);
                
            } catch (error) {
                console.error('Dashboard error:', error);
                await this.sleep(5000);
            }
        }
    }

    /**
     * Display the main dashboard
     */
    async displayDashboard() {
        const timestamp = new Date().toLocaleString();
        
        // Header
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║                    🤖 CRYPTO TRADING BOT                    ║');
        console.log('║                        LIVE DASHBOARD                        ║');
        console.log(`║                    ${timestamp.padStart(20)}                    ║`);
        console.log('╚══════════════════════════════════════════════════════════════╝\n');

        try {
            // Get current market prices
            await this.displayMarketOverview();
            
            // Portfolio status
            await this.displayPortfolioStatus();
            
            // Open positions
            await this.displayOpenPositions();
            
            // Recent signals
            await this.displayRecentSignals();
            
            // Performance metrics
            await this.displayPerformanceMetrics();
            
            // Recent trades
            await this.displayRecentTrades();
            
            // System status
            this.displaySystemStatus();
            
        } catch (error) {
            console.log('❌ Error displaying dashboard:', error.message);
        }

        console.log('\n📋 Commands: [Ctrl+C] Exit | [R] Refresh | Data refreshes every 30s');
    }

    /**
     * Display market overview
     */
    async displayMarketOverview() {
        console.log('🌐 MARKET OVERVIEW');
        console.log('─'.repeat(60));
        
        try {
            for (const symbol of this.bot.config.pairs) {
                const priceData = await this.bot.priceFeed.getLatestPrice(symbol);
                const ticker24h = await this.bot.priceFeed.get24hrTicker(symbol);
                
                const changeColor = ticker24h.priceChangePercent >= 0 ? '🟢' : '🔴';
                const price = `$${priceData.price.toFixed(2)}`;
                const change = `${ticker24h.priceChangePercent.toFixed(2)}%`;
                const volume = `Vol: ${this.formatNumber(ticker24h.volume)}`;
                
                console.log(`${changeColor} ${symbol.padEnd(10)} ${price.padStart(12)} ${change.padStart(8)} | ${volume}`);
            }
        } catch (error) {
            console.log('❌ Failed to fetch market data');
        }
        
        console.log('');
    }

    /**
     * Display portfolio status
     */
    async displayPortfolioStatus() {
        console.log('💼 PORTFOLIO STATUS');
        console.log('─'.repeat(60));
        
        const metrics = this.bot.tradingEngine.getPerformanceMetrics();
        const equity = metrics.totalEquity;
        const balance = metrics.totalBalance;
        const totalReturn = metrics.totalReturn;
        const unrealizedPnL = equity - balance;
        
        const equityColor = totalReturn >= 0 ? '🟢' : '🔴';
        const unrealizedColor = unrealizedPnL >= 0 ? '🟢' : '🔴';
        
        console.log(`💰 Total Equity:     ${equityColor} $${equity.toFixed(2)} (${totalReturn.toFixed(2)}%)`);
        console.log(`💵 Cash Balance:     $${balance.toFixed(2)}`);
        console.log(`📊 Unrealized P&L:   ${unrealizedColor} $${unrealizedPnL.toFixed(2)}`);
        console.log(`🔥 Portfolio Heat:   ${metrics.portfolioHeat.toFixed(1)}% / ${(this.bot.config.maxPortfolioHeat*100).toFixed(1)}%`);
        console.log(`📈 Total Trades:     ${metrics.totalTrades}`);
        console.log(`🎯 Win Rate:         ${metrics.winRate.toFixed(1)}%`);
        console.log(`⚖️ Profit Factor:    ${metrics.profitFactor.toFixed(2)}`);
        
        console.log('');
    }

    /**
     * Display open positions
     */
    async displayOpenPositions() {
        console.log('📊 OPEN POSITIONS');
        console.log('─'.repeat(60));
        
        const positions = this.bot.tradingEngine.getCurrentPositions();
        
        if (positions.length === 0) {
            console.log('📭 No open positions');
        } else {
            console.log('Symbol     Dir   Entry     Current   P&L      %     Age     Type');
            console.log('─'.repeat(60));
            
            positions.forEach(pos => {
                const pnlColor = pos.unrealizedPnL >= 0 ? '🟢' : '🔴';
                const direction = pos.direction === 'long' ? 'LONG' : 'SHORT';
                const entry = `$${pos.entryPrice.toFixed(4)}`;
                const current = `$${pos.currentPrice.toFixed(4)}`;
                const pnl = `$${pos.unrealizedPnL.toFixed(2)}`;
                const pnlPct = `${pos.unrealizedPnLPercent.toFixed(1)}%`;
                const age = this.formatDuration(pos.holdingPeriod);
                const type = pos.signalType.substring(0, 8);
                
                console.log(`${pos.symbol.padEnd(10)} ${direction.padEnd(4)} ${entry.padStart(8)} ${current.padStart(9)} ${pnlColor}${pnl.padStart(7)} ${pnlPct.padStart(6)} ${age.padEnd(8)} ${type}`);
            });
        }
        
        console.log('');
    }

    /**
     * Display recent signals
     */
    async displayRecentSignals() {
        console.log('🎯 RECENT SIGNALS');
        console.log('─'.repeat(60));
        
        try {
            // Fetch latest market data to generate fresh signals
            const marketData = {};
            for (const symbol of this.bot.config.pairs.slice(0, 2)) { // Limit to first 2 pairs for dashboard
                marketData[symbol] = {};
                
                try {
                    const data = await this.bot.priceFeed.getCandles(symbol, '1h', 100);
                    if (data && data.length > 0) {
                        const analysis = this.bot.indicators.analyzeMarket(data);
                        const signals = this.bot.signalGenerator.generateSignals(analysis, symbol);
                        
                        if (signals.length > 0) {
                            const topSignal = signals[0];
                            const confidenceColor = topSignal.confidence > 70 ? '🟢' : topSignal.confidence > 50 ? '🟡' : '🔴';
                            
                            console.log(`${confidenceColor} ${topSignal.symbol.padEnd(10)} ${topSignal.type.padEnd(12)} ${topSignal.direction.toUpperCase().padEnd(5)} ${topSignal.confidence.toFixed(0).padStart(3)}% | ${topSignal.reasoning.substring(0, 30)}...`);
                        }
                    }
                } catch (error) {
                    console.log(`❌ ${symbol.padEnd(10)} Error fetching signals`);
                }
            }
        } catch (error) {
            console.log('❌ Failed to generate fresh signals');
        }
        
        console.log('');
    }

    /**
     * Display performance metrics
     */
    async displayPerformanceMetrics() {
        console.log('📈 PERFORMANCE METRICS');
        console.log('─'.repeat(60));
        
        const metrics = this.bot.tradingEngine.getPerformanceMetrics();
        
        // Try to get recent performance
        let recentPerf = null;
        try {
            recentPerf = await this.bot.logger.getRecentPerformance(7);
        } catch (error) {
            // Ignore error, recent performance not available
        }
        
        console.log(`📊 Max Drawdown:     ${metrics.maxDrawdown.toFixed(2)}%`);
        console.log(`📉 Expectancy:       ${metrics.expectancy > 0 ? '🟢' : '🔴'} $${metrics.expectancy.toFixed(2)} per trade`);
        console.log(`⚡ Sharpe Ratio:     ${metrics.sharpeRatio > 0 ? '🟢' : '🔴'} ${metrics.sharpeRatio.toFixed(2)}`);
        console.log(`💰 Avg Win:          $${metrics.avgWin.toFixed(2)}`);
        console.log(`💸 Avg Loss:         $${metrics.avgLoss.toFixed(2)}`);
        
        if (recentPerf) {
            const recentColor = recentPerf.netPnL >= 0 ? '🟢' : '🔴';
            console.log(`📅 Last 7 Days:      ${recentColor} $${recentPerf.netPnL.toFixed(2)} (${recentPerf.trades} trades, ${recentPerf.winRate.toFixed(1)}% WR)`);
        }
        
        console.log('');
    }

    /**
     * Display recent trades
     */
    async displayRecentTrades() {
        console.log('🔄 RECENT TRADES');
        console.log('─'.repeat(60));
        
        const recentTrades = this.bot.tradingEngine.getRecentTrades(5);
        
        if (recentTrades.length === 0) {
            console.log('📭 No recent trades');
        } else {
            console.log('Symbol     Dir   Entry     Exit      P&L      %     Exit Reason');
            console.log('─'.repeat(60));
            
            recentTrades.forEach(trade => {
                const resultColor = trade.netPnL >= 0 ? '🟢' : '🔴';
                const direction = trade.direction === 'long' ? 'LONG' : 'SHORT';
                const entry = `$${trade.entryPrice.toFixed(4)}`;
                const exit = `$${trade.exitPrice.toFixed(4)}`;
                const pnl = `$${trade.netPnL.toFixed(2)}`;
                const pnlPct = `${trade.returnPercent.toFixed(1)}%`;
                const reason = trade.exitReason.replace('take_profit_', 'TP').replace('stop_loss', 'SL');
                
                console.log(`${trade.symbol.padEnd(10)} ${direction.padEnd(4)} ${entry.padStart(8)} ${exit.padStart(9)} ${resultColor}${pnl.padStart(7)} ${pnlPct.padStart(6)} ${reason}`);
            });
        }
        
        console.log('');
    }

    /**
     * Display system status
     */
    displaySystemStatus() {
        console.log('⚙️ SYSTEM STATUS');
        console.log('─'.repeat(60));
        
        const uptime = process.uptime();
        const memory = process.memoryUsage();
        
        console.log(`🕐 Uptime:           ${this.formatDuration(uptime * 1000)}`);
        console.log(`💾 Memory Usage:     ${(memory.heapUsed / 1024 / 1024).toFixed(1)} MB`);
        console.log(`🔄 Refresh Rate:     ${this.refreshInterval/1000}s`);
        console.log(`🤖 Bot Status:       ${this.bot.isRunning ? '🟢 Running' : '🔴 Stopped'}`);
        console.log(`📡 Data Sources:     🟢 Binance API, 🟢 News Feed`);
        
        console.log('');
    }

    /**
     * Format large numbers
     */
    formatNumber(num) {
        if (num >= 1e9) {
            return (num / 1e9).toFixed(1) + 'B';
        } else if (num >= 1e6) {
            return (num / 1e6).toFixed(1) + 'M';
        } else if (num >= 1e3) {
            return (num / 1e3).toFixed(1) + 'K';
        }
        return num.toFixed(2);
    }

    /**
     * Format duration
     */
    formatDuration(ms) {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days}d ${hours % 24}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Stop the dashboard
     */
    stop() {
        this.isRunning = false;
    }
}

// Command line interface
async function main() {
    const dashboard = new TradingDashboard();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down dashboard...');
        dashboard.stop();
        process.exit(0);
    });
    
    // Handle key presses (only if running in TTY)
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', (key) => {
            if (key.toString() === 'q' || key.toString() === '\u0003') { // 'q' or Ctrl+C
                console.log('\n🛑 Shutting down dashboard...');
                dashboard.stop();
                process.exit(0);
            } else if (key.toString() === 'r') {
                // Force refresh (just continue the loop)
            }
        });
    } else {
        console.log('📝 Running in non-TTY environment - keyboard shortcuts disabled');
    }
    
    try {
        await dashboard.initialize();
        await dashboard.start();
    } catch (error) {
        console.error('❌ Dashboard failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default TradingDashboard;