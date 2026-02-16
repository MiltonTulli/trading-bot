/**
 * Shared Technical Indicator Calculations
 *
 * Pure-function implementations of common indicators used across strategies.
 * Each function operates on plain arrays (closes, highs, lows, volumes) and
 * returns sparse arrays indexed by candle position.
 *
 * @module utils/indicators
 */

import type {
  CandleWithClose,
  CandleWithHLC,
  CandleWithVolume,
  CandleWithHigh,
  CandleWithLow,
  BollingerBands,
  MACDResult,
} from '../types.ts';

/**
 * Exponential Moving Average (EMA).
 */
export function calculateEMA(candles: CandleWithClose[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  ema[period - 1] = sum / period;

  for (let i = period; i < candles.length; i++) {
    ema[i] = (candles[i].close - ema[i - 1]) * multiplier + ema[i - 1];
  }
  return ema;
}

/**
 * Simple Moving Average (SMA).
 */
export function calculateSMA(candles: CandleWithClose[], period: number): number[] {
  const sma: number[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += candles[i - j].close;
    }
    sma[i] = sum / period;
  }
  return sma;
}

/**
 * SMA over a plain numeric array (e.g. ATR values).
 */
export function calculateSMAFromValues(values: number[], period: number): number[] {
  const sma: number[] = [];
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
 * Relative Strength Index (RSI).
 */
export function calculateRSI(candles: CandleWithClose[], period: number = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    gains[i] = change > 0 ? change : 0;
    losses[i] = change < 0 ? -change : 0;
  }

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    avgGain += gains[i] || 0;
    avgLoss += losses[i] || 0;
  }
  avgGain /= period;
  avgLoss /= period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < candles.length; i++) {
    avgGain = ((avgGain * (period - 1)) + (gains[i] || 0)) / period;
    avgLoss = ((avgLoss * (period - 1)) + (losses[i] || 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

/**
 * Average True Range (ATR).
 */
export function calculateATR(candles: CandleWithHLC[], period: number = 14): number[] {
  const tr: number[] = [];
  const atr: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const { high, low } = candles[i];
    const prevClose = candles[i - 1].close;
    tr[i] = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
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

/**
 * Average Directional Index (ADX) with +DI / -DI.
 */
export function calculateADX(candles: CandleWithHLC[], period: number = 14): number[] {
  const adx: number[] = [];
  const plusDI: number[] = [];
  const minusDI: number[] = [];
  const dx: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    if (i < period) continue;

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
    dx[i] = diSum !== 0 ? (Math.abs(plusDI[i] - minusDI[i]) / diSum) * 100 : 0;
  }

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

/**
 * Bollinger Bands.
 */
export function calculateBollingerBands(
  candles: CandleWithClose[],
  period: number = 20,
  stdDev: number = 2
): BollingerBands {
  const upper: number[] = [];
  const middle: number[] = [];
  const lower: number[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += candles[i - j].close;
    }
    const sma = sum / period;
    middle[i] = sma;

    let variance = 0;
    for (let j = 0; j < period; j++) {
      variance += Math.pow(candles[i - j].close - sma, 2);
    }
    const std = Math.sqrt(variance / period);
    upper[i] = sma + std * stdDev;
    lower[i] = sma - std * stdDev;
  }

  return { upper, middle, lower };
}

/**
 * Volume average over a window.
 */
export function calculateVolumeAverage(candles: CandleWithVolume[], period: number): number[] {
  const avg: number[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += candles[i - j].volume || 0;
    }
    avg[i] = sum / period;
  }
  return avg;
}

/**
 * EMA slope (percentage change over N periods).
 */
export function calculateSlope(values: number[], period: number): number[] {
  const slopes: number[] = [];
  for (let i = period; i < values.length; i++) {
    if (values[i] && values[i - period]) {
      slopes[i] = (values[i] - values[i - period]) / values[i - period];
    }
  }
  return slopes;
}

/**
 * MACD (fast EMA − slow EMA) with signal line and histogram.
 */
export function calculateMACD(
  candles: CandleWithClose[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): MACDResult {
  const emaFast = calculateEMA(candles, fastPeriod);
  const emaSlow = calculateEMA(candles, slowPeriod);

  const macdLine: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (emaFast[i] !== undefined && emaSlow[i] !== undefined) {
      macdLine[i] = emaFast[i] - emaSlow[i];
    }
  }

  const signalLine: number[] = [];
  const multiplier = 2 / (signalPeriod + 1);

  let firstValid = -1;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== undefined) { firstValid = i; break; }
  }

  if (firstValid >= 0) {
    signalLine[firstValid] = macdLine[firstValid];
    for (let i = firstValid + 1; i < macdLine.length; i++) {
      if (macdLine[i] !== undefined) {
        signalLine[i] = (macdLine[i] - signalLine[i - 1]) * multiplier + signalLine[i - 1];
      }
    }
  }

  const histogram: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (macdLine[i] !== undefined && signalLine[i] !== undefined) {
      histogram[i] = macdLine[i] - signalLine[i];
    }
  }

  return { macdLine, signalLine, histogram };
}

/**
 * Find highest high over a look-back window.
 */
export function findSwingHighs(candles: CandleWithHigh[], lookback: number): number[] {
  const highs: number[] = [];
  for (let i = lookback; i < candles.length; i++) {
    let max = -Infinity;
    for (let j = i - lookback; j < i; j++) {
      if (candles[j].high > max) max = candles[j].high;
    }
    highs[i] = max;
  }
  return highs;
}

/**
 * Find lowest low over a look-back window.
 */
export function findSwingLows(candles: CandleWithLow[], lookback: number): number[] {
  const lows: number[] = [];
  for (let i = lookback; i < candles.length; i++) {
    let min = Infinity;
    for (let j = i - lookback; j < i; j++) {
      if (candles[j].low < min) min = candles[j].low;
    }
    lows[i] = min;
  }
  return lows;
}
