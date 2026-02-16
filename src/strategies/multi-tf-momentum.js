/**
 * Approach 4: Multi-Timeframe Momentum
 * 
 * Daily: Determine trend direction (EMA21 slope)
 * 4H: Wait for pullback to EMA21 or EMA50
 * 1H: Enter when momentum resumes in trend direction (MACD crossover or RSI bouncing from 40-50 zone in uptrend)
 * Stop: Below the pullback low
 * Target: Previous swing high/low
 * 
 * Note: This implementation simulates multi-timeframe analysis on 4H data
 * by using longer periods to approximate higher timeframes
 */

class MultiTimeframeMomentumStrategy {
    constructor(config = {}) {
        this.config = {
            riskPerTrade: config.riskPerTrade || 0.01,
            // Trend determination (daily equivalent)
            trendEma: 21, // EMA21 for trend
            trendPeriod: 6, // 6 * 4H = 24H (daily equivalent)
            
            // Pullback detection (4H)
            pullbackEma21: 21,
            pullbackEma50: 50,
            
            // Momentum confirmation (1H equivalent)
            macdFast: 3, // Shorter periods for 1H-like signals on 4H data
            macdSlow: 6,
            macdSignal: 2,
            rsiPeriod: 14,
            rsiUpTrendBounce: [40, 60], // RSI bounce zone in uptrend
            rsiDownTrendBounce: [40, 60], // RSI bounce zone in downtrend
            
            // Stop and target
            swingLookback: 20, // Look back for swing highs/lows
            atrMultiplier: 2,
            ...config
        };
    }

    /**
     * Calculate indicators for multi-timeframe momentum strategy
     */
    calculateIndicators(candles) {
        const indicators = {};
        
        // Trend determination (daily equivalent)
        indicators.trendEma = this.calculateEMA(candles, this.config.trendEma);
        indicators.trendSlope = this.calculateSlope(indicators.trendEma, this.config.trendPeriod);
        
        // Pullback EMAs (4H)
        indicators.ema21 = this.calculateEMA(candles, this.config.pullbackEma21);
        indicators.ema50 = this.calculateEMA(candles, this.config.pullbackEma50);
        
        // Momentum indicators (1H equivalent)
        const macd = this.calculateMACD(candles, this.config.macdFast, this.config.macdSlow, this.config.macdSignal);
        indicators.macdLine = macd.macdLine;
        indicators.macdSignal = macd.signalLine;
        indicators.macdHistogram = macd.histogram;
        
        indicators.rsi = this.calculateRSI(candles, this.config.rsiPeriod);
        
        // Support for stops and targets
        indicators.atr = this.calculateATR(candles, 14);
        indicators.swingHighs = this.findSwingHighs(candles, this.config.swingLookback);
        indicators.swingLows = this.findSwingLows(candles, this.config.swingLookback);
        
        return indicators;
    }

