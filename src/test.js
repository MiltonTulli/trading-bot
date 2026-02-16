#!/usr/bin/env node
/**
 * Test Suite
 * Verify all components are working correctly
 */

import TradingBot from './index.js';
import PriceFeed from './feeds/prices.js';
import TechnicalIndicators from './indicators/index.js';
import SignalGenerator from './signals/generator.js';
import NewsFeed from './feeds/news.js';

class TestSuite {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    /**
     * Add a test
     */
    test(name, testFn) {
        this.tests.push({ name, testFn });
    }

    /**
     * Run all tests
     */
    async runAll() {
        console.log('🧪 Starting Test Suite...\n');
        
        for (const { name, testFn } of this.tests) {
            try {
                console.log(`🔍 Testing: ${name}`);
                await testFn();
                console.log(`✅ PASS: ${name}\n`);
                this.passed++;
            } catch (error) {
                console.log(`❌ FAIL: ${name}`);
                console.log(`   Error: ${error.message}\n`);
                this.failed++;
            }
        }

        this.printSummary();
    }

    /**
     * Print test summary
     */
    printSummary() {
        const total = this.passed + this.failed;
        const passRate = total > 0 ? (this.passed / total * 100).toFixed(1) : '0';
        
        console.log('📊 Test Results:');
        console.log(`   Total: ${total}`);
        console.log(`   Passed: ${this.passed} ✅`);
        console.log(`   Failed: ${this.failed} ❌`);
        console.log(`   Pass Rate: ${passRate}%`);
        
        if (this.failed === 0) {
            console.log('\n🎉 All tests passed!');
        } else {
            console.log('\n⚠️ Some tests failed. Check the output above.');
        }
    }

    /**
     * Assert helper
     */
    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }
}

// Create test suite
const testSuite = new TestSuite();

// Test configuration loading
testSuite.test('Configuration Loading', async () => {
    const bot = new TradingBot();
    await bot.loadConfig();
    
    testSuite.assert(bot.config !== null, 'Configuration should be loaded');
    testSuite.assert(Array.isArray(bot.config.pairs), 'Pairs should be an array');
    testSuite.assert(bot.config.pairs.includes('BTCUSDT'), 'Should include BTCUSDT');
    testSuite.assert(bot.config.pairs.includes('ETHUSDT'), 'Should include ETHUSDT');
});

// Test price feed
testSuite.test('Price Feed - Latest Price', async () => {
    const config = { binanceBaseUrl: 'https://api.binance.com' };
    const priceFeed = new PriceFeed(config);
    
    const btcPrice = await priceFeed.getLatestPrice('BTCUSDT');
    
    testSuite.assert(btcPrice.symbol === 'BTCUSDT', 'Symbol should match');
    testSuite.assert(typeof btcPrice.price === 'number', 'Price should be a number');
    testSuite.assert(btcPrice.price > 0, 'Price should be positive');
    testSuite.assert(btcPrice.timestamp instanceof Date, 'Timestamp should be a Date');
});

// Test candle data
testSuite.test('Price Feed - Candle Data', async () => {
    const config = { binanceBaseUrl: 'https://api.binance.com', maxCandles: 1000, cacheExpiration: 300000 };
    const priceFeed = new PriceFeed(config);
    
    const candles = await priceFeed.getCandles('BTCUSDT', '1h', 100);
    
    testSuite.assert(Array.isArray(candles), 'Candles should be an array');
    testSuite.assert(candles.length > 0, 'Should fetch candles');
    testSuite.assert(candles.length <= 100, 'Should respect limit');
    
    const candle = candles[0];
    testSuite.assert(typeof candle.open === 'number', 'Open should be number');
    testSuite.assert(typeof candle.high === 'number', 'High should be number');
    testSuite.assert(typeof candle.low === 'number', 'Low should be number');
    testSuite.assert(typeof candle.close === 'number', 'Close should be number');
    testSuite.assert(typeof candle.volume === 'number', 'Volume should be number');
    testSuite.assert(candle.openTime instanceof Date, 'OpenTime should be Date');
});

