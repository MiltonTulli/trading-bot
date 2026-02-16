/**
 * Approach 5: Hybrid Adaptive Strategy
 *
 * Use ADX to detect market regime:
 * - Trending (ADX > 20): Use trend following (Approach 1)
 * - Ranging (ADX < 20): Use mean reversion (Approach 2)
 * Automatically switch between strategies.
 */

import { calculateADX, calculateSMAFromValues } from '../utils/indicators.js';
import TrendFollowingStrategy from './trend-following.js';
import MeanReversionStrategy from './mean-reversion.js';

class HybridAdaptiveStrategy {
  constructor(config = {}) {
    this.config = {
      riskPerTrade: config.riskPerTrade || 0.01,
      adxPeriod: 14,
      adxTrendingThreshold: 20,
      adxRangingThreshold: 20,
      adxLookback: 5,
      ...config,
    };

    this.trendStrategy = new TrendFollowingStrategy(this.config);
    this.meanReversionStrategy = new MeanReversionStrategy(this.config);
  }

  calculateIndicators(candles) {
    const adx = calculateADX(candles, this.config.adxPeriod);
    const adxSmoothed = calculateSMAFromValues(adx, this.config.adxLookback);

    return {
      adx,
      adxSmoothed,
      marketRegime: this.classifyMarketRegime(adxSmoothed),
    };
  }

  generateSignals(candles, config = {}) {
    if (candles.length < 100) return [];

    const effectiveConfig = { ...this.config, ...config };
    const indicators = this.calculateIndicators(candles);

    const trendSignals = this.trendStrategy.generateSignals(candles, effectiveConfig);
    const meanRevSignals = this.meanReversionStrategy.generateSignals(candles, effectiveConfig);

    // Map candle timestamps → regime
    const regimeLookup = {};
    for (let i = 0; i < candles.length; i++) {
      if (indicators.marketRegime[i]) {
        regimeLookup[candles[i].timestamp] = indicators.marketRegime[i];
      }
    }

    const signals = [];

    for (const signal of trendSignals) {
      if (regimeLookup[signal.timestamp] === 'TRENDING') {
        signals.push({
          ...signal,
          confidence: Math.min(signal.confidence + 10, 100),
          reason: `${signal.reason} (Trending market detected)`,
          strategy: 'TREND_FOLLOWING',
          regime: 'TRENDING',
        });
      }
    }

    for (const signal of meanRevSignals) {
      if (regimeLookup[signal.timestamp] === 'RANGING') {
        signals.push({
          ...signal,
          confidence: Math.min(signal.confidence + 10, 100),
          reason: `${signal.reason} (Ranging market detected)`,
          strategy: 'MEAN_REVERSION',
          regime: 'RANGING',
        });
      }
    }

    return signals.sort((a, b) => a.timestamp - b.timestamp);
  }

  classifyMarketRegime(adxSmoothed) {
    return adxSmoothed.map(adx =>
      adx === undefined ? null : adx > this.config.adxTrendingThreshold ? 'TRENDING' : 'RANGING',
    );
  }

  /** Get strategy statistics for analysis. */
  getStrategyStats(signals) {
    const stats = { total: signals.length, trendFollowing: 0, meanReversion: 0, trending: 0, ranging: 0 };
    for (const s of signals) {
      if (s.strategy === 'TREND_FOLLOWING') stats.trendFollowing++;
      else if (s.strategy === 'MEAN_REVERSION') stats.meanReversion++;
      if (s.regime === 'TRENDING') stats.trending++;
      else if (s.regime === 'RANGING') stats.ranging++;
    }
    return stats;
  }
}

export default HybridAdaptiveStrategy;
