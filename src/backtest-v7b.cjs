const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, '..', 'data');

function loadCandles(file) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA, 'backtest', file)));
  return d.candles.map(c => ({
    t: new Date(c.openTime).getTime(),
    o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume
  }));
}

function loadFunding(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, 'funding', file)))
      .map(r => ({ t: r.fundingTime, rate: parseFloat(r.fundingRate) }));
  } catch { return []; }
}

function loadFearGreed() {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DATA, 'sentiment', 'fear-greed.json')));
    return d.data.map(r => ({ t: parseInt(r.timestamp) * 1000, value: parseInt(r.value) })).reverse(); // chronological
  } catch { return []; }
}

function ema(data, period) {
  const k = 2 / (period + 1);
  const r = [data[0]];
  for (let i = 1; i < data.length; i++) r.push(data[i] * k + r[i-1] * (1-k));
  return r;
}

function rsi(closes, period = 14) {
  const r = new Array(closes.length).fill(50);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period && i < closes.length; i++) {
    const d = closes[i] - closes[i-1];
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i-1];
    avgGain = (avgGain * (period-1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period-1) + (d < 0 ? -d : 0)) / period;
    r[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain/avgLoss);
  }
  return r;
}

function nearest(series, ts, maxDiff = 24*3600*1000) {
  if (!series.length) return null;
  // Binary search
  let lo = 0, hi = series.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].t < ts) lo = mid + 1; else hi = mid;
  }
  let best = series[lo];
  if (lo > 0 && Math.abs(series[lo-1].t - ts) < Math.abs(best.t - ts)) best = series[lo-1];
  return Math.abs(best.t - ts) <= maxDiff ? best : null;
}

// ============ IMPROVED GRID TRADING ============
function strategyGrid(candles, params) {
  const { levels = 10, gridSpacing = 0.01, posPerGrid = 0.03, lookback = 50, leverage = 5 } = params;
  let balance = 10000;
  let trades = 0, wins = 0, maxBal = 10000, maxDD = 0;
  
  // Grid state: map of gridLevel -> {entryPrice, side, size}
  let gridOrders = new Map();
  let lastRangeCalc = 0;
  let gridLevels = [];
  
  for (let i = lookback; i < candles.length; i++) {
    const c = candles[i];
    
    // Recalculate grid every 50 bars
    if (i - lastRangeCalc >= 50 || gridLevels.length === 0) {
      lastRangeCalc = i;
      let hi = -Infinity, lo = Infinity;
      for (let j = i - lookback; j < i; j++) {
        if (candles[j].h > hi) hi = candles[j].h;
        if (candles[j].l < lo) lo = candles[j].l;
      }
      // Set grid levels
      gridLevels = [];
      const step = (hi - lo) / (levels + 1);
      for (let g = 1; g <= levels; g++) {
        gridLevels.push(lo + g * step);
      }
      // Close all existing positions when grid resets
      for (const [lvl, pos] of gridOrders) {
        const pnl = pos.side === 1
          ? (c.c - pos.entry) / pos.entry * pos.size * leverage
          : (pos.entry - c.c) / pos.entry * pos.size * leverage;
        balance += pnl;
        trades++;
        if (pnl > 0) wins++;
      }
      gridOrders.clear();
    }
    
    const mid = gridLevels[Math.floor(gridLevels.length / 2)];
    
    // Check each grid level
    for (let g = 0; g < gridLevels.length; g++) {
      const lvl = gridLevels[g];
      const key = g;
      
      // Price crossed this level
      if (c.l <= lvl && lvl <= c.h) {
        if (gridOrders.has(key)) {
          // Close existing position
          const pos = gridOrders.get(key);
          const pnl = pos.side === 1
            ? (lvl - pos.entry) / pos.entry * pos.size * leverage
            : (pos.entry - lvl) / pos.entry * pos.size * leverage;
          balance += pnl;
          trades++;
          if (pnl > 0) wins++;
          gridOrders.delete(key);
        } else if (gridOrders.size < levels) {
          // Open: buy below mid, sell above mid
          const side = lvl < mid ? 1 : -1;
          const size = balance * posPerGrid;
          gridOrders.set(key, { entry: lvl, side, size });
        }
      }
    }
    
    if (balance > maxBal) maxBal = balance;
    const dd = (maxBal - balance) / maxBal;
    if (dd > maxDD) maxDD = dd;
    if (balance <= 0) { balance = 0; break; }
  }
  
  // Close remaining
  const lastP = candles[candles.length-1].c;
  for (const [, pos] of gridOrders) {
    const pnl = pos.side === 1
      ? (lastP - pos.entry) / pos.entry * pos.size * leverage
      : (pos.entry - lastP) / pos.entry * pos.size * leverage;
    balance += pnl;
    trades++;
    if (pnl > 0) wins++;
  }
  
  return { balance, trades, wins, maxDD, pf: wins > 0 ? wins / Math.max(1, trades - wins) : 0 };
}

