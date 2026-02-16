#!/usr/bin/env node
/**
 * Quick Validation Test
 * Confirms the V2 signal generator and paper trading engine fixes work
 */

import fs from 'fs/promises';
import path from 'path';
import TechnicalIndicators from './indicators/index.js';
import SignalGenerator from './signals/generator-v2.js';
import PaperTradingEngine from './paper/engine-v2.js';

async function runValidationTest() {
    console.log('🧪 Running System Validation Test...\n');

    // Load sample data
    const dataFile = './data/backtest/BTCUSDT_4h_historical.json';
    const fileContent = await fs.readFile(dataFile, 'utf8');
    const data = JSON.parse(fileContent);
    
    data.candles = data.candles.map(candle => ({
        ...candle,
        openTime: new Date(candle.openTime),
        closeTime: new Date(candle.closeTime)
    }));

    console.log(`📊 Testing with ${data.candles.length} candles\n`);

    // Test signal generation across presets
    const presets = ['balanced', 'active', 'aggressive', 'scalper'];
    const testIndex = Math.floor(data.candles.length * 0.75);
    const availableCandles = data.candles.slice(0, testIndex + 1);
    const indicators = new TechnicalIndicators();
    const analysis = indicators.analyzeMarket(availableCandles);

    console.log('🎯 SIGNAL GENERATION TEST:');
    console.log('===========================');

    for (const preset of presets) {
        const generator = new SignalGenerator({ preset });
        const signals = generator.generateSignals(analysis, 'BTCUSDT');
        
        console.log(`${preset.toUpperCase()}: ${signals.length} signals generated`);
        if (signals.length > 0) {
            const avgScore = signals.reduce((sum, s) => sum + s.score, 0) / signals.length;
            console.log(`   Average Score: ${avgScore.toFixed(1)}/100`);
            console.log(`   Types: ${[...new Set(signals.map(s => s.type))].join(', ')}`);
        }
    }

    // Test position sizing fixes
    console.log('\n💰 POSITION SIZING TEST:');
    console.log('=========================');

    const config = {
        preset: 'balanced',
        paperBalance: 10000,
        riskPerTrade: 0.02,
        maxPortfolioHeat: 0.06,
        fees: 0.001,
        maxPositionSize: 0.25
    };

    const generator = new SignalGenerator(config);
    const engine = new PaperTradingEngine(config);
    await engine.resetPortfolio();

    // Generate a test signal
    const signals = generator.generateSignals(analysis, 'BTCUSDT');
    if (signals.length > 0) {
        const testSignal = signals[0];
        const currentPrice = analysis.currentPrice;

        console.log(`Testing signal: ${testSignal.type} at $${currentPrice.toFixed(2)}`);
        console.log(`Stop Loss: $${testSignal.stopLoss.toFixed(2)}`);
        console.log(`Risk Distance: $${Math.abs(currentPrice - testSignal.stopLoss).toFixed(2)}`);

        // Test position sizing
        const positionSize = engine.calculatePositionSize(testSignal, currentPrice);
        const positionValue = positionSize * currentPrice;
        const positionRisk = positionSize * Math.abs(currentPrice - testSignal.stopLoss);
        const riskPercent = positionRisk / engine.portfolio.equity;

        console.log(`\nCalculated Position:`);
        console.log(`   Size: ${positionSize.toFixed(4)} units`);
        console.log(`   Value: $${positionValue.toFixed(2)} (${(positionValue/engine.portfolio.equity*100).toFixed(1)}% of portfolio)`);
        console.log(`   Risk: $${positionRisk.toFixed(2)} (${(riskPercent*100).toFixed(2)}% of portfolio)`);

        // Validate it's within limits
        if (riskPercent <= config.riskPerTrade * 1.1) {
            console.log(`✅ Risk management: PASSED (${(riskPercent*100).toFixed(2)}% <= ${(config.riskPerTrade*100).toFixed(1)}%)`);
        } else {
            console.log(`❌ Risk management: FAILED (${(riskPercent*100).toFixed(2)}% > ${(config.riskPerTrade*100).toFixed(1)}%)`);
        }

        if (positionValue / engine.portfolio.equity <= config.maxPositionSize) {
            console.log(`✅ Position size: PASSED (${(positionValue/engine.portfolio.equity*100).toFixed(1)}% <= ${(config.maxPositionSize*100).toFixed(1)}%)`);
        } else {
            console.log(`❌ Position size: FAILED (${(positionValue/engine.portfolio.equity*100).toFixed(1)}% > ${(config.maxPositionSize*100).toFixed(1)}%)`);
        }

        // Test trade execution
        console.log('\n🔄 TRADE EXECUTION TEST:');
        console.log('========================');

        const trade = await engine.executeTrade(testSignal, currentPrice);
        if (trade) {
            console.log(`✅ Trade executed successfully:`);
            console.log(`   ID: ${trade.id}`);
            console.log(`   Direction: ${trade.direction}`);
            console.log(`   Quantity: ${trade.quantity.toFixed(4)}`);
            console.log(`   Entry: $${trade.entryPrice.toFixed(2)}`);
            console.log(`   Stop: $${trade.stopLoss.toFixed(2)}`);
            console.log(`   Risk: ${((Math.abs(trade.entryPrice - trade.stopLoss) * trade.quantity) / engine.portfolio.equity * 100).toFixed(2)}%`);
        } else {
            console.log(`❌ Trade execution failed`);
        }

        // Test metrics
        const metrics = engine.getPerformanceMetrics();
        console.log(`\n📊 Portfolio after trade:`);
        console.log(`   Balance: $${metrics.totalBalance.toFixed(2)}`);
        console.log(`   Equity: $${metrics.totalEquity.toFixed(2)}`);
        console.log(`   Open Positions: ${metrics.openPositions}`);
        console.log(`   Portfolio Heat: ${metrics.portfolioHeat.toFixed(2)}%`);

    } else {
        console.log('❌ No signals generated for testing');
    }

    console.log('\n✅ Validation Test Complete!');
}

// Run the test
runValidationTest().catch(console.error);