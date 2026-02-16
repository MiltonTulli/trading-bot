/**
 * Approach 3: Breakout Strategy
 *
 * Detect consolidation: Low ATR period (ATR below 20-period average)
 * Entry: Price breaks above/below the consolidation range with volume spike (>1.5x)
 * Stop: Other side of consolidation range
 * Target: Width of consolidation range projected
 */

import { calculateATR, calculateSMAFromValues, calculateVolumeAverage } from '../utils/indicators.js';

class BreakoutStrategy {
  constructor(config = {}) {
    this.config = {
      riskPerTrade: config.riskPerTrade || 0.01,
      consolidationPeriod: 20,
      atrPeriod: 14,
      volumeMultiplier: 1.5,
      volumePeriod: 20,
      minConsolidationBars: 10,
      atrThreshold: 0.8,
      ...config,
    };
  }

  calculateIndicators(candles) {
    const atr = calculateATR(candles, this.config.atrPeriod);
    return {
      atr,
      atrAverage: calculateSMAFromValues(atr, this.config.consolidationPeriod),
      volumeAverage: calculateVolumeAverage(candles, this.config.volumePeriod),
      consolidationRanges: this.detectConsolidationRanges(candles, atr,
        calculateSMAFromValues(atr, this.config.consolidationPeriod)),
    };
  }

  generateSignals(candles, config = {}) {
    if (candles.length < 50) return [];

    const effectiveConfig = { ...this.config, ...config };
    const indicators = this.calculateIndicators(candles);
    const signals = [];

    for (let i = this.config.consolidationPeriod + 20; i < candles.length - 1; i++) {
      const current = candles[i];
      const next = candles[i + 1];
      const range = indicators.consolidationRanges[i];
      const volumeAvg = indicators.volumeAverage[i];

      if (!range || !volumeAvg) continue;
      if (current.volume <= volumeAvg * this.config.volumeMultiplier) continue;

      const rangeWidth = range.resistance - range.support;

      // LONG breakout
      if (current.close > range.resistance && current.high > range.resistance) {
        const entry = next.open;
        const stop = range.support;
        const target = entry + rangeWidth;
        const risk = entry - stop;

        if (risk > 0 && rangeWidth > 0) {
          const riskReward = (target - entry) / risk;
          if (riskReward >= 1.0) {
            signals.push({
              timestamp: next.timestamp,
              type: 'LONG',
              entry, stop, target,
              positionSize: (effectiveConfig.riskPerTrade * 10000) / risk,
              risk,
              confidence: this.calculateConfidence(range, true, riskReward),
              reason: `Breakout above resistance: ${range.resistance.toFixed(2)}, range width: ${rangeWidth.toFixed(2)}`,
            });
          }
        }
      }

      // SHORT breakout
      if (current.close < range.support && current.low < range.support) {
        const entry = next.open;
        const stop = range.resistance;
        const target = entry - rangeWidth;
        const risk = stop - entry;

        if (risk > 0 && rangeWidth > 0) {
          const riskReward = (entry - target) / risk;
          if (riskReward >= 1.0) {
            signals.push({
              timestamp: next.timestamp,
              type: 'SHORT',
              entry, stop, target,
              positionSize: (effectiveConfig.riskPerTrade * 10000) / risk,
              risk,
              confidence: this.calculateConfidence(range, true, riskReward),
              reason: `Breakdown below support: ${range.support.toFixed(2)}, range width: ${rangeWidth.toFixed(2)}`,
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

      if (!currentAtr || !avgAtr || currentAtr >= avgAtr * this.config.atrThreshold) {
        ranges[i] = null;
        continue;
      }

      const lookbackStart = Math.max(0, i - this.config.consolidationPeriod);
      let high = -Infinity;
      let low = Infinity;

      for (let j = lookbackStart; j <= i; j++) {
        high = Math.max(high, candles[j].high);
        low = Math.min(low, candles[j].low);
      }

      const width = high - low;
      ranges[i] = width > currentAtr * 2
        ? { support: low, resistance: high, width, consolidationBars: this.config.consolidationPeriod }
        : null;
    }

    return ranges;
  }

  calculateConfidence(range, volumeSpike, riskReward) {
    let confidence = 50;
    if (range.width > 0) confidence += Math.min(range.width * 0.1, 20);
    confidence += Math.min((riskReward - 1) * 15, 20);
    if (volumeSpike) confidence += 10;
    return Math.min(confidence, 100);
  }
}

export default BreakoutStrategy;