// ============ MOMENTUM + MEAN REVERSION HYBRID ============
function strategyMomentumMR(candles, params) {
  const { emaPeriod = 20, rsiPeriod = 14, rsiBuy = 30, rsiSell = 70, sl = 0.03, tp = 0.05, posSize = 0.15, leverage = 3 } = params;
  const closes = candles.map(c => c.c);
  const emaLine = ema(closes, emaPeriod);
  const rsiLine = rsi(closes, rsiPeriod);
  
  return runTrades(candles, (i) => {
    if (i < emaPeriod + 2) return 0;
    // Mean reversion: RSI oversold + price near EMA support
    const pricePctFromEma = (closes[i] - emaLine[i]) / emaLine[i];
    if (rsiLine[i] < rsiBuy && pricePctFromEma < 0.01) return 1;
    if (rsiLine[i] > rsiSell && pricePctFromEma > -0.01) return -1;
    return 0;
  }, sl, tp, posSize, leverage);
}

// ============ BREAKOUT + VOLUME ============
function strategyBreakout(candles, params) {
  const { lookback = 20, volMult = 1.5, sl = 0.025, tp = 0.04, posSize = 0.2, leverage = 3 } = params;
  
  return runTrades(candles, (i) => {
    if (i < lookback + 1) return 0;
    let hi = -Infinity, lo = Infinity, avgVol = 0;
    for (let j = i - lookback; j < i; j++) {
      if (candles[j].h > hi) hi = candles[j].h;
      if (candles[j].l < lo) lo = candles[j].l;
      avgVol += candles[j].v;
    }
    avgVol /= lookback;
    
    if (candles[i].v < avgVol * volMult) return 0;
    if (candles[i].c > hi) return 1;  // Breakout long
    if (candles[i].c < lo) return -1; // Breakdown short
    return 0;
  }, sl, tp, posSize, leverage);
}

// ============ FUNDING + SENTIMENT + TA COMBINED V2 ============
function strategyCombinedV2(candles, funding, fng, params) {
  const { emaFast = 9, emaSlow = 21, fngBuy = 25, fngSell = 75, frLong = -0.0001, frShort = 0.0003, rsiBuy = 35, rsiSell = 65, sl = 0.03, tp = 0.05, posSize = 0.2, leverage = 3, minScore = 2 } = params;
  
  const closes = candles.map(c => c.c);
  const emaF = ema(closes, emaFast);
  const emaS = ema(closes, emaSlow);
  const rsiLine = rsi(closes, 14);
  
  return runTrades(candles, (i) => {
    if (i < emaSlow + 2) return 0;
    let score = 0; // positive = bull, negative = bear
    
    // EMA trend
    if (emaF[i] > emaS[i]) score += 1; else score -= 1;
    // EMA cross (strong signal)
    if (emaF[i] > emaS[i] && emaF[i-1] <= emaS[i-1]) score += 1.5;
    if (emaF[i] < emaS[i] && emaF[i-1] >= emaS[i-1]) score -= 1.5;
    // RSI
    if (rsiLine[i] < rsiBuy) score += 1;
    if (rsiLine[i] > rsiSell) score -= 1;
    // Fear & Greed
    const fg = nearest(fng, candles[i].t, 48*3600*1000);
    if (fg) {
      if (fg.value < fngBuy) score += 1;
      if (fg.value > fngSell) score -= 1;
    }
    // Funding
    const fr = nearest(funding, candles[i].t, 12*3600*1000);
    if (fr) {
      if (fr.rate < frLong) score += 1;
      if (fr.rate > frShort) score -= 1;
    }
    
    if (score >= minScore) return 1;
    if (score <= -minScore) return -1;
    return 0;
  }, sl, tp, posSize, leverage);
}

