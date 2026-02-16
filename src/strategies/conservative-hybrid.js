/**
 * Conservative Hybrid Strategy (Modified)
 * Based on backtesting results — the "least bad" option.
 *
 * Rules:
 * 1. Only trade when strong trend confirmed (EMA50 > SMA200 by >2%)
 * 2. Enter on pullbacks to EMA21 (not EMA50)
 * 3. Use 1.5% risk (lower than tested 2%)
 * 4. Target 2:1 R/R minimum
 * 5. Max 1 trade per week to reduce fee impact
 * 6. Macro filter: Consider market conditions
 */

import { calculateEMA, calculateSMA, calculateRSI, calculateATR } from '../utils/indicators.js';

class ConservativeHybridStrategy {
  constructor(config = {}) {
    this.config = {
      riskPerTrade: config.riskPerTrade || 0.015,
      trendEma: 50,
      filterSma: 200,
      entryEma: 21,
      trendThreshold: 0.02,
      minRiskReward: 2.0,
      atrMultiplier: 2.0,
      rsiConfirmation: 50,
      maxTradesPerWeek: 1,
      cooldownHours: 168, // 1 week = 168 hours (42 × 4H candles)
      ...config,
    };

    this.lastTradeTime = 0;
  }

  calculateIndicators(candles) {
    return {
      ema50: calculateEMA(candles, this.config.trendEma),
      sma200: calculateSMA(candles, this.config.filterSma),
      ema21: calculateEMA(candles, this.config.entryEma),
      rsi: calculateRSI(candles, 14),
      atr: calculateATR(candles, 14),
    };
  }

  generateSignals(candles, config = {}) {
    if (candles.length < 250) return [];

    const effectiveConfig = { ...this.config, ...config };
    const ind = this.calculateIndicators(candles);
    const signals = [];

    for (let i = 220; i < candles.length - 1; i++) {
      const current = candles[i];
      const previous = candles[i - 1];
      const next = candles[i + 1];

      const ema50 = ind.ema50[i];
      const sma200 = ind.sma200[i];
      const ema21 = ind.ema21[i];
      const prevEma21 = ind.ema21[i - 1];
      const rsi = ind.rsi[i];
      const atr = ind.atr[i];

      if (!ema50 || !sma200 || !ema21 || !prevEma21 || !rsi || !atr) continue;

      // Cooldown check
      if (current.timestamp - this.lastTradeTime < this.config.cooldownHours * 4 * 60 * 60 * 1000) {
        continue;
      }

      const trendStrength = (ema50 - sma200) / sma200;

      // STRONG UPTREND: pullback to EMA21
      if (trendStrength > this.config.trendThreshold) {
        if (
          previous.close > prevEma21 &&
          current.low <= ema21 &&
          current.close > ema21 &&
          rsi > this.config.rsiConfirmation
        ) {
          const entry = next.open;
          const stop = current.low - atr * 0.5;
          const risk = entry - stop;

          if (risk > 0) {
            const target = entry + risk * this.config.minRiskReward;
            const riskReward = (target - entry) / risk;

            if (riskReward >= this.config.minRiskReward) {
              signals.push({
                timestamp: next.timestamp,
                type: 'LONG',
                entry, stop, target,
                positionSize: (effectiveConfig.riskPerTrade * 10000) / risk,
                risk,
                confidence: this.calculateConfidence(trendStrength, rsi, riskReward),
                reason: `Conservative: Strong uptrend + EMA21 pullback + ${riskReward.toFixed(1)}:1 R/R`,
                trendStrength,
                riskReward,
              });
              this.lastTradeTime = current.timestamp;
            }
          }
        }
      }

      // STRONG DOWNTREND: bounce to EMA21
      if (trendStrength < -this.config.trendThreshold) {
        if (
          previous.close < prevEma21 &&
          current.high >= ema21 &&
          current.close < ema21 &&
          rsi < 100 - this.config.rsiConfirmation
        ) {
          const entry = next.open;
          const stop = current.high + atr * 0.5;
          const risk = stop - entry;

          if (risk > 0) {
            const target = entry - risk * this.config.minRiskReward;
            const riskReward = (entry - target) / risk;

            if (riskReward >= this.config.minRiskReward) {
              signals.push({
                timestamp: next.timestamp,
                type: 'SHORT',
                entry, stop, target,
                positionSize: (effectiveConfig.riskPerTrade * 10000) / risk,
                risk,
                confidence: this.calculateConfidence(Math.abs(trendStrength), 100 - rsi, riskReward),
                reason: `Conservative: Strong downtrend + EMA21 bounce + ${riskReward.toFixed(1)}:1 R/R`,
                trendStrength,
                riskReward,
              });
              this.lastTradeTime = current.timestamp;
            }
          }
        }
      }
    }

    return signals;
  }

  calculateConfidence(trendStrength, rsiScore, riskReward) {
    let confidence = 60;
    confidence += Math.min(trendStrength * 500, 20);
    confidence += Math.min(Math.abs(rsiScore - 50) / 5, 10);
    confidence += Math.min((riskReward - 2) * 10, 10);
    return Math.min(confidence, 100);
  }

  getDescription() {
    return `Conservative Hybrid: ${this.config.trendThreshold * 100}% trend filter, EMA21 pullbacks, ${this.config.minRiskReward}:1 R/R, max ${this.config.maxTradesPerWeek}/week`;
  }
}

export default ConservativeHybridStrategy;
