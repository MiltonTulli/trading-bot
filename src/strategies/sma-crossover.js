/**
 * Approach 6: Simple Moving Average Crossover (The Classic)
 *
 * EMA 9/21 crossover on 4H timeframe
 * Filter: Only trade in direction of daily SMA200
 * Stop: 2x ATR
 * Target: 3x ATR
 */

import { calculateEMA, calculateSMA, calculateATR } from '../utils/indicators.js';

class SMAXoverStrategy {
  constructor(config = {}) {
    this.config = {
      riskPerTrade: config.riskPerTrade || 0.01,
      fastEma: 9,
      slowEma: 21,
      filterSma: 200,
      atrPeriod: 14,
      atrStopMultiplier: 2.0,
      atrTargetMultiplier: 3.0,
      ...config,
    };
  }

  calculateIndicators(candles) {
    return {
      emaFast: calculateEMA(candles, this.config.fastEma),
      emaSlow: calculateEMA(candles, this.config.slowEma),
      smaFilter: calculateSMA(candles, this.config.filterSma),
      atr: calculateATR(candles, this.config.atrPeriod),
    };
  }

  generateSignals(candles, config = {}) {
    if (candles.length < this.config.filterSma + 20) return [];

    const effectiveConfig = { ...this.config, ...config };
    const ind = this.calculateIndicators(candles);
    const signals = [];

    for (let i = this.config.filterSma + 10; i < candles.length - 1; i++) {
      const current = candles[i];
      const next = candles[i + 1];

      const fast = ind.emaFast[i];
      const slow = ind.emaSlow[i];
      const prevFast = ind.emaFast[i - 1];
      const prevSlow = ind.emaSlow[i - 1];
      const filter = ind.smaFilter[i];
      const atr = ind.atr[i];

      if (!fast || !slow || !prevFast || !prevSlow || !filter || !atr) continue;

      // Golden cross + above SMA200
      if (prevFast <= prevSlow && fast > slow && current.close > filter) {
        const entry = next.open;
        const stop = entry - atr * this.config.atrStopMultiplier;
        const target = entry + atr * this.config.atrTargetMultiplier;
        const risk = entry - stop;

        if (risk > 0) {
          signals.push({
            timestamp: next.timestamp,
            type: 'LONG',
            entry, stop, target,
            positionSize: (effectiveConfig.riskPerTrade * 10000) / risk,
            risk,
            confidence: this.calculateConfidence(ind, i, 'LONG'),
            reason: `EMA ${this.config.fastEma}/${this.config.slowEma} golden cross, uptrend confirmed`,
            riskReward: (target - entry) / risk,
          });
        }
      }

      // Death cross + below SMA200
      if (prevFast >= prevSlow && fast < slow && current.close < filter) {
        const entry = next.open;
        const stop = entry + atr * this.config.atrStopMultiplier;
        const target = entry - atr * this.config.atrTargetMultiplier;
        const risk = stop - entry;

        if (risk > 0) {
          signals.push({
            timestamp: next.timestamp,
            type: 'SHORT',
            entry, stop, target,
            positionSize: (effectiveConfig.riskPerTrade * 10000) / risk,
            risk,
            confidence: this.calculateConfidence(ind, i, 'SHORT'),
            reason: `EMA ${this.config.fastEma}/${this.config.slowEma} death cross, downtrend confirmed`,
            riskReward: (entry - target) / risk,
          });
        }
      }
    }

    return signals;
  }

  calculateConfidence(ind, index, type) {
    const fast = ind.emaFast[index];
    const slow = ind.emaSlow[index];
    const filter = ind.smaFilter[index];
    const price = fast; // proxy

    let confidence = 60;
    const filterDist = Math.abs((price - filter) / filter) * 100;
    confidence += Math.min(filterDist * 2, 20);

    const emaSep = Math.abs((fast - slow) / slow) * 100;
    confidence += Math.min(emaSep * 5, 15);

    if ((type === 'LONG' && fast > slow && price > filter) ||
        (type === 'SHORT' && fast < slow && price < filter)) {
      confidence += 5;
    }

    return Math.min(confidence, 100);
  }

  getStrategyMetrics(signals) {
    if (signals.length === 0) return {};
    let totalRR = 0;
    const crossovers = { golden: 0, death: 0 };
    for (const s of signals) {
      if (s.riskReward) totalRR += s.riskReward;
      if (s.type === 'LONG') crossovers.golden++;
      else crossovers.death++;
    }
    return { avgRiskReward: totalRR / signals.length, crossovers };
  }
}

export default SMAXoverStrategy;