function runTrades(candles, signalFn, sl, tp, posSize, leverage = 1) {
  let balance = 10000;
  let pos = null;
  let trades = 0, wins = 0, maxBal = 10000, maxDD = 0;
  let grossProfit = 0, grossLoss = 0;
  
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    
    if (pos) {
      let pnl = 0;
      const move = pos.side === 1 ? (c.c - pos.entry) / pos.entry : (pos.entry - c.c) / pos.entry;
      // Check SL with low/high
      if (pos.side === 1) {
        const worstMove = (c.l - pos.entry) / pos.entry;
        const bestMove = (c.h - pos.entry) / pos.entry;
        if (worstMove <= -sl) pnl = -sl * pos.size * leverage;
        else if (bestMove >= tp) pnl = tp * pos.size * leverage;
      } else {
        const worstMove = (pos.entry - c.h) / pos.entry;
        const bestMove = (pos.entry - c.l) / pos.entry;
        if (worstMove <= -sl) pnl = -sl * pos.size * leverage;
        else if (bestMove >= tp) pnl = tp * pos.size * leverage;
      }
      
      if (pnl !== 0) {
        balance += pnl;
        trades++;
        if (pnl > 0) { wins++; grossProfit += pnl; }
        else grossLoss += Math.abs(pnl);
        pos = null;
      }
    }
    
    if (!pos) {
      const sig = signalFn(i);
      if (sig !== 0) {
        pos = { side: sig, entry: c.c, size: balance * posSize };
      }
    }
    
    if (balance > maxBal) maxBal = balance;
    const dd = (maxBal - balance) / maxBal;
    if (dd > maxDD) maxDD = dd;
    if (balance <= 0) { balance = 0; break; }
  }
  
  if (pos) {
    const lp = candles[candles.length-1].c;
    const move = pos.side === 1 ? (lp - pos.entry) / pos.entry : (pos.entry - lp) / pos.entry;
    const pnl = move * pos.size * leverage;
    balance += pnl;
    trades++;
    if (pnl > 0) { wins++; grossProfit += pnl; }
    else grossLoss += Math.abs(pnl);
  }
  
  return { balance, trades, wins, maxDD, pf: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0 };
}

// ============ MAIN ============
const datasets = [
  { name: 'bull_2021', candles: 'BTCUSDT_4h_bull_2021.json', funding: 'funding_bull_2021.json' },
  { name: 'bear_2022', candles: 'BTCUSDT_4h_bear_2022.json', funding: 'funding_bear_2022.json' },
  { name: 'recovery_23', candles: 'BTCUSDT_4h_recovery_2023.json', funding: 'funding_recovery_2023.json' },
  { name: 'recent_6m', candles: 'BTCUSDT_4h_historical.json', funding: 'funding_recent.json' },
];

const fearGreed = loadFearGreed();
const allResults = [];

// Grid Trading - many param combos
const gridConfigs = [];
for (const levels of [6, 8, 10, 12, 15, 20]) {
  for (const gridSpacing of [0.005, 0.008, 0.01, 0.015, 0.02]) {
    for (const posPerGrid of [0.01, 0.02, 0.03, 0.04, 0.05]) {
      for (const leverage of [1, 2, 3, 5]) {
        gridConfigs.push({ levels, gridSpacing, posPerGrid, lookback: 50, leverage });
      }
    }
  }
}

console.log(`Testing ${gridConfigs.length} grid configs...`);
for (const params of gridConfigs) {
  const results = {};
  let totalBal = 0;
  for (const ds of datasets) {
    const candles = loadCandles(ds.candles);
    const r = strategyGrid(candles, params);
    results[ds.name] = r;
    totalBal += r.balance;
  }
  const avgBal = totalBal / 4;
  if (avgBal > 10200) // Only keep promising ones
    allResults.push({ strategy: 'Grid Trading', params, results, avgBal });
}

// Momentum + Mean Reversion
const mrConfigs = [];
for (const emaPeriod of [15, 20, 30, 50]) {
  for (const rsiBuy of [25, 30, 35]) {
    for (const rsiSell of [65, 70, 75]) {
      for (const sl of [0.02, 0.03, 0.04]) {
        for (const tp of [0.04, 0.06, 0.08]) {
          for (const leverage of [1, 2, 3, 5]) {
            mrConfigs.push({ emaPeriod, rsiBuy, rsiSell, sl, tp, posSize: 0.15, leverage });
          }
        }
      }
    }
  }
}

console.log(`Testing ${mrConfigs.length} momentum-MR configs...`);
for (const params of mrConfigs) {
  const results = {};
  let totalBal = 0;
  for (const ds of datasets) {
    const candles = loadCandles(ds.candles);
    const r = strategyMomentumMR(candles, params);
    results[ds.name] = r;
    totalBal += r.balance;
  }
  const avgBal = totalBal / 4;
  if (avgBal > 10500)
    allResults.push({ strategy: 'Momentum+MR', params, results, avgBal });
}