// Test technical indicators
testSuite.test('Technical Indicators - RSI Calculation', async () => {
    const indicators = new TechnicalIndicators();
    const closes = [44, 44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.85, 46.08, 45.89, 46.03, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
    
    const rsi = indicators.calculateRSI(closes);
    
    testSuite.assert(rsi.current !== null, 'RSI should calculate');
    testSuite.assert(typeof rsi.current === 'number', 'RSI should be number');
    testSuite.assert(rsi.current >= 0 && rsi.current <= 100, 'RSI should be between 0-100');
    testSuite.assert(typeof rsi.signal === 'string', 'RSI should have signal');
});

// Test market analysis
testSuite.test('Technical Indicators - Market Analysis', async () => {
    const config = { binanceBaseUrl: 'https://api.binance.com', maxCandles: 1000, cacheExpiration: 300000 };
    const priceFeed = new PriceFeed(config);
    const indicators = new TechnicalIndicators();
    
    const candles = await priceFeed.getCandles('BTCUSDT', '1h', 200);
    const analysis = indicators.analyzeMarket(candles);
    
    testSuite.assert(analysis.currentPrice > 0, 'Should have current price');
    testSuite.assert(analysis.indicators !== null, 'Should have indicators');
    testSuite.assert(analysis.assessment !== null, 'Should have assessment');
    testSuite.assert(typeof analysis.indicators.rsi.current === 'number', 'Should calculate RSI');
    testSuite.assert(analysis.assessment.marketRegime !== null, 'Should determine market regime');
});

// Test signal generation
testSuite.test('Signal Generator - Basic Signals', async () => {
    const config = { 
        minConfirmations: 3, 
        minRiskReward: 3, 
        stopLossMultiplier: 2.5,
        takeProfitRatios: [2, 4, 6]
    };
    const signalGenerator = new SignalGenerator(config);
    
    // Create mock market analysis
    const mockAnalysis = {
        currentPrice: 50000,
        indicators: {
            rsi: { current: 45, signal: 'neutral' },
            macd: { signal: 'bullish', current: { MACD: 100, signal: 80 } },
            emas: { 
                trendAlignment: { aligned: true, direction: 'bullish' },
                ema21: { current: 49500 },
                ema50: { current: 49000 }
            },
            volumeAnalysis: { ratio: 1.8, signal: 'high' },
            adx: { current: { adx: 30 }, regime: 'trending' },
            atr: { current: 1000 },
            bollinger: { position: 'inside_bands', squeeze: false }
        },
        assessment: {
            marketRegime: { type: 'trending' }
        }
    };
    
    const signals = signalGenerator.generateSignals(mockAnalysis, 'BTCUSDT');
    
    testSuite.assert(Array.isArray(signals), 'Should return array of signals');
    // Note: signals might be empty if conditions aren't met, which is valid
});

// Test news feed
testSuite.test('News Feed - Basic News Fetch', async () => {
    const config = { cryptoCompareApiUrl: 'https://min-api.cryptocompare.com' };
    const newsFeed = new NewsFeed(config);
    
    const news = await newsFeed.fetchCryptoCompareNews(5);
    
    testSuite.assert(Array.isArray(news), 'News should be array');
    
    if (news.length > 0) {
        const article = news[0];
        testSuite.assert(typeof article.title === 'string', 'Article should have title');
        testSuite.assert(typeof article.sentiment === 'object', 'Article should have sentiment');
        testSuite.assert(article.publishedOn instanceof Date, 'Article should have published date');
    }
});

// Test sentiment analysis
testSuite.test('News Feed - Sentiment Analysis', async () => {
    const config = { cryptoCompareApiUrl: 'https://min-api.cryptocompare.com' };
    const newsFeed = new NewsFeed(config);
    
    const bullishText = 'Bitcoin shows bullish momentum with strong adoption and positive growth';
    const bearishText = 'Bitcoin crashes amid regulatory concerns and bearish sentiment';
    const neutralText = 'Bitcoin price remains stable today';
    
    const bullishSentiment = newsFeed.analyzeSentiment(bullishText);
    const bearishSentiment = newsFeed.analyzeSentiment(bearishText);
    const neutralSentiment = newsFeed.analyzeSentiment(neutralText);
    
    testSuite.assert(bullishSentiment.label.includes('bullish'), 'Should detect bullish sentiment');
    testSuite.assert(bearishSentiment.label.includes('bearish'), 'Should detect bearish sentiment');
    testSuite.assert(neutralSentiment.label === 'neutral', 'Should detect neutral sentiment');
});

// Test paper trading engine initialization
testSuite.test('Paper Trading Engine - Initialization', async () => {
    const config = { 
        paperBalance: 10000, 
        riskPerTrade: 0.01, 
        maxPortfolioHeat: 0.03, 
        fees: 0.001 
    };
    
    // Import the engine
    const { default: PaperTradingEngine } = await import('./paper/engine.js');
    const engine = new PaperTradingEngine(config);
    
    const metrics = engine.getPerformanceMetrics();
    
    testSuite.assert(metrics.totalEquity === 10000, 'Should start with initial balance');
    testSuite.assert(metrics.totalTrades === 0, 'Should start with no trades');
    testSuite.assert(metrics.winRate === 0, 'Should start with 0% win rate');
});

// Test bot initialization
testSuite.test('Bot Initialization', async () => {
    const bot = new TradingBot();
    await bot.initialize();
    
    testSuite.assert(bot.config !== null, 'Should have config');
    testSuite.assert(bot.priceFeed !== null, 'Should have price feed');
    testSuite.assert(bot.indicators !== null, 'Should have indicators');
    testSuite.assert(bot.signalGenerator !== null, 'Should have signal generator');
    testSuite.assert(bot.newsFeed !== null, 'Should have news feed');
    testSuite.assert(bot.tradingEngine !== null, 'Should have trading engine');
    testSuite.assert(bot.logger !== null, 'Should have logger');
});

// Test connectivity
testSuite.test('API Connectivity', async () => {
    const bot = new TradingBot();
    await bot.initialize();
    
    try {
        await bot.testConnectivity();
        // If no error thrown, test passes
    } catch (error) {
        if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
            console.log('   ⚠️ Network connectivity issue detected - this is expected in some environments');
        } else {
            throw error;
        }
    }
});

// Run all tests
async function main() {
    try {
        await testSuite.runAll();
        
        if (testSuite.failed > 0) {
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default TestSuite;