#!/usr/bin/env node
/**
 * Main Trading Bot Runner
 * Orchestrates the entire trading system
 */

import fs from 'fs/promises';
import PriceFeed from './feeds/prices.js';
import TechnicalIndicators from './indicators/index.js';
import SignalGenerator from './signals/generator.js';
import NewsFeed from './feeds/news.js';
import PaperTradingEngine from './paper/engine.js';
import TradeLogger from './logger.js';

class TradingBot {
    constructor(configPath = './config.json') {
        this.configPath = configPath;
        this.config = null;
        this.priceFeed = null;
        this.indicators = null;
        this.signalGenerator = null;
        this.newsFeed = null;
        this.tradingEngine = null;
        this.logger = null;
        this.isRunning = false;
    }

    /**
     * Initialize the trading bot
     */
    async initialize() {
        try {
            console.log('🤖 Initializing Trading Bot...');
            
            // Load configuration
            await this.loadConfig();
            
            // Initialize components
            this.priceFeed = new PriceFeed(this.config);
            this.indicators = new TechnicalIndicators();
            this.signalGenerator = new SignalGenerator(this.config);
            this.newsFeed = new NewsFeed(this.config);
            this.tradingEngine = new PaperTradingEngine(this.config);
            this.logger = new TradeLogger(this.config);
            
            console.log('✅ Trading Bot initialized successfully');
            
            // Test connectivity
            await this.testConnectivity();
            
        } catch (error) {
            console.error('❌ Failed to initialize trading bot:', error);
            throw error;
        }
    }