// Breakout
const breakoutConfigs = [];
for (const lookback of [10, 15, 20, 30]) {
  for (const volMult of [1.0, 1.3, 1.5, 2.0]) {
    for (const sl of [0.02, 0.025, 0.03]) {
      for (const tp of [0.03, 0.04, 0.06, 0.08]) {
        for (const leverage of [1, 2, 3, 5]) {
          breakoutConfigs.push({ lookback, volMult, sl, tp, posSize: 0.2, leverage });
        }
      }
    }
  }
}

console.log(`Testing ${breakoutConfigs.length} breakout configs...`);
for (const params of breakoutConfigs) {
  const results = {};
  let totalBal = 0;
  for (const ds of datasets) {
    const candles = loadCandles(ds.candles);
    const r = strategyBreakout(candles, params);
    results[ds.name] = r;
    totalBal += r.balance;
  }
  const avgBal = totalBal / 4;
  if (avgBal > 10500)
    allResults.push({ strategy: 'Breakout', params, results, avgBal });
}

// Combined V2
const combinedConfigs = [];
for (const emaFast of [9, 12]) {
  for (const emaSlow of [21, 30]) {
    for (const fngBuy of [20, 30]) {
      for (const rsiSell of [65, 75]) {
        for (const sl of [0.025, 0.04]) {
          for (const tp of [0.04, 0.06, 0.08]) {
            for (const leverage of [2, 3, 5]) {
              for (const minScore of [1.5, 2]) {
                combinedConfigs.push({ emaFast, emaSlow, fngBuy, fngSell: 100 - fngBuy, frLong: -0.0001, frShort: 0.0003, rsiBuy: 100 - rsiSell, rsiSell, sl, tp, posSize: 0.15, leverage, minScore });
              }
            }
          }
        }
      }
    }
  }
}

console.log(`Testing ${combinedConfigs.length} combined configs...`);
for (const params of combinedConfigs) {
  const results = {};
  let totalBal = 0;
  for (const ds of datasets) {
    const candles = loadCandles(ds.candles);
    const funding = loadFunding(ds.funding);
    const r = strategyCombinedV2(candles, funding, fearGreed, params);
    results[ds.name] = r;
    totalBal += r.balance;
  }
  const avgBal = totalBal / 4;
  if (avgBal > 10500)
    allResults.push({ strategy: 'CombinedV2', params, results, avgBal });
}

// Sort and print top 10
allResults.sort((a, b) => b.avgBal - a.avgBal);

console.log('\n' + '='.repeat(90));
console.log('🔬 BACKTEST V7b - COMPREHENSIVE MULTI-STRATEGY (Top 10)');
console.log('='.repeat(90));

for (let i = 0; i < Math.min(10, allResults.length); i++) {
  const r = allResults[i];
  const avgRet = ((r.avgBal - 10000) / 10000 * 100).toFixed(1);
  console.log(`\n#${i+1} 🔬 ${r.strategy} | AVG: $${r.avgBal.toFixed(0)} (${avgRet}%)`);
  const pKeys = Object.keys(r.params);
  const pStr = pKeys.map(k => `${k}=${r.params[k]}`).join(' ');
  console.log(`   ${pStr}`);
  console.log('   Period          Trades  WR%    Return   Final$    MaxDD    PF');
  for (const ds of datasets) {
    const res = r.results[ds.name];
    const wr = res.trades > 0 ? (res.wins / res.trades * 100).toFixed(0) : '0';
    const ret = ((res.balance - 10000) / 10000 * 100).toFixed(1);
    const dd = (res.maxDD * 100).toFixed(1);
    const pf = typeof res.pf === 'number' ? res.pf.toFixed(2) : '0.00';
    console.log(`   ${ds.name.padEnd(16)} ${String(res.trades).padStart(5)}  ${wr.padStart(3)}%  ${(ret+'%').padStart(8)}  $${res.balance.toFixed(0).padStart(6)}  ${(dd+'%').padStart(6)}  ${pf.padStart(5)}`);
  }
}

console.log(`\nTotal configs tested: ${gridConfigs.length + mrConfigs.length + breakoutConfigs.length + combinedConfigs.length}`);
console.log(`Configs above threshold: ${allResults.length}`);

fs.writeFileSync(path.join(DATA, 'backtest', 'results-v7b.json'), JSON.stringify(allResults.slice(0, 20), null, 2));
