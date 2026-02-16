#!/usr/bin/env node
/**
 * Signal Generation Diagnostic Tool
 * Analyzes why signals aren't being generated
 */

import fs from 'fs/promises';
import path from 'path';
import TechnicalIndicators from './indicators/index.js';
import SignalGenerator from './signals/generator.js';

class SignalDiagnostic {
    constructor() {
        this.indicators = new TechnicalIndicators();
        this.generator = new SignalGenerator({
            minConfirmations: 3,
            minRiskReward: 3,
            stopLossMultiplier: 2.5,
            takeProfitRatios: [2, 4, 6]
        });
        this.dataDir = './data/backtest';
    }

    async runDiagnostic() {
        console.log('🔍 Starting Signal Generation Diagnostic...\n');

        // Load sample data
        const data = await this.loadSampleData();
        
        if (!data) {
            console.error('❌ Could not load sample data');
            return;
        }

        console.log(`📊 Analyzing ${data.symbol} ${data.timeframe} - ${data.candles.length} candles`);
        console.log(`   Period: ${data.candles[0].openTime} to ${data.candles[data.candles.length - 1].openTime}\n`);

        // Analyze multiple time points
        const samplePoints = [
            Math.floor(data.candles.length * 0.25), // 25% through
            Math.floor(data.candles.length * 0.50), // 50% through
            Math.floor(data.candles.length * 0.75), // 75% through
            data.candles.length - 1 // Latest
        ];

        for (let i = 0; i < samplePoints.length; i++) {
            const index = samplePoints[i];
            await this.analyzeTimePoint(data, index, i + 1);
        }

        // Run a broader analysis
        await this.runBroadAnalysis(data);
    }