    /**
     * Generate signals based on multi-timeframe momentum logic
     */
    generateSignals(candles, config = {}) {
        if (candles.length < 100) {
            return []; // Need enough data for all indicators
        }

        const effectiveConfig = { ...this.config, ...config };
        const indicators = this.calculateIndicators(candles);
        const signals = [];

        for (let i = 60; i < candles.length - 1; i++) {
            const current = candles[i];
            const previous = candles[i - 1];
            const next = candles[i + 1];

            const trendSlope = indicators.trendSlope[i];
            const ema21 = indicators.ema21[i];
            const ema50 = indicators.ema50[i];
            const macdLine = indicators.macdLine[i];
            const macdSignal = indicators.macdSignal[i];
            const prevMacdLine = indicators.macdLine[i - 1];
            const prevMacdSignal = indicators.macdSignal[i - 1];
            const rsi = indicators.rsi[i];
            const atr = indicators.atr[i];
            const swingHigh = indicators.swingHighs[i];
            const swingLow = indicators.swingLows[i];

            if (!trendSlope || !ema21 || !ema50 || !macdLine || !macdSignal || !rsi || !atr) {
                continue;
            }

            // UPTREND LOGIC
            if (trendSlope > 0) { // Daily trend is up
                // Look for pullback to EMA21 or EMA50
                const pulledBackToEma21 = current.low <= ema21 && previous.low > ema21;
                const pulledBackToEma50 = current.low <= ema50 && previous.low > ema50;
                
                if (pulledBackToEma21 || pulledBackToEma50) {
                    // Check for momentum resumption
                    const macdCrossover = prevMacdLine <= prevMacdSignal && macdLine > macdSignal;
                    const rsiBounce = rsi >= this.config.rsiUpTrendBounce[0] && rsi <= this.config.rsiUpTrendBounce[1];
                    
                    if (macdCrossover || rsiBounce) {
                        const entry = next.open;
                        const stopLow = Math.min(current.low, previous.low);
                        const stop = stopLow - (atr * 0.5); // Small buffer below swing low
                        const target = swingHigh || (entry + (entry - stop) * 2); // 2:1 R/R if no swing high
                        const risk = entry - stop;
                        
                        if (risk > 0) {
                            const positionSize = (effectiveConfig.riskPerTrade * 10000) / risk;
                            
                            signals.push({
                                timestamp: next.timestamp,
                                type: 'LONG',
                                entry: entry,
                                stop: stop,
                                target: target,
                                positionSize: positionSize,
                                risk: risk,
                                confidence: this.calculateConfidence(trendSlope, macdCrossover, rsiBounce, 'LONG'),
                                reason: `Multi-TF momentum: Uptrend + pullback + momentum resumption`
                            });
                        }
                    }
                }
            }
            
            // DOWNTREND LOGIC
            if (trendSlope < 0) { // Daily trend is down
                // Look for pullback to EMA21 or EMA50 (bounce up)
                const bounceToEma21 = current.high >= ema21 && previous.high < ema21;
                const bounceToEma50 = current.high >= ema50 && previous.high < ema50;
                
                if (bounceToEma21 || bounceToEma50) {
                    // Check for momentum resumption (downward)
                    const macdCrossunder = prevMacdLine >= prevMacdSignal && macdLine < macdSignal;
                    const rsiReject = rsi >= this.config.rsiDownTrendBounce[0] && rsi <= this.config.rsiDownTrendBounce[1];
                    
                    if (macdCrossunder || rsiReject) {
                        const entry = next.open;
                        const stopHigh = Math.max(current.high, previous.high);
                        const stop = stopHigh + (atr * 0.5); // Small buffer above swing high
                        const target = swingLow || (entry - (stop - entry) * 2); // 2:1 R/R if no swing low
                        const risk = stop - entry;
                        
                        if (risk > 0) {
                            const positionSize = (effectiveConfig.riskPerTrade * 10000) / risk;
                            
                            signals.push({
                                timestamp: next.timestamp,
                                type: 'SHORT',
                                entry: entry,
                                stop: stop,
                                target: target,
                                positionSize: positionSize,
                                risk: risk,
                                confidence: this.calculateConfidence(trendSlope, macdCrossunder, rsiReject, 'SHORT'),
                                reason: `Multi-TF momentum: Downtrend + pullback + momentum resumption`
                            });
                        }
                    }
                }
            }
        }

        return signals;
    }

    calculateConfidence(trendSlope, macdSignal, rsiSignal, type) {
        let confidence = 50;
        
        // Stronger trend = higher confidence
        confidence += Math.min(Math.abs(trendSlope) * 1000, 20);
        
        // Multiple momentum confirmations
        if (macdSignal) confidence += 15;
        if (rsiSignal) confidence += 15;
        if (macdSignal && rsiSignal) confidence += 10; // Bonus for both
        
        return Math.min(confidence, 100);
    }

    // Technical indicator calculations
    calculateEMA(candles, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);
        
        // Start with SMA
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += candles[i].close;
        }
        ema[period - 1] = sum / period;

        for (let i = period; i < candles.length; i++) {
            ema[i] = (candles[i].close - ema[i - 1]) * multiplier + ema[i - 1];
        }

        return ema;
    }

    calculateSlope(values, period) {
        const slopes = [];
        
        for (let i = period; i < values.length; i++) {
            const currentValue = values[i];
            const pastValue = values[i - period];
            
            if (currentValue && pastValue) {
                slopes[i] = (currentValue - pastValue) / pastValue; // Percentage change
            }
        }
        
        return slopes;
    }

    calculateMACD(candles, fastPeriod, slowPeriod, signalPeriod) {
        const emaFast = this.calculateEMA(candles, fastPeriod);
        const emaSlow = this.calculateEMA(candles, slowPeriod);
        
        const macdLine = [];
        for (let i = 0; i < candles.length; i++) {
            if (emaFast[i] && emaSlow[i]) {
                macdLine[i] = emaFast[i] - emaSlow[i];
            }
        }
        
        // Signal line is EMA of MACD line
        const signalLine = [];
        const multiplier = 2 / (signalPeriod + 1);
        
        // Find first valid MACD value for signal line initialization
        let firstValidIndex = -1;
        for (let i = 0; i < macdLine.length; i++) {
            if (macdLine[i] !== undefined) {
                firstValidIndex = i;
                break;
            }
        }
        
        if (firstValidIndex >= 0) {
            signalLine[firstValidIndex] = macdLine[firstValidIndex];
            
            for (let i = firstValidIndex + 1; i < macdLine.length; i++) {
                if (macdLine[i] !== undefined) {
                    signalLine[i] = (macdLine[i] - signalLine[i - 1]) * multiplier + signalLine[i - 1];
                }
            }
        }
        
        const histogram = [];
        for (let i = 0; i < candles.length; i++) {
            if (macdLine[i] !== undefined && signalLine[i] !== undefined) {
                histogram[i] = macdLine[i] - signalLine[i];
            }
        }
        
        return { macdLine, signalLine, histogram };
    }

    calculateRSI(candles, period) {
        const rsi = [];
        const gains = [];
        const losses = [];

        for (let i = 1; i < candles.length; i++) {
            const change = candles[i].close - candles[i - 1].close;
            gains[i] = change > 0 ? change : 0;
            losses[i] = change < 0 ? -change : 0;
        }

        let avgGain = 0;
        let avgLoss = 0;

        for (let i = 1; i <= period; i++) {
            avgGain += gains[i] || 0;
            avgLoss += losses[i] || 0;
        }
        avgGain /= period;
        avgLoss /= period;

        if (avgLoss === 0) {
            rsi[period] = 100;
        } else {
            const rs = avgGain / avgLoss;
            rsi[period] = 100 - (100 / (1 + rs));
        }

        for (let i = period + 1; i < candles.length; i++) {
            avgGain = ((avgGain * (period - 1)) + (gains[i] || 0)) / period;
            avgLoss = ((avgLoss * (period - 1)) + (losses[i] || 0)) / period;

            if (avgLoss === 0) {
                rsi[i] = 100;
            } else {
                const rs = avgGain / avgLoss;
                rsi[i] = 100 - (100 / (1 + rs));
            }
        }

        return rsi;
    }

    calculateATR(candles, period) {
        const tr = [];
        const atr = [];

        for (let i = 1; i < candles.length; i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevClose = candles[i - 1].close;

            tr[i] = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
        }

        let sum = 0;
        for (let i = 1; i <= period; i++) {
            sum += tr[i];
        }
        atr[period] = sum / period;

        for (let i = period + 1; i < candles.length; i++) {
            atr[i] = ((atr[i - 1] * (period - 1)) + tr[i]) / period;
        }

        return atr;
    }

    findSwingHighs(candles, lookback) {
        const swingHighs = [];
        
        for (let i = lookback; i < candles.length; i++) {
            let swingHigh = null;
            
            // Look back for the highest high
            for (let j = i - lookback; j < i; j++) {
                if (!swingHigh || candles[j].high > swingHigh) {
                    swingHigh = candles[j].high;
                }
            }
            
            swingHighs[i] = swingHigh;
        }
        
        return swingHighs;
    }

    findSwingLows(candles, lookback) {
        const swingLows = [];
        
        for (let i = lookback; i < candles.length; i++) {
            let swingLow = null;
            
            // Look back for the lowest low
            for (let j = i - lookback; j < i; j++) {
                if (!swingLow || candles[j].low < swingLow) {
                    swingLow = candles[j].low;
                }
            }
            
            swingLows[i] = swingLow;
        }
        
        return swingLows;
    }
}

export default MultiTimeframeMomentumStrategy;