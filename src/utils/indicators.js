/**
 * Shared Technical Indicator Calculations
 *
 * Pure-function implementations of common indicators used across strategies.
 * Each function operates on plain arrays (closes, highs, lows, volumes) and
 * returns sparse arrays indexed by candle position.
 *
 * @module utils/indicators
 */

/**
 * Exponential Moving Average (EMA).
 * @param {Array<{close: number}>} candles - OHLCV candles.
 * @param {number} period - Look-back period.
 * @returns {number[]} Sparse array of EMA values.
 */
export function calculateEMA(candles, period) {
  const ema = [];
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
 * @param {Array<{close: number}>} candles - OHLCV candles.
 * @param {number} period - Look-back period.
 * @returns {number[]} Sparse array of SMA values.
 */
export function calculateSMA(candles, period) {
  const sma = [];
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
 * @param {number[]} values - Sparse numeric array.
 * @param {number} period - Look-back period.
 * @returns {number[]} Sparse array of SMA values.
 */
export function calculateSMAFromValues(values, period) {
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
 * Relative Strength Index (RSI).
 * @param {Array<{close: number}>} candles - OHLCV candles.
 * @param {number} [period=14] - Look-back period.
 * @returns {number[]} Sparse array of RSI values (0-100).
 */
export function calculateRSI(candles, period = 14) {
  const rsi = [];
  const gains = [];
  const losses = [];

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
 * @param {Array<{high: number, low: number, close: number}>} candles
 * @param {number} [period=14]
 * @returns {number[]} Sparse array of ATR values.
 */
export function calculateATR(candles, period = 14) {
  const tr = [];
  const atr = [];

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
 * @param {Array<{high: number, low: number, close: number}>} candles
 * @param {number} [period=14]
 * @returns {number[]} Sparse array of ADX values.
 */
export function calculateADX(candles, period = 14) {
  const adx = [];
  const plusDI = [];
  const minusDI = [];
  const dx = [];

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
 * @param {Array<{close: number}>} candles
 * @param {number} [period=20]
 * @param {number} [stdDev=2]
 * @returns {{upper: number[], middle: number[], lower: number[]}}
 */
export function calculateBollingerBands(candles, period = 20, stdDev = 2) {
  const upper = [];
  const middle = [];
  const lower = [];

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
 * @param {Array<{volume: number}>} candles
 * @param {number} period
 * @returns {number[]}
 */
export function calculateVolumeAverage(candles, period) {
  const avg = [];
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
 * @param {number[]} values - Sparse EMA array.
 * @param {number} period
 * @returns {number[]}
 */
export function calculateSlope(values, period) {
  const slopes = [];
  for (let i = period; i < values.length; i++) {
    if (values[i] && values[i - period]) {
      slopes[i] = (values[i] - values[i - period]) / values[i - period];
    }
  }
  return slopes;
}

/**
 * MACD (fast EMA − slow EMA) with signal line and histogram.
 * @param {Array<{close: number}>} candles
 * @param {number} fastPeriod
 * @param {number} slowPeriod
 * @param {number} signalPeriod
 * @returns {{macdLine: number[], signalLine: number[], histogram: number[]}}
 */
export function calculateMACD(candles, fastPeriod, slowPeriod, signalPeriod) {
  const emaFast = calculateEMA(candles, fastPeriod);
  const emaSlow = calculateEMA(candles, slowPeriod);

  const macdLine = [];
  for (let i = 0; i < candles.length; i++) {
    if (emaFast[i] !== undefined && emaSlow[i] !== undefined) {
      macdLine[i] = emaFast[i] - emaSlow[i];
    }
  }

  const signalLine = [];
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

  const histogram = [];
  for (let i = 0; i < candles.length; i++) {
    if (macdLine[i] !== undefined && signalLine[i] !== undefined) {
      histogram[i] = macdLine[i] - signalLine[i];
    }
  }

  return { macdLine, signalLine, histogram };
}

/**
 * Find highest high over a look-back window.
 * @param {Array<{high: number}>} candles
 * @param {number} lookback
 * @returns {number[]}
 */
export function findSwingHighs(candles, lookback) {
  const highs = [];
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
 * @param {Array<{low: number}>} candles
 * @param {number} lookback
 * @returns {number[]}
 */
export function findSwingLows(candles, lookback) {
  const lows = [];
  for (let i = lookback; i < candles.length; i++) {
    let min = Infinity;
    for (let j = i - lookback; j < i; j++) {
      if (candles[j].low < min) min = candles[j].low;
    }
    lows[i] = min;
  }
  return lows;
}
