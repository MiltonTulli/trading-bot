/**
 * Approach 3: Breakout Strategy
 * 
 * Detect consolidation: Low ATR period (ATR below 20-period average)
 * Entry: Price breaks above/below the consolidation range with volume spike (>1.5x)
 * Stop: Other side of consolidation range
 * Target: Width of consolidation range projected
 */

class BreakoutStrategy {
    constructor(config = {}) {
        this.config = {
            riskPerTrade: config.riskPerTrade || 0.01,
            consolidationPeriod: 20, // Look for consolidation over this period
            atrPeriod: 14,
            volumeMultiplier: 1.5, // Volume must be 1.5x average
            volumePeriod: 20,
            minConsolidationBars: 10, // Minimum bars for valid consolidation
            atrThreshold: 0.8, // ATR must be below 80% of its average to detect consolidation
            ...config
        };
    }

    /**
     * Calculate indicators for breakout strategy
     */
    calculateIndicators(candles) {
        const indicators = {};
        
        // ATR for volatility measurement
        indicators.atr = this.calculateATR(candles, this.config.atrPeriod);
        
        // ATR average for comparison
        const atrValues = [];
        for (let i = 0; i < candles.length; i++) {
            if (indicators.atr[i] !== undefined) {
                atrValues[i] = indicators.atr[i];
            }
        }
        indicators.atrAverage = this.calculateSMA(atrValues, this.config.consolidationPeriod);
        
        // Volume average
        indicators.volumeAverage = this.calculateVolumeAverage(candles, this.config.volumePeriod);
        
        // Consolidation ranges
        indicators.consolidationRanges = this.detectConsolidationRanges(candles, indicators.atr, indicators.atrAverage);
        
        return indicators;
    }

    /**
     * Generate signals based on breakout logic
     */
    generateSignals(candles, config = {}) {
        if (candles.length < 50) {
            return []; // Need enough data for indicators
        }

        const effectiveConfig = { ...this.config, ...config };
        const indicators = this.calculateIndicators(candles);
        const signals = [];

        for (let i = this.config.consolidationPeriod + 20; i < candles.length - 1; i++) {
            const current = candles[i];
            const next = candles[i + 1];
            
            const currentRange = indicators.consolidationRanges[i];
            const volumeAvg = indicators.volumeAverage[i];

            if (!currentRange || !volumeAvg) {
                continue;
            }

            // Check for volume spike
            const volumeSpike = current.volume > (volumeAvg * this.config.volumeMultiplier);
            
            if (!volumeSpike) {
                continue;
            }

            // LONG BREAKOUT (above resistance)
            if (current.close > currentRange.resistance && 
                current.high > currentRange.resistance) {
                
                const entry = next.open;
                const stop = currentRange.support; // Stop at other side of range
                const rangeWidth = currentRange.resistance - currentRange.support;
                const target = entry + rangeWidth; // Project range width
                const risk = entry - stop;
                
                if (risk > 0 && rangeWidth > 0) {
                    const positionSize = (effectiveConfig.riskPerTrade * 10000) / risk;
                    const riskReward = (target - entry) / risk;

                    // Only take trade if R:R is decent (at least 1:1)
                    if (riskReward >= 1.0) {
                        signals.push({
                            timestamp: next.timestamp,
                            type: 'LONG',
                            entry: entry,
                            stop: stop,
                            target: target,
                            positionSize: positionSize,
                            risk: risk,
                            confidence: this.calculateConfidence(currentRange, volumeSpike, riskReward),
                            reason: `Breakout above resistance: ${currentRange.resistance.toFixed(2)}, range width: ${rangeWidth.toFixed(2)}`
                        });
                    }
                }
            }

            // SHORT BREAKOUT (below support)
            if (current.close < currentRange.support && 
                current.low < currentRange.support) {
                
                const entry = next.open;
                const stop = currentRange.resistance; // Stop at other side of range
                const rangeWidth = currentRange.resistance - currentRange.support;
                const target = entry - rangeWidth; // Project range width down
                const risk = stop - entry;
                
                if (risk > 0 && rangeWidth > 0) {
                    const positionSize = (effectiveConfig.riskPerTrade * 10000) / risk;
                    const riskReward = (entry - target) / risk;

                    // Only take trade if R:R is decent (at least 1:1)
                    if (riskReward >= 1.0) {
                        signals.push({
                            timestamp: next.timestamp,
                            type: 'SHORT',
                            entry: entry,
                            stop: stop,
                            target: target,
                            positionSize: positionSize,
                            risk: risk,
                            confidence: this.calculateConfidence(currentRange, volumeSpike, riskReward),
                            reason: `Breakdown below support: ${currentRange.support.toFixed(2)}, range width: ${rangeWidth.toFixed(2)}`
                        });
                    }
                }
            }
        }

        return signals;
    }

    detectConsolidationRanges(candles, atr, atrAverage) {
        const ranges = [];
        
        for (let i = this.config.consolidationPeriod; i < candles.length; i++) {
            const currentAtr = atr[i];
            const avgAtr = atrAverage[i - this.config.consolidationPeriod];
            
            if (!currentAtr || !avgAtr) {
                ranges[i] = null;
                continue;
            }
            
            // Check if we're in low volatility period
            if (currentAtr < (avgAtr * this.config.atrThreshold)) {
                // Look back to find the consolidation range
                const lookbackStart = Math.max(0, i - this.config.consolidationPeriod);
                let high = -Infinity;
                let low = Infinity;
                
                for (let j = lookbackStart; j <= i; j++) {
                    high = Math.max(high, candles[j].high);
                    low = Math.min(low, candles[j].low);
                }
                
                // Ensure the range is significant
                const rangeWidth = high - low;
                if (rangeWidth > currentAtr * 2) { // Range should be at least 2x ATR
                    ranges[i] = {
                        support: low,
                        resistance: high,
                        width: rangeWidth,
                        consolidationBars: this.config.consolidationPeriod
                    };
                } else {
                    ranges[i] = null;
                }
            } else {
                ranges[i] = null;
            }
        }
        
        return ranges;
    }

    calculateConfidence(range, volumeSpike, riskReward) {
        let confidence = 50;
        
        // Larger range width = more significant breakout
        if (range.width > 0) {
            confidence += Math.min(range.width * 0.1, 20);
        }
        
        // Better risk/reward = higher confidence
        confidence += Math.min((riskReward - 1) * 15, 20);
        
        // Volume spike adds confidence
        if (volumeSpike) {
            confidence += 10;
        }
        
        return Math.min(confidence, 100);
    }

    // Technical indicator calculations
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

    calculateSMA(values, period) {
        const sma = [];
        for (let i = period - 1; i < values.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += values[i - j] || 0;
            }
            sma[i] = sum / period;
        }
        return sma;
    }

    calculateVolumeAverage(candles, period) {
        const volumeAvg = [];
        for (let i = period - 1; i < candles.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += candles[i - j].volume || 0;
            }
            volumeAvg[i] = sum / period;
        }
        return volumeAvg;
    }
}

export default BreakoutStrategy;