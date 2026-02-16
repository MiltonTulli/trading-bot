/**
 * Approach 1: Trend Following Only (Simplified)
 *
 * Entry: Price crosses above EMA50 AND EMA50 > SMA200 (golden cross area), confirmed by RSI > 50
 * Exit: Price crosses below EMA50 OR trailing stop at 2x ATR
 * Only long in uptrends, only short (or stay flat) in downtrends
 */

import { calculateEMA, calculateSMA, calculateRSI, calculateATR } from '../utils/indicators.js';

class TrendFollowingStrategy {
  constructor(config = {}) {
    this.config = {
      riskPerTrade: config.riskPerTrade || 0.01,
      atrMultiplier: 2.0,
      rsiConfirmation: 50,
      ...config,
    };
  }

  /** @returns {{ ema50: number[], sma200: number[], rsi: number[], atr: number[] }} */
  calculateIndicators(candles) {
    return {
      ema50: calculateEMA(candles, 50),
      sma200: calculateSMA(candles, 200),
      rsi: calculateRSI(candles, 14),
      atr: calculateATR(candles, 14),
    };
  }

  /** Generate signals based on trend following logic. */
  generateSignals(candles, config = {}) {
    if (candles.length < 250) return [];

    const effectiveConfig = { ...this.config, ...config };
    const indicators = this.calculateIndicators(candles);
    const signals = [];

    for (let i = 200; i < candles.length - 1; i++) {
      const current = candles[i];
      const previous = candles[i - 1];
      const next = candles[i + 1];

      const curEma50 = indicators.ema50[i];
      const prevEma50 = indicators.ema50[i - 1];
      const curSma200 = indicators.sma200[i];
      const curRsi = indicators.rsi[i];
      const curAtr = indicators.atr[i];

      if (!curEma50 || !prevEma50 || !curSma200 || !curRsi || !curAtr) continue;

      // LONG: price crosses above EMA50, EMA50 > SMA200, RSI > 50
      if (
        previous.close <= prevEma50 &&
        current.close > curEma50 &&
        curEma50 > curSma200 &&
        curRsi > this.config.rsiConfirmation
      ) {
        const entry = next.open;
        const stop = entry - curAtr * this.config.atrMultiplier;
        const risk = entry - stop;
        signals.push({
          timestamp: next.timestamp,
          type: 'LONG',
          entry,
          stop,
          target: null,
          positionSize: (effectiveConfig.riskPerTrade * 10000) / risk,
          risk,
          confidence: this.calculateConfidence(indicators, i),
          reason: 'Trend following: Price crosses above EMA50, uptrend confirmed',
        });
      }

      // SHORT: price crosses below EMA50, EMA50 < SMA200, RSI < 50
      if (
        previous.close >= prevEma50 &&
        current.close < curEma50 &&
        curEma50 < curSma200 &&
        curRsi < 100 - this.config.rsiConfirmation
      ) {
        const entry = next.open;
        const stop = entry + curAtr * this.config.atrMultiplier;
        const risk = stop - entry;
        signals.push({
          timestamp: next.timestamp,
          type: 'SHORT',
          entry,
          stop,
          target: null,
          positionSize: (effectiveConfig.riskPerTrade * 10000) / risk,
          risk,
          confidence: this.calculateConfidence(indicators, i),
          reason: 'Trend following: Price crosses below EMA50, downtrend confirmed',
        });
      }
    }

    return signals;
  }

  calculateConfidence(indicators, index) {
    const ema50 = indicators.ema50[index];
    const sma200 = indicators.sma200[index];
    const rsi = indicators.rsi[index];

    let confidence = 50;
    const trendStrength = Math.abs((ema50 - sma200) / sma200) * 100;
    confidence += Math.min(trendStrength * 2, 30);

    if ((rsi > 50 && ema50 > sma200) || (rsi < 50 && ema50 < sma200)) {
      confidence += 10;
    }

    return Math.min(confidence, 100);
  }
}

export default TrendFollowingStrategy;
