/**
 * Approach 4: Multi-Timeframe Momentum
 *
 * Daily: Determine trend direction (EMA21 slope)
 * 4H: Wait for pullback to EMA21 or EMA50
 * 1H: Enter when momentum resumes (MACD crossover or RSI bounce from 40-50 zone)
 * Stop: Below the pullback low
 * Target: Previous swing high/low
 *
 * Note: Simulates multi-timeframe analysis on 4H data using longer periods.
 */

import {
  calculateEMA,
  calculateSlope,
  calculateMACD,
  calculateRSI,
  calculateATR,
  findSwingHighs,
  findSwingLows,
} from '../utils/indicators.js';

class MultiTimeframeMomentumStrategy {
  constructor(config = {}) {
    this.config = {
      riskPerTrade: config.riskPerTrade || 0.01,
      trendEma: 21,
      trendPeriod: 6,        // 6 × 4H ≈ daily
      pullbackEma21: 21,
      pullbackEma50: 50,
      macdFast: 3,
      macdSlow: 6,
      macdSignal: 2,
      rsiPeriod: 14,
      rsiUpTrendBounce: [40, 60],
      rsiDownTrendBounce: [40, 60],
      swingLookback: 20,
      atrMultiplier: 2,
      ...config,
    };
  }

  calculateIndicators(candles) {
    const trendEma = calculateEMA(candles, this.config.trendEma);
    const macd = calculateMACD(candles, this.config.macdFast, this.config.macdSlow, this.config.macdSignal);

    return {
      trendEma,
      trendSlope: calculateSlope(trendEma, this.config.trendPeriod),
      ema21: calculateEMA(candles, this.config.pullbackEma21),
      ema50: calculateEMA(candles, this.config.pullbackEma50),
      macdLine: macd.macdLine,
      macdSignal: macd.signalLine,
      macdHistogram: macd.histogram,
      rsi: calculateRSI(candles, this.config.rsiPeriod),
      atr: calculateATR(candles, 14),
      swingHighs: findSwingHighs(candles, this.config.swingLookback),
      swingLows: findSwingLows(candles, this.config.swingLookback),
    };
  }

  generateSignals(candles, config = {}) {
    if (candles.length < 100) return [];

    const effectiveConfig = { ...this.config, ...config };
    const ind = this.calculateIndicators(candles);
    const signals = [];

    for (let i = 60; i < candles.length - 1; i++) {
      const current = candles[i];
      const previous = candles[i - 1];
      const next = candles[i + 1];

      const slope = ind.trendSlope[i];
      const ema21 = ind.ema21[i];
      const ema50 = ind.ema50[i];
      const ml = ind.macdLine[i];
      const ms = ind.macdSignal[i];
      const prevMl = ind.macdLine[i - 1];
      const prevMs = ind.macdSignal[i - 1];
      const rsi = ind.rsi[i];
      const atr = ind.atr[i];

      if (!slope || !ema21 || !ema50 || !ml || !ms || !rsi || !atr) continue;

      // UPTREND
      if (slope > 0) {
        const pulledBack = (current.low <= ema21 && previous.low > ema21) ||
                           (current.low <= ema50 && previous.low > ema50);

        if (pulledBack) {
          const macdCrossover = prevMl <= prevMs && ml > ms;
          const rsiBounce = rsi >= this.config.rsiUpTrendBounce[0] && rsi <= this.config.rsiUpTrendBounce[1];

          if (macdCrossover || rsiBounce) {
            const entry = next.open;
            const stopLow = Math.min(current.low, previous.low);
            const stop = stopLow - atr * 0.5;
            const target = ind.swingHighs[i] || entry + (entry - stop) * 2;
            const risk = entry - stop;

            if (risk > 0) {
              signals.push({
                timestamp: next.timestamp,
                type: 'LONG',
                entry, stop, target,
                positionSize: (effectiveConfig.riskPerTrade * 10000) / risk,
                risk,
                confidence: this.calculateConfidence(slope, macdCrossover, rsiBounce),
                reason: 'Multi-TF momentum: Uptrend + pullback + momentum resumption',
              });
            }
          }
        }
      }

      // DOWNTREND
      if (slope < 0) {
        const bounced = (current.high >= ema21 && previous.high < ema21) ||
                        (current.high >= ema50 && previous.high < ema50);

        if (bounced) {
          const macdCrossunder = prevMl >= prevMs && ml < ms;
          const rsiReject = rsi >= this.config.rsiDownTrendBounce[0] && rsi <= this.config.rsiDownTrendBounce[1];

          if (macdCrossunder || rsiReject) {
            const entry = next.open;
            const stopHigh = Math.max(current.high, previous.high);
            const stop = stopHigh + atr * 0.5;
            const target = ind.swingLows[i] || entry - (stop - entry) * 2;
            const risk = stop - entry;

            if (risk > 0) {
              signals.push({
                timestamp: next.timestamp,
                type: 'SHORT',
                entry, stop, target,
                positionSize: (effectiveConfig.riskPerTrade * 10000) / risk,
                risk,
                confidence: this.calculateConfidence(slope, macdCrossunder, rsiReject),
                reason: 'Multi-TF momentum: Downtrend + pullback + momentum resumption',
              });
            }
          }
        }
      }
    }

    return signals;
  }

  calculateConfidence(trendSlope, macdSignal, rsiSignal) {
    let confidence = 50;
    confidence += Math.min(Math.abs(trendSlope) * 1000, 20);
    if (macdSignal) confidence += 15;
    if (rsiSignal) confidence += 15;
    if (macdSignal && rsiSignal) confidence += 10;
    return Math.min(confidence, 100);
  }
}

export default MultiTimeframeMomentumStrategy;