    async loadSampleData() {
        try {
            // Load BTC 4h data as primary test case
            const filename = path.join(this.dataDir, 'BTCUSDT_4h_historical.json');
            const fileContent = await fs.readFile(filename, 'utf8');
            const data = JSON.parse(fileContent);

            // Convert dates
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

    async analyzeTimePoint(data, endIndex, sampleNumber) {
        console.log(`\n=== SAMPLE ${sampleNumber}: Analysis at index ${endIndex} ===`);
        
        if (endIndex < 200) {
            console.log('⚠️  Insufficient data for analysis (need at least 200 candles)\n');
            return;
        }

        // Get candles up to this point
        const availableCandles = data.candles.slice(0, endIndex + 1);
        const currentCandle = availableCandles[availableCandles.length - 1];
        
        console.log(`📅 Date: ${currentCandle.openTime.toISOString().split('T')[0]}`);
        console.log(`💰 Price: $${currentCandle.close.toLocaleString()}`);

        try {
            // Run market analysis
            const analysis = this.indicators.analyzeMarket(availableCandles);
            
            // Display key indicator values
            this.displayIndicatorValues(analysis);
            
            // Generate signals
            const signals = this.generator.generateSignals(analysis, data.symbol);
            
            // Analyze signal generation
            this.analyzeSignalGeneration(analysis, signals, data.symbol);

        } catch (error) {
            console.error(`❌ Analysis error:`, error.message);
        }
    }

    displayIndicatorValues(analysis) {
        const { indicators } = analysis;
        
        console.log('\n📈 INDICATOR VALUES:');
        
        // RSI
        if (indicators.rsi?.current) {
            console.log(`   RSI: ${indicators.rsi.current.toFixed(2)} (${indicators.rsi.signal})`);
        }
        
        // MACD
        if (indicators.macd?.current) {
            console.log(`   MACD: ${indicators.macd.current.MACD.toFixed(4)} | Signal: ${indicators.macd.current.signal.toFixed(4)} | Histogram: ${indicators.macd.current.histogram.toFixed(4)}`);
            console.log(`   MACD Signal: ${indicators.macd.signal} | Bullish Crossover: ${indicators.macd.bullishCrossover}`);
        }
        
        // EMAs and Trend Alignment
        console.log('\n📊 MOVING AVERAGES & TREND:');
        if (indicators.emas?.ema21?.current) {
            console.log(`   Price: $${analysis.currentPrice.toFixed(2)}`);
            console.log(`   EMA21: $${indicators.emas.ema21.current.toFixed(2)}`);
            console.log(`   EMA50: $${indicators.emas.ema50.current.toFixed(2)}`);
            if (indicators.emas.ema200?.current) {
                console.log(`   EMA200: $${indicators.emas.ema200.current.toFixed(2)}`);
            }
            
            const alignment = indicators.emas.trendAlignment;
            console.log(`   Trend Alignment: ${alignment.aligned ? '✅' : '❌'} ${alignment.direction} (Score: ${alignment.strength}/${alignment.maxScore})`);
            
            // Check individual alignments
            const price = analysis.currentPrice;
            const ema21 = indicators.emas.ema21.current;
            const ema50 = indicators.emas.ema50.current;
            const ema200 = indicators.emas.ema200?.current;
            
            console.log(`   Price > EMA21: ${price > ema21 ? '✅' : '❌'} (${price.toFixed(2)} vs ${ema21.toFixed(2)})`);
            console.log(`   EMA21 > EMA50: ${ema21 > ema50 ? '✅' : '❌'} (${ema21.toFixed(2)} vs ${ema50.toFixed(2)})`);
            if (ema200) {
                console.log(`   EMA50 > EMA200: ${ema50 > ema200 ? '✅' : '❌'} (${ema50.toFixed(2)} vs ${ema200.toFixed(2)})`);
            }
        }
        
        // ADX
        if (indicators.adx?.current) {
            console.log(`\n🌊 TREND STRENGTH & REGIME:`);
            console.log(`   ADX: ${indicators.adx.current.adx.toFixed(2)} (${indicators.adx.trendStrength})`);
            console.log(`   +DI: ${indicators.adx.current.pdi.toFixed(2)} | -DI: ${indicators.adx.current.mdi.toFixed(2)}`);
            console.log(`   Market Regime: ${indicators.adx.regime} | Signal: ${indicators.adx.signal}`);
        }
        
        // Volume
        if (indicators.volumeAnalysis) {
            console.log(`\n📊 VOLUME ANALYSIS:`);
            console.log(`   Current: ${indicators.volumeAnalysis.current?.toFixed(0) || 'N/A'}`);
            console.log(`   Average: ${indicators.volumeAnalysis.average?.toFixed(0) || 'N/A'}`);
            console.log(`   Ratio: ${indicators.volumeAnalysis.ratio?.toFixed(2) || 'N/A'}x (${indicators.volumeAnalysis.signal})`);
        }
        
        // ATR
        if (indicators.atr?.current) {
            console.log(`\n💥 VOLATILITY:`);
            console.log(`   ATR: $${indicators.atr.current.toFixed(2)} (${indicators.atr.volatility})`);
        }
        
        // Bollinger Bands
        if (indicators.bollinger?.current) {
            console.log(`\n📏 BOLLINGER BANDS:`);
            const bb = indicators.bollinger.current;
            const price = analysis.currentPrice;
            console.log(`   Upper: $${bb.upper.toFixed(2)} | Middle: $${bb.middle.toFixed(2)} | Lower: $${bb.lower.toFixed(2)}`);
            console.log(`   Position: ${indicators.bollinger.position} | Squeeze: ${indicators.bollinger.squeeze ? '✅' : '❌'}`);
            console.log(`   Upper Breakout: ${indicators.bollinger.upperBreakout ? '✅' : '❌'} | Lower Breakout: ${indicators.bollinger.lowerBreakout ? '✅' : '❌'}`);
        }
    }

    analyzeSignalGeneration(analysis, signals, symbol) {
        console.log('\n🎯 SIGNAL GENERATION ANALYSIS:');
        
        if (signals.length > 0) {
            console.log(`✅ Generated ${signals.length} signal(s):`);
            signals.forEach((signal, i) => {
                console.log(`   Signal ${i + 1}: ${signal.type} (${signal.direction})`);
                console.log(`      Confidence: ${signal.confidence.toFixed(1)}%`);
                console.log(`      Confirmations: ${signal.confirmations}`);
                console.log(`      Risk/Reward: ${signal.riskRewardRatio.toFixed(2)}`);
                console.log(`      Reasoning: ${signal.reasoning}`);
                console.log(`      Entry: $${signal.entryPrice.toFixed(2)} | Stop: $${signal.stopLoss.toFixed(2)}`);
            });
        } else {
            console.log('❌ No signals generated');
            
            // Analyze why each signal type failed
            this.analyzeFailedSignals(analysis, symbol);
        }
    }

    analyzeFailedSignals(analysis, symbol) {
        console.log('\n🔬 WHY SIGNALS FAILED:');
        
        // Test trend following
        console.log('\n1️⃣ TREND FOLLOWING:');
        const trendResult = this.testTrendFollowingConditions(analysis.indicators, analysis.assessment, analysis.currentPrice);
        
        // Test mean reversion
        console.log('\n2️⃣ MEAN REVERSION:');
        const meanRevResult = this.testMeanReversionConditions(analysis.indicators, analysis.assessment, analysis.currentPrice);
        
        // Test breakout
        console.log('\n3️⃣ BREAKOUT:');
        const breakoutResult = this.testBreakoutConditions(analysis.indicators, analysis.assessment, analysis.currentPrice);
    }

    testTrendFollowingConditions(indicators, assessment, currentPrice) {
        let confirmations = 0;
        const tests = [];
        
        // Primary trend alignment check
        if (indicators.emas.trendAlignment.aligned && indicators.emas.trendAlignment.direction.includes('bullish')) {
            confirmations++;
            tests.push('✅ Trend alignment confirmed');
        } else {
            tests.push(`❌ Trend alignment failed: ${indicators.emas.trendAlignment.direction} (aligned: ${indicators.emas.trendAlignment.aligned})`);
            tests.push('   → This is the PRIMARY requirement - without it, no trend following signal can be generated');
        }

        // Momentum confirmation
        if (indicators.rsi?.current > 50 && indicators.macd?.signal?.includes('bullish')) {
            confirmations++;
            tests.push('✅ Momentum indicators bullish');
        } else {
            tests.push(`❌ Momentum failed: RSI=${indicators.rsi?.current?.toFixed(2)} (need >50), MACD=${indicators.macd?.signal}`);
        }

        // Volume confirmation
        if (indicators.volumeAnalysis?.ratio > 1.5) {
            confirmations++;
            tests.push('✅ Volume surge confirmed');
        } else {
            tests.push(`❌ Volume surge failed: ${indicators.volumeAnalysis?.ratio?.toFixed(2)}x (need >1.5x)`);
        }

        // ADX trend strength
        if (indicators.adx?.current?.adx > 25) {
            confirmations++;
            tests.push('✅ Strong trend detected by ADX');
        } else {
            tests.push(`❌ ADX trend strength failed: ${indicators.adx?.current?.adx?.toFixed(2)} (need >25)`);
        }

        // Price above key EMAs
        if (currentPrice > indicators.emas?.ema21?.current && currentPrice > indicators.emas?.ema50?.current) {
            confirmations++;
            tests.push('✅ Price above key moving averages');
        } else {
            tests.push(`❌ Price not above EMAs: Price=${currentPrice.toFixed(2)}, EMA21=${indicators.emas?.ema21?.current?.toFixed(2)}, EMA50=${indicators.emas?.ema50?.current?.toFixed(2)}`);
        }

        // RSI overbought check
        if (indicators.rsi?.current > 75) {
            tests.push(`❌ RSI overbought: ${indicators.rsi.current.toFixed(2)} (avoiding entry)`);
        } else {
            tests.push(`✅ RSI not overbought: ${indicators.rsi?.current?.toFixed(2)}`);
        }

        tests.forEach(test => console.log(`   ${test}`));
        console.log(`   📊 Total confirmations: ${confirmations} (need ≥2 for signal, ≥3 after filtering)`);
        
        return { confirmations, tests };
    }

    testMeanReversionConditions(indicators, assessment, currentPrice) {
        let confirmations = 0;
        const tests = [];
        
        // Don't mean revert in strong trends
        if (assessment.marketRegime?.type === 'trending' && assessment.marketRegime?.strength === 'strong') {
            tests.push(`❌ Strong trend detected - mean reversion avoided: ${assessment.marketRegime.type}/${assessment.marketRegime.strength}`);
            tests.forEach(test => console.log(`   ${test}`));
            return { confirmations: 0, tests };
        } else {
            tests.push(`✅ Market regime allows mean reversion: ${assessment.marketRegime?.type || 'unknown'}`);
        }

        // Oversold condition
        if (indicators.rsi?.current < 30 || (indicators.stochRsi && indicators.stochRsi.oversold)) {
            confirmations++;
            tests.push('✅ Oversold conditions detected');
        } else {
            tests.push(`❌ Not oversold: RSI=${indicators.rsi?.current?.toFixed(2)} (need <30), StochRSI oversold=${indicators.stochRsi?.oversold || false}`);
        }

        // Price near Bollinger Band lower band
        if (indicators.bollinger?.position === 'below_lower') {
            confirmations++;
            tests.push('✅ Price below Bollinger Band lower band');
        } else {
            tests.push(`❌ Not below BB lower band: position=${indicators.bollinger?.position}`);
        }

        // Volume decreasing (selling exhaustion)
        if (indicators.volumeAnalysis?.signal === 'low' || indicators.volumeAnalysis?.signal === 'dry_up') {
            confirmations++;
            tests.push('✅ Volume showing selling exhaustion');
        } else {
            tests.push(`❌ Volume not showing exhaustion: ${indicators.volumeAnalysis?.signal} (${indicators.volumeAnalysis?.ratio?.toFixed(2)}x)`);
        }

        // Support level approximation
        const supportNearby = this.isPriceNearSupport(currentPrice, indicators);
        if (supportNearby) {
            confirmations++;
            tests.push('✅ Price near potential support level');
        } else {
            tests.push(`❌ Not near support level`);
        }

        // OBV divergence
        if (indicators.obv?.trend === 'bullish' && indicators.rsi?.current < 40) {
            confirmations++;
            tests.push('✅ Potential bullish divergence detected');
        } else {
            tests.push(`❌ No divergence: OBV trend=${indicators.obv?.trend}, RSI=${indicators.rsi?.current?.toFixed(2)}`);
        }

        tests.forEach(test => console.log(`   ${test}`));
        console.log(`   📊 Total confirmations: ${confirmations} (need ≥2 for signal, ≥3 after filtering)`);
        
        return { confirmations, tests };
    }

    testBreakoutConditions(indicators, assessment, currentPrice) {
        let confirmations = 0;
        const tests = [];

        // Volume surge required for breakouts
        if (!indicators.volumeAnalysis?.ratio || indicators.volumeAnalysis.ratio < 1.5) {
            tests.push(`❌ Insufficient volume for breakout: ${indicators.volumeAnalysis?.ratio?.toFixed(2)}x (need ≥1.5x)`);
            tests.push('   → This is a HARD requirement - no breakout signals without volume');
            tests.forEach(test => console.log(`   ${test}`));
            return { confirmations: 0, tests };
        } else {
            tests.push(`✅ Volume surge present: ${indicators.volumeAnalysis.ratio.toFixed(2)}x`);
        }

        // Bollinger Band breakout
        if (indicators.bollinger?.upperBreakout) {
            confirmations++;
            tests.push('✅ Breakout above Bollinger Band upper band');
        } else {
            tests.push(`❌ No BB upper breakout: upperBreakout=${indicators.bollinger?.upperBreakout}`);
        }

        // Coming out of consolidation
        if (indicators.bollinger?.squeeze && assessment.volatility?.expansion) {
            confirmations++;
            tests.push('✅ Volatility expansion after squeeze');
        } else {
            tests.push(`❌ No volatility expansion: squeeze=${indicators.bollinger?.squeeze}, expansion=${assessment.volatility?.expansion}`);
        }

        // Volume surge levels
        if (indicators.volumeAnalysis?.ratio > 2.0) {
            confirmations++;
            tests.push('✅ Significant volume surge detected');
        } else if (indicators.volumeAnalysis?.ratio > 1.5) {
            confirmations++;
            tests.push('✅ Volume surge confirmed');
        }

        // Momentum confirmation
        if (indicators.rsi?.current > 55 && !indicators.rsi?.overbought) {
            confirmations++;
            tests.push('✅ Momentum building without overbought condition');
        } else {
            tests.push(`❌ Momentum insufficient: RSI=${indicators.rsi?.current?.toFixed(2)} (need >55), overbought=${indicators.rsi?.overbought}`);
        }

        // MACD confirmation
        if (indicators.macd?.bullishCrossover || (indicators.macd?.signal === 'bullish' && indicators.macd?.current?.histogram > 0)) {
            confirmations++;
            tests.push('✅ MACD confirming bullish momentum');
        } else {
            tests.push(`❌ MACD not confirming: bullish crossover=${indicators.macd?.bullishCrossover}, signal=${indicators.macd?.signal}, histogram=${indicators.macd?.current?.histogram?.toFixed(4)}`);
        }

        // ADX showing trend development
        if (indicators.adx?.current?.adx > 20 && indicators.adx?.signal?.includes('bullish')) {
            confirmations++;
            tests.push('✅ ADX showing developing bullish trend');
        } else {
            tests.push(`❌ ADX not confirming: ${indicators.adx?.current?.adx?.toFixed(2)} (need >20), signal=${indicators.adx?.signal}`);
        }

        tests.forEach(test => console.log(`   ${test}`));
        console.log(`   📊 Total confirmations: ${confirmations} (need ≥3 for signal)`);
        
        return { confirmations, tests };
    }

    isPriceNearSupport(currentPrice, indicators) {
        if (indicators.bollinger?.current) {
            const lowerBand = indicators.bollinger.current.lower;
            const distance = Math.abs(currentPrice - lowerBand) / currentPrice;
            return distance < 0.02; // Within 2% of lower band
        }
        return false;
    }

    async runBroadAnalysis(data) {
        console.log('\n\n🔍 BROAD SIGNAL FREQUENCY ANALYSIS');
        console.log('====================================');
        
        let totalPeriods = 0;
        let periodsWithSignals = 0;
        let totalSignals = 0;
        const signalTypes = {};
        const failureReasons = {};

        // Analyze every 50th point to get a broad sample
        const sampleInterval = 50;
        const startIndex = 200; // Need warm-up period
        
        for (let i = startIndex; i < data.candles.length; i += sampleInterval) {
            totalPeriods++;
            
            const availableCandles = data.candles.slice(0, i + 1);
            
            try {
                const analysis = this.indicators.analyzeMarket(availableCandles);
                const signals = this.generator.generateSignals(analysis, data.symbol);
                
                if (signals.length > 0) {
                    periodsWithSignals++;
                    totalSignals += signals.length;
                    
                    signals.forEach(signal => {
                        signalTypes[signal.type] = (signalTypes[signal.type] || 0) + 1;
                    });
                } else {
                    // Analyze why no signals were generated
                    const reasons = this.getFailureReasons(analysis);
                    reasons.forEach(reason => {
                        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
                    });
                }
                
            } catch (error) {
                console.warn(`Analysis error at index ${i}:`, error.message);
            }
        }

        console.log(`\n📊 SUMMARY STATISTICS:`);
        console.log(`   Total periods analyzed: ${totalPeriods}`);
        console.log(`   Periods with signals: ${periodsWithSignals} (${((periodsWithSignals / totalPeriods) * 100).toFixed(1)}%)`);
        console.log(`   Total signals generated: ${totalSignals}`);
        console.log(`   Average signals per period: ${(totalSignals / totalPeriods).toFixed(3)}`);
        
        if (Object.keys(signalTypes).length > 0) {
            console.log(`\n🎯 SIGNAL TYPES:`);
            Object.entries(signalTypes)
                .sort(([,a], [,b]) => b - a)
                .forEach(([type, count]) => {
                    console.log(`   ${type}: ${count} (${((count / totalSignals) * 100).toFixed(1)}%)`);
                });
        }
        
        console.log(`\n❌ TOP FAILURE REASONS:`);
        Object.entries(failureReasons)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .forEach(([reason, count]) => {
                console.log(`   ${reason}: ${count} times (${((count / (totalPeriods - periodsWithSignals)) * 100).toFixed(1)}%)`);
            });
    }

    getFailureReasons(analysis) {
        const reasons = [];
        const { indicators } = analysis;
        
        // Check common failure conditions
        if (!indicators.emas.trendAlignment.aligned) {
            reasons.push('No trend alignment');
        }
        
        if (indicators.volumeAnalysis?.ratio < 1.5) {
            reasons.push('Insufficient volume');
        }
        
        if (indicators.adx?.current?.adx < 20) {
            reasons.push('ADX too low');
        }
        
        if (indicators.rsi?.current > 70) {
            reasons.push('RSI overbought');
        }
        
        if (indicators.rsi?.current < 30) {
            reasons.push('RSI oversold');
        }
        
        if (!indicators.atr?.current || indicators.atr.current <= 0) {
            reasons.push('Invalid ATR');
        }
        
        return reasons;
    }
}

// Main execution
async function runDiagnostic() {
    const diagnostic = new SignalDiagnostic();
    await diagnostic.runDiagnostic();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runDiagnostic().catch(console.error);
}

export default SignalDiagnostic;