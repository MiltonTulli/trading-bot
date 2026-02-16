/**
 * Approach 2: Mean Reversion with Bollinger Bands
 *
 * Entry long: Price touches lower BB (2 std) + RSI < 35 + previous candle red
 * Entry short: Price touches upper BB + RSI > 65 + previous candle green
 * Exit: Price returns to middle band (SMA20) or stop at 1.5x ATR
 * Works best in ranging markets — detect with ADX < 25
 */

import {
  calculateRSI,
  calculateATR,
  calculateADX,
  calculateBollingerBands,
} from '../utils/indicators.js';

class MeanReversionStrategy {
  constructor(config = {}) {
    this.config = {
      riskPerTrade: config.riskPerTrade || 0.01,
      atrMultiplier: 1.5,
      bbPeriod: 20,
      bbStdDev: 2,
      rsiPeriod: 14,
      rsiOversold: 35,
      rsiOverbought: 65,
      adxPeriod: 14,
      adxRanging: 25,
      ...config,
    };
  }

  calculateIndicators(candles) {
    const bb = calculateBollingerBands(candles, this.config.bbPeriod, this.config.bbStdDev);
    return {
      bbUpper: bb.upper,
      bbMiddle: bb.middle,
      bbLower: bb.lower,
      rsi: calculateRSI(candles, this.config.rsiPeriod),
      atr: calculateATR(candles, 14),
      adx: calculateADX(candles, this.config.adxPeriod),
    };
  }

  generateSignals(candles, config = {}) {
    if (candles.length < 50) return [];

    const effectiveConfig = { ...this.config, ...config };
    const indicators = this.calculateIndicators(candles);
    const signals = [];

    for (let i = 30; i < candles.length - 1; i++) {
      const current = candles[i];
      const previous = candles[i - 1];
      const next = candles[i + 1];

      const { bbUpper, bbMiddle, bbLower, rsi, atr, adx } = indicators;
      const curBBU = bbUpper[i];
      const curBBM = bbMiddle[i];
      const curBBL = bbLower[i];
      const curRsi = rsi[i];
      const curAtr = atr[i];
      const curAdx = adx[i];

      if (!curBBU || !curBBM || !curBBL || !curRsi || !curAtr || !curAdx) continue;

      // Only trade in ranging markets (ADX < 25)
      if (curAdx > this.config.adxRanging) continue;

      // LONG: lower BB touch + RSI oversold + previous red candle
      if (
        current.low <= curBBL &&
        curRsi < this.config.rsiOversold &&
        previous.close < previous.open
      ) {
        const entry = next.open;
        const stop = entry - curAtr * this.config.atrMultiplier;
        const risk = entry - stop;
        if (risk > 0) {
          signals.push({
            timestamp: next.timestamp,
            type: 'LONG',
            entry,
            stop,
            target: curBBM,
            positionSize: (effectiveConfig.riskPerTrade * 10000) / risk,
            risk,
            confidence: this.calculateConfidence(curRsi, curAdx, 'LONG'),
            reason: 'Mean reversion: Oversold at lower BB, ranging market',
          });
        }
      }

      // SHORT: upper BB touch + RSI overbought + previous green candle
      if (
        current.high >= curBBU &&
        curRsi > this.config.rsiOverbought &&
        previous.close > previous.open
      ) {
        const entry = next.open;
        const stop = entry + curAtr * this.config.atrMultiplier;
        const risk = stop - entry;
        if (risk > 0) {
          signals.push({
            timestamp: next.timestamp,
            type: 'SHORT',
            entry,
            stop,
            target: curBBM,
            positionSize: (effectiveConfig.riskPerTrade * 10000) / risk,
            risk,
            confidence: this.calculateConfidence(curRsi, curAdx, 'SHORT'),
            reason: 'Mean reversion: Overbought at upper BB, ranging market',
          });
        }
      }
    }

    return signals;
  }

  calculateConfidence(rsi, adx, type) {
    let confidence = 50;
    if (type === 'LONG') {
      confidence += Math.max(0, (35 - rsi) * 1.5);
    } else {
      confidence += Math.max(0, (rsi - 65) * 1.5);
    }
    confidence += Math.max(0, (25 - adx) * 1.2);
    return Math.min(confidence, 100);
  }
}

export default MeanReversionStrategy;