    /**
     * Load configuration from file
     */
    async loadConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(configData);
            const timeframes = this.config.timeframes || [this.config.timeframe || '4h'];
            this.config.timeframes = timeframes;
            console.log(`📋 Configuration loaded: ${this.config.pairs.length} pairs, ${timeframes.length} timeframes`);
        } catch (error) {
            console.error('Failed to load configuration:', error);
            throw error;
        }
    }

    /**
     * Test connectivity to data sources
     */
    async testConnectivity() {
        try {
            console.log('🔗 Testing connectivity...');
            
            // Test Binance API
            const testPrice = await this.priceFeed.getLatestPrice('BTCUSDT');
            console.log(`📈 BTC Price: $${testPrice.price.toFixed(2)}`);
            
            // Test news feed
            const newsCount = (await this.newsFeed.fetchCryptoCompareNews(5)).length;
            console.log(`📰 News API: ${newsCount} articles fetched`);
            
            console.log('✅ Connectivity test passed');
            
        } catch (error) {
            console.warn('⚠️ Connectivity issues detected:', error.message);
        }
    }

    /**
     * Main trading loop
     */
    async run() {
        try {
            this.isRunning = true;
            console.log('🚀 Starting trading loop...');
            
            let iteration = 0;
            while (this.isRunning) {
                iteration++;
                console.log(`\n🔄 Trading Loop Iteration #${iteration} - ${new Date().toLocaleString()}`);
                
                try {
                    // Step 1: Fetch market data
                    const marketData = await this.fetchAllMarketData();
                    
                    // Step 2: Update existing positions
                    await this.updatePositions(marketData);
                    
                    // Step 3: Analyze markets and generate signals
                    const allSignals = await this.analyzeMarketsAndGenerateSignals(marketData);
                    
                    // Step 4: Fetch and analyze news
                    const newsAnalysis = await this.analyzeNews();
                    
                    // Step 5: Execute trades based on signals
                    await this.executeSignals(allSignals, marketData, newsAnalysis);
                    
                    // Step 6: Log performance
                    await this.logCurrentState();
                    
                    // Step 7: Display summary
                    this.displayIterationSummary(allSignals, marketData);
                    
                } catch (error) {
                    console.error('Error in trading loop iteration:', error);
                    await this.logger.logDecision({
                        action: 'error',
                        symbol: 'SYSTEM',
                        reasoning: `Trading loop error: ${error.message}`,
                        error: error.stack
                    });
                }
                
                // Wait before next iteration (configurable)
                const waitTime = this.config.loopInterval || 300000; // 5 minutes default
                console.log(`⏳ Waiting ${waitTime/1000}s before next iteration...`);
                await this.sleep(waitTime);
            }
            
        } catch (error) {
            console.error('❌ Fatal error in trading loop:', error);
            this.isRunning = false;
        }
    }

    /**
     * Fetch market data for all pairs and timeframes
     */
    async fetchAllMarketData() {
        console.log('📊 Fetching market data...');
        const marketData = {};
        
        for (const symbol of this.config.pairs) {
            marketData[symbol] = {};
            
            try {
                const multiTimeframeData = await this.priceFeed.getMultiTimeframeData(symbol, this.config.timeframes);
                
                for (const timeframe of this.config.timeframes) {
                    const candles = multiTimeframeData[timeframe];
                    
                    if (candles && candles.length > 0) {
                        // Analyze the market data
                        const analysis = this.indicators.analyzeMarket(candles);
                        marketData[symbol][timeframe] = analysis;
                    }
                }
                
            } catch (error) {
                console.error(`Error fetching data for ${symbol}:`, error);
            }
        }
        
        return marketData;
    }

    /**
     * Update existing positions with current market data
     */
    async updatePositions(marketData) {
        try {
            const updates = await this.tradingEngine.updatePositions(marketData);
            
            updates.forEach(update => {
                if (update.action === 'close') {
                    // Log the closed trade
                    this.logger.logTrade(update);
                    console.log(`🔄 Position ${update.symbol} closed: ${update.exitReason}`);
                }
            });
            
            return updates;
            
        } catch (error) {
            console.error('Error updating positions:', error);
            return [];
        }
    }

    /**
     * Analyze markets and generate trading signals
     */
    async analyzeMarketsAndGenerateSignals(marketData) {
        console.log('🧠 Analyzing markets and generating signals...');
        const allSignals = [];
        
        for (const symbol of this.config.pairs) {
            for (const timeframe of this.config.timeframes) {
                const analysis = marketData[symbol]?.[timeframe];
                
                if (analysis) {
                    try {
                        // Generate signals for this symbol/timeframe
                        const signals = this.signalGenerator.generateSignals(analysis, symbol);
                        
                        // Add timeframe and score info
                        signals.forEach(signal => {
                            signal.timeframe = timeframe;
                            signal.score = this.signalGenerator.scoreSignal(signal);
                        });
                        
                        allSignals.push(...signals);
                        
                        // Log the market analysis
                        await this.logger.logMarketAnalysis(symbol, timeframe, analysis, signals);
                        
                    } catch (error) {
                        console.error(`Error analyzing ${symbol} ${timeframe}:`, error);
                    }
                }
            }
        }
        
        // Sort signals by score (highest first)
        allSignals.sort((a, b) => b.score - a.score);
        
        console.log(`📈 Generated ${allSignals.length} signals`);
        
        return allSignals;
    }

    /**
     * Analyze news and sentiment
     */
    async analyzeNews() {
        try {
            console.log('📰 Analyzing news and sentiment...');
            const newsAnalysis = await this.newsFeed.getNewsAnalysis(this.config.pairs.map(pair => pair.replace('USDT', '')));
            
            if (newsAnalysis) {
                await this.logger.logNewsAnalysis(newsAnalysis);
                
                // Display news summary
                const generalSentiment = newsAnalysis.general?.sentiment;
                if (generalSentiment) {
                    console.log(`📰 News Sentiment: ${generalSentiment.overallSentiment} (${generalSentiment.total} articles)`);
                }
            }
            
            return newsAnalysis;
            
        } catch (error) {
            console.error('Error analyzing news:', error);
            return null;
        }
    }

    /**
     * Execute trading signals
     */
    async executeSignals(signals, marketData, newsAnalysis) {
        if (signals.length === 0) {
            console.log('📭 No signals to execute');
            return;
        }
        
        console.log(`🎯 Evaluating ${signals.length} signals...`);
        
        // Get top signals
        const topSignals = signals.slice(0, 10); // Evaluate top 10 signals
        
        for (const signal of topSignals) {
            try {
                // Get current price
                const currentPriceData = await this.priceFeed.getLatestPrice(signal.symbol);
                const currentPrice = currentPriceData.price;
                
                // Validate signal is still relevant (price hasn't moved too much)
                const priceChange = Math.abs((currentPrice - signal.entryPrice) / signal.entryPrice);
                if (priceChange > 0.02) { // 2% maximum slippage
                    await this.logger.logDecision({
                        action: 'skip',
                        symbol: signal.symbol,
                        reasoning: `Price moved too much since signal generation (${(priceChange*100).toFixed(2)}% change)`,
                        signal: signal
                    });
                    continue;
                }
                
                // Check if we should trade this signal
                const shouldTrade = await this.evaluateSignal(signal, currentPrice, newsAnalysis);
                
                if (shouldTrade.trade) {
                    // Execute the trade
                    const trade = await this.tradingEngine.executeTrade(signal, currentPrice);
                    
                    if (trade) {
                        await this.logger.logDecision({
                            action: 'trade',
                            symbol: signal.symbol,
                            reasoning: shouldTrade.reasoning,
                            signal: signal,
                            tradeId: trade.id,
                            executionPrice: currentPrice
                        });
                        console.log(`✅ Trade executed: ${signal.type} ${signal.symbol} at $${currentPrice.toFixed(4)}`);
                    } else {
                        await this.logger.logDecision({
                            action: 'skip',
                            symbol: signal.symbol,
                            reasoning: 'Trade execution failed (insufficient funds or limits)',
                            signal: signal
                        });
                    }
                } else {
                    await this.logger.logDecision({
                        action: 'skip',
                        symbol: signal.symbol,
                        reasoning: shouldTrade.reasoning,
                        signal: signal
                    });
                }
                
            } catch (error) {
                console.error(`Error processing signal for ${signal.symbol}:`, error);
                await this.logger.logDecision({
                    action: 'error',
                    symbol: signal.symbol,
                    reasoning: `Signal processing error: ${error.message}`,
                    signal: signal,
                    error: error.stack
                });
            }
        }
    }

    /**
     * Evaluate whether to trade a signal
     */
    async evaluateSignal(signal, currentPrice, newsAnalysis) {
        const reasons = [];
        let shouldTrade = true;
        
        // Check signal quality
        if (signal.confidence < 60) {
            shouldTrade = false;
            reasons.push(`Low confidence (${signal.confidence}%)`);
        }
        
        if (signal.riskRewardRatio < this.config.minRiskReward) {
            shouldTrade = false;
            reasons.push(`Poor risk/reward ratio (${signal.riskRewardRatio.toFixed(2)})`);
        }
        
        // Check for existing position
        if (this.tradingEngine.portfolio.openTrades[signal.symbol]) {
            shouldTrade = false;
            reasons.push('Position already exists');
        }
        
        // Check portfolio heat
        const currentHeat = this.tradingEngine.calculateCurrentPortfolioHeat();
        if (currentHeat >= this.config.maxPortfolioHeat * 0.8) { // Use 80% of max heat as threshold
            shouldTrade = false;
            reasons.push(`Portfolio heat too high (${(currentHeat*100).toFixed(1)}%)`);
        }
        
        // News sentiment check
        if (newsAnalysis && newsAnalysis.signals) {
            const newsSignal = newsAnalysis.signals[signal.symbol.replace('USDT', '')];
            if (newsSignal) {
                if (newsSignal.direction === 'bearish' && signal.direction === 'long') {
                    if (newsSignal.strength > 70) {
                        shouldTrade = false;
                        reasons.push('Strong negative news sentiment');
                    } else if (newsSignal.strength > 50) {
                        reasons.push('Moderate negative news sentiment (proceeding with caution)');
                    }
                }
            }
        }
        
        // Additional quality checks
        if (signal.confirmations < this.config.minConfirmations) {
            shouldTrade = false;
            reasons.push(`Insufficient confirmations (${signal.confirmations})`);
        }
        
        const reasoning = shouldTrade 
            ? `Signal approved: ${signal.type} ${signal.direction} (confidence: ${signal.confidence}%, score: ${signal.score})`
            : reasons.join('; ');
        
        return { trade: shouldTrade, reasoning };
    }

    /**
     * Log current state and performance
     */
    async logCurrentState() {
        try {
            const metrics = this.tradingEngine.getPerformanceMetrics();
            await this.logger.logPerformanceSnapshot(metrics, this.tradingEngine.portfolio);
        } catch (error) {
            console.error('Error logging current state:', error);
        }
    }

    /**
     * Display iteration summary
     */
    displayIterationSummary(signals, marketData) {
        const metrics = this.tradingEngine.getPerformanceMetrics();
        const openPositions = this.tradingEngine.getCurrentPositions();
        
        console.log('\n📋 === ITERATION SUMMARY ===');
        console.log(`💰 Portfolio: $${metrics.totalEquity.toFixed(2)} (${metrics.totalReturn.toFixed(2)}% total return)`);
        console.log(`📊 Positions: ${openPositions.length} open, Heat: ${metrics.portfolioHeat.toFixed(1)}%`);
        console.log(`📈 Signals: ${signals.length} generated`);
        console.log(`🎯 Performance: ${metrics.winRate.toFixed(1)}% WR, ${metrics.profitFactor.toFixed(2)} PF`);
        
        if (openPositions.length > 0) {
            console.log('💼 Open Positions:');
            openPositions.forEach(pos => {
                const pnlColor = pos.unrealizedPnL >= 0 ? '🟢' : '🔴';
                console.log(`  ${pnlColor} ${pos.symbol}: ${pos.direction} @ $${pos.entryPrice.toFixed(4)} | P&L: ${pos.unrealizedPnLPercent.toFixed(2)}%`);
            });
        }
        
        console.log('==========================\n');
    }

    /**
     * Stop the trading bot
     */
    stop() {
        console.log('🛑 Stopping trading bot...');
        this.isRunning = false;
    }

    /**
     * Generate performance report
     */
    async generateReport() {
        if (!this.logger) {
            await this.initialize();
        }
        
        console.log('📊 Generating performance report...');
        const report = await this.logger.generatePerformanceReport();
        return report;
    }

    /**
     * Reset portfolio (for testing)
     */
    async resetPortfolio() {
        if (!this.tradingEngine) {
            await this.initialize();
        }
        
        await this.tradingEngine.resetPortfolio();
        console.log('🔄 Portfolio reset successfully');
    }

    /**
     * Clean old logs
     */
    async cleanLogs(maxEntries = 5000) {
        if (!this.logger) {
            await this.initialize();
        }
        
        await this.logger.cleanOldLogs(maxEntries);
        console.log('🧹 Log cleanup completed');
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'run';
    
    const bot = new TradingBot();
    
    try {
        switch (command) {
            case 'run':
                await bot.initialize();
                await bot.run();
                break;
                
            case 'test':
                await bot.initialize();
                console.log('🧪 Test completed successfully');
                break;
                
            case 'report':
                await bot.generateReport();
                break;
                
            case 'reset':
                await bot.resetPortfolio();
                break;
                
            case 'clean':
                await bot.cleanLogs();
                break;
                
            default:
                console.log(`
🤖 Trading Bot Commands:
  npm start / node src/index.js        - Start trading bot
  npm run test / node src/index.js test - Test initialization
  node src/index.js report              - Generate performance report
  node src/index.js reset               - Reset portfolio
  node src/index.js clean               - Clean old logs
                `);
        }
    } catch (error) {
        console.error('❌ Command failed:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default TradingBot;