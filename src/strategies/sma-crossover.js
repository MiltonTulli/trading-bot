/**
 * Approach 6: Simple Moving Average Crossover (The Classic)
 * 
 * If nothing else works, test the simplest thing that's historically profitable:
 * - EMA 9/21 crossover on 4H timeframe
 * - Filter: Only trade in direction of daily SMA200
 * - Stop: 2x ATR
 * - Target: 3x ATR
 * This is boring but many funds run variations of this
 */

class SMAXoverStrategy {
    constructor(config = {}) {
        this.config = {
            riskPerTrade: config.riskPerTrade || 0.01,
            fastEma: 9,
            slowEma: 21,
            filterSma: 200, // Daily filter (SMA200)
            atrPeriod: 14,
            atrStopMultiplier: 2.0,
            atrTargetMultiplier: 3.0,
            ...config
        };
    }

    /**
     * Calculate indicators for SMA crossover strategy
     */
    calculateIndicators(candles) {
        const indicators = {};
        
        // Fast and slow EMAs for crossover
        indicators.emaFast = this.calculateEMA(candles, this.config.fastEma);
        indicators.emaSlow = this.calculateEMA(candles, this.config.slowEma);
        
        // Long-term SMA for trend filter
        indicators.smaFilter = this.calculateSMA(candles, this.config.filterSma);
        
        // ATR for stops and targets
        indicators.atr = this.calculateATR(candles, this.config.atrPeriod);
        
        return indicators;
    }

    /**
     * Generate signals based on EMA crossover logic
     */
    generateSignals(candles, config = {}) {
        if (candles.length < this.config.filterSma + 20) {
            return []; // Need enough data for SMA200 filter
        }

        const effectiveConfig = { ...this.config, ...config };
        const indicators = this.calculateIndicators(candles);
        const signals = [];

        for (let i = this.config.filterSma + 10; i < candles.length - 1; i++) {
            const current = candles[i];
            const next = candles[i + 1];

            const fastEma = indicators.emaFast[i];
            const slowEma = indicators.emaSlow[i];
            const prevFastEma = indicators.emaFast[i - 1];
            const prevSlowEma = indicators.emaSlow[i - 1];
            const smaFilter = indicators.smaFilter[i];
            const atr = indicators.atr[i];

            if (!fastEma || !slowEma || !prevFastEma || !prevSlowEma || !smaFilter || !atr) {
                continue;
            }

            // BULLISH CROSSOVER (Golden Cross)
            // Fast EMA crosses above slow EMA + price above SMA200 filter
            if (prevFastEma <= prevSlowEma && 
                fastEma > slowEma && 
                current.close > smaFilter) {
                
                const entry = next.open;
                const stop = entry - (atr * this.config.atrStopMultiplier);
                const target = entry + (atr * this.config.atrTargetMultiplier);
                const risk = entry - stop;
                
                if (risk > 0) {
                    const positionSize = (effectiveConfig.riskPerTrade * 10000) / risk;
                    const riskReward = (target - entry) / risk;

                    signals.push({
                        timestamp: next.timestamp,
                        type: 'LONG',
                        entry: entry,
                        stop: stop,
                        target: target,
                        positionSize: positionSize,
                        risk: risk,
                        confidence: this.calculateConfidence(indicators, i, 'LONG'),
                        reason: `EMA ${this.config.fastEma}/${this.config.slowEma} golden cross, uptrend confirmed`,
                        riskReward: riskReward
                    });
                }
            }

            // BEARISH CROSSOVER (Death Cross)
            // Fast EMA crosses below slow EMA + price below SMA200 filter
            if (prevFastEma >= prevSlowEma && 
                fastEma < slowEma && 
                current.close < smaFilter) {
                
                const entry = next.open;
                const stop = entry + (atr * this.config.atrStopMultiplier);
                const target = entry - (atr * this.config.atrTargetMultiplier);
                const risk = stop - entry;
                
                if (risk > 0) {
                    const positionSize = (effectiveConfig.riskPerTrade * 10000) / risk;
                    const riskReward = (entry - target) / risk;

                    signals.push({
                        timestamp: next.timestamp,
                        type: 'SHORT',
                        entry: entry,
                        stop: stop,
                        target: target,
                        positionSize: positionSize,
                        risk: risk,
                        confidence: this.calculateConfidence(indicators, i, 'SHORT'),
                        reason: `EMA ${this.config.fastEma}/${this.config.slowEma} death cross, downtrend confirmed`,
                        riskReward: riskReward
                    });
                }
            }
        }

        return signals;
    }

    calculateConfidence(indicators, index, type) {
        const fastEma = indicators.emaFast[index];
        const slowEma = indicators.emaSlow[index];
        const smaFilter = indicators.smaFilter[index];
        const currentPrice = fastEma; // Use fast EMA as proxy for current price

        let confidence = 60; // Base confidence for this classic strategy

        // Distance from filter SMA adds confidence
        const filterDistance = Math.abs((currentPrice - smaFilter) / smaFilter) * 100;
        confidence += Math.min(filterDistance * 2, 20);

        // EMA separation adds confidence (stronger crossover)
        const emaSeparation = Math.abs((fastEma - slowEma) / slowEma) * 100;
        confidence += Math.min(emaSeparation * 5, 15);

        // Trend alignment bonus
        if ((type === 'LONG' && fastEma > slowEma && currentPrice > smaFilter) ||
            (type === 'SHORT' && fastEma < slowEma && currentPrice < smaFilter)) {
            confidence += 5;
        }

        return Math.min(confidence, 100);
    }

    // Technical indicator calculations
    calculateEMA(candles, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);
        
        // Start with SMA for first value
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += candles[i].close;
        }
        ema[period - 1] = sum / period;

        // Calculate EMA for remaining values
        for (let i = period; i < candles.length; i++) {
            ema[i] = (candles[i].close - ema[i - 1]) * multiplier + ema[i - 1];
        }

        return ema;
    }

    calculateSMA(candles, period) {
        const sma = [];
        for (let i = period - 1; i < candles.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += candles[i - j].close;
            }
            sma[i] = sum / period;
        }
        return sma;
    }

    calculateATR(candles, period) {
        const tr = [];
        const atr = [];

        // Calculate True Range
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

        // Calculate initial ATR (SMA of TR)
        let sum = 0;
        for (let i = 1; i <= period; i++) {
            sum += tr[i];
        }
        atr[period] = sum / period;

        // Calculate subsequent ATR values (smoothed)
        for (let i = period + 1; i < candles.length; i++) {
            atr[i] = ((atr[i - 1] * (period - 1)) + tr[i]) / period;
        }

        return atr;
    }

    /**
     * Get additional strategy metrics
     */
    getStrategyMetrics(signals, candles) {
        if (signals.length === 0) return {};

        const metrics = {
            avgRiskReward: 0,
            crossovers: {
                golden: 0,
                death: 0
            },
            avgHoldingPeriod: 0,
            trendAlignment: 0
        };

        let totalRR = 0;
        let trendAligned = 0;

        for (const signal of signals) {
            if (signal.riskReward) {
                totalRR += signal.riskReward;
            }

            if (signal.type === 'LONG') {
                metrics.crossovers.golden++;
            } else {
                metrics.crossovers.death++;
            }

            // Check if signal was trend-aligned
            const candleIndex = candles.findIndex(c => c.timestamp === signal.timestamp);
            if (candleIndex >= 0) {
                const indicators = this.calculateIndicators(candles);
                const smaFilter = indicators.smaFilter[candleIndex];
                const price = candles[candleIndex].open;
                
                if ((signal.type === 'LONG' && price > smaFilter) ||
                    (signal.type === 'SHORT' && price < smaFilter)) {
                    trendAligned++;
                }
            }
        }

        metrics.avgRiskReward = totalRR / signals.length;
        metrics.trendAlignment = trendAligned / signals.length;

        return metrics;
    }
}

export default SMAXoverStrategy;