/**
 * Approach 5: Hybrid Adaptive Strategy
 * 
 * Use ADX to detect market regime:
 * - Trending (ADX > 20): Use trend following (Approach 1 or 4)
 * - Ranging (ADX < 20): Use mean reversion (Approach 2)
 * Automatically switch between strategies
 */

import TrendFollowingStrategy from './trend-following.js';
import MeanReversionStrategy from './mean-reversion.js';

class HybridAdaptiveStrategy {
    constructor(config = {}) {
        this.config = {
            riskPerTrade: config.riskPerTrade || 0.01,
            adxPeriod: 14,
            adxTrendingThreshold: 20, // ADX > 20 = trending market
            adxRangingThreshold: 20,  // ADX < 20 = ranging market
            adxLookback: 5, // Average ADX over this many periods for stability
            ...config
        };

        // Initialize sub-strategies
        this.trendStrategy = new TrendFollowingStrategy(this.config);
        this.meanReversionStrategy = new MeanReversionStrategy(this.config);
    }

    /**
     * Calculate indicators for adaptive strategy
     */
    calculateIndicators(candles) {
        const indicators = {};
        
        // ADX for market regime detection
        indicators.adx = this.calculateADX(candles, this.config.adxPeriod);
        
        // Smoothed ADX for more stable regime detection
        const adxValues = [];
        for (let i = 0; i < candles.length; i++) {
            if (indicators.adx[i] !== undefined) {
                adxValues[i] = indicators.adx[i];
            }
        }
        indicators.adxSmoothed = this.calculateSMA(adxValues, this.config.adxLookback);
        
        // Market regime classification
        indicators.marketRegime = this.classifyMarketRegime(indicators.adxSmoothed);
        
        return indicators;
    }

    /**
     * Generate signals by switching between strategies based on market regime
     */
    generateSignals(candles, config = {}) {
        if (candles.length < 100) {
            return []; // Need enough data for all indicators
        }

        const effectiveConfig = { ...this.config, ...config };
        const indicators = this.calculateIndicators(candles);
        const signals = [];

        // Get signals from both strategies
        const trendSignals = this.trendStrategy.generateSignals(candles, effectiveConfig);
        const meanReversionSignals = this.meanReversionStrategy.generateSignals(candles, effectiveConfig);

        // Create a lookup for market regime by timestamp
        const regimeLookup = {};
        for (let i = 0; i < candles.length; i++) {
            if (indicators.marketRegime[i]) {
                regimeLookup[candles[i].timestamp] = indicators.marketRegime[i];
            }
        }

        // Filter and select signals based on market regime
        for (const signal of trendSignals) {
            const regime = regimeLookup[signal.timestamp];
            if (regime === 'TRENDING') {
                // Enhance signal with regime information
                signals.push({
                    ...signal,
                    confidence: Math.min(signal.confidence + 10, 100), // Boost confidence for appropriate regime
                    reason: `${signal.reason} (Trending market detected)`,
                    strategy: 'TREND_FOLLOWING',
                    regime: regime
                });
            }
        }

        for (const signal of meanReversionSignals) {
            const regime = regimeLookup[signal.timestamp];
            if (regime === 'RANGING') {
                // Enhance signal with regime information
                signals.push({
                    ...signal,
                    confidence: Math.min(signal.confidence + 10, 100), // Boost confidence for appropriate regime
                    reason: `${signal.reason} (Ranging market detected)`,
                    strategy: 'MEAN_REVERSION',
                    regime: regime
                });
            }
        }

        // Sort signals by timestamp
        signals.sort((a, b) => a.timestamp - b.timestamp);

        return signals;
    }

    classifyMarketRegime(adxSmoothed) {
        const regime = [];
        
        for (let i = 0; i < adxSmoothed.length; i++) {
            const adx = adxSmoothed[i];
            if (adx === undefined) {
                regime[i] = null;
                continue;
            }
            
            if (adx > this.config.adxTrendingThreshold) {
                regime[i] = 'TRENDING';
            } else {
                regime[i] = 'RANGING';
            }
        }
        
        return regime;
    }

    // Technical indicator calculations
    calculateADX(candles, period) {
        const adx = [];
        const plusDI = [];
        const minusDI = [];
        const dx = [];

        // Calculate +DI, -DI, and DX
        for (let i = 1; i < candles.length; i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevHigh = candles[i - 1].high;
            const prevLow = candles[i - 1].low;
            const prevClose = candles[i - 1].close;

            const plusDM = (high - prevHigh) > (prevLow - low) ? Math.max(high - prevHigh, 0) : 0;
            const minusDM = (prevLow - low) > (high - prevHigh) ? Math.max(prevLow - low, 0) : 0;
            
            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );

            if (i >= period) {
                let plusDMSum = 0;
                let minusDMSum = 0;
                let trSum = 0;

                for (let j = 0; j < period; j++) {
                    const idx = i - j;
                    const h = candles[idx].high;
                    const l = candles[idx].low;
                    const ph = candles[idx - 1].high;
                    const pl = candles[idx - 1].low;
                    const pc = candles[idx - 1].close;

                    const pdm = (h - ph) > (pl - l) ? Math.max(h - ph, 0) : 0;
                    const mdm = (pl - l) > (h - ph) ? Math.max(pl - l, 0) : 0;
                    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));

                    plusDMSum += pdm;
                    minusDMSum += mdm;
                    trSum += tr;
                }

                plusDI[i] = (plusDMSum / trSum) * 100;
                minusDI[i] = (minusDMSum / trSum) * 100;

                const diSum = plusDI[i] + minusDI[i];
                if (diSum !== 0) {
                    dx[i] = Math.abs(plusDI[i] - minusDI[i]) / diSum * 100;
                } else {
                    dx[i] = 0;
                }
            }
        }

        // Calculate ADX (smoothed DX)
        if (dx.length >= period * 2) {
            let dxSum = 0;
            for (let i = period; i < period * 2; i++) {
                dxSum += dx[i] || 0;
            }
            adx[period * 2 - 1] = dxSum / period;

            for (let i = period * 2; i < candles.length; i++) {
                adx[i] = ((adx[i - 1] * (period - 1)) + (dx[i] || 0)) / period;
            }
        }

        return adx;
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

    /**
     * Get strategy statistics for analysis
     */
    getStrategyStats(signals) {
        const stats = {
            total: signals.length,
            trendFollowing: 0,
            meanReversion: 0,
            trending: 0,
            ranging: 0
        };

        for (const signal of signals) {
            if (signal.strategy === 'TREND_FOLLOWING') {
                stats.trendFollowing++;
            } else if (signal.strategy === 'MEAN_REVERSION') {
                stats.meanReversion++;
            }

            if (signal.regime === 'TRENDING') {
                stats.trending++;
            } else if (signal.regime === 'RANGING') {
                stats.ranging++;
            }
        }

        return stats;
    }
}

export default HybridAdaptiveStrategy;