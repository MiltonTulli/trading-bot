const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');

// Load candle data
function loadCandles(file) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA, 'backtest', file)));
  return d.candles.map(c => ({
    t: new Date(c.openTime).getTime(),
    o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume
  }));
}

// Load funding rates
function loadFunding(file) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DATA, 'funding', file)));
    return d.map(r => ({ t: r.fundingTime, rate: parseFloat(r.fundingRate) }));
  } catch { return null; }
}

// Load Fear & Greed
function loadFearGreed() {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DATA, 'sentiment', 'fear-greed.json')));
    return d.data.map(r => ({ t: parseInt(r.timestamp) * 1000, value: parseInt(r.value) }));
  } catch { return null; }
}

// EMA calculation
function ema(data, period) {
  const k = 2 / (period + 1);
  const result = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i-1] * (1 - k));
  }
  return result;
}

// Get nearest value from time-series
function nearest(series, timestamp, maxDiff = 24*3600*1000) {
  if (!series || !series.length) return null;
  let best = null, bestDiff = Infinity;
  for (const s of series) {
    const diff = Math.abs(s.t - timestamp);
    if (diff < bestDiff) { bestDiff = diff; best = s; }
  }
  return bestDiff <= maxDiff ? best : null;
}

// Generate synthetic funding rates based on known historical patterns
function synthFunding(candles, period) {
  const rates = [];
  for (let i = 0; i < candles.length; i += 2) { // every 8h approx
    const c = candles[i];
    let baseRate;
    if (period === 'bull_2021') baseRate = 0.0003 + Math.random() * 0.0005; // bullish = positive funding
    else if (period === 'bear_2022') baseRate = -0.0001 + Math.random() * 0.0003;
    else if (period === 'recovery_2023') baseRate = 0.0001 + Math.random() * 0.0003;
    else baseRate = 0.0002 + Math.random() * 0.0004;
    // Add price momentum component
    if (i > 10) {
      const ret = (c.c - candles[i-10].c) / candles[i-10].c;
      baseRate += ret * 0.01;
    }
    rates.push({ t: c.t, rate: baseRate });
  }
  return rates;
}

// Generate synthetic Fear & Greed based on known historical patterns
function synthFearGreed(candles, period) {
  const fng = [];
  let lastDay = 0;
  for (const c of candles) {
    const day = Math.floor(c.t / 86400000);
    if (day === lastDay) continue;
    lastDay = day;
    let base;
    if (period === 'bull_2021') base = 60 + Math.random() * 30;
    else if (period === 'bear_2022') base = 15 + Math.random() * 30;
    else if (period === 'recovery_2023') base = 40 + Math.random() * 30;
    else base = 50 + Math.random() * 30;
    fng.push({ t: c.t, value: Math.round(Math.min(100, Math.max(1, base))) });
  }
  return fng;
}

// ============ STRATEGIES ============

// Strategy 1: Funding Rate Signal
function strategyFunding(candles, funding, params) {
  const { longThresh = -0.0001, shortThresh = 0.0005, sl = 0.03, tp = 0.04 } = params;
  return runTrades(candles, (i) => {
    const fr = nearest(funding, candles[i].t, 12*3600*1000);
    if (!fr) return 0;
    if (fr.rate < longThresh) return 1;
    if (fr.rate > shortThresh) return -1;
    return 0;
  }, sl, tp, params.posSize || 0.1);
}

// Strategy 2: Fear & Greed Contrarian
function strategyFearGreed(candles, fng, params) {
  const { buyThresh = 20, sellThresh = 80, sl = 0.04, tp = 0.06 } = params;
  return runTrades(candles, (i) => {
    const fg = nearest(fng, candles[i].t, 48*3600*1000);
    if (!fg) return 0;
    if (fg.value < buyThresh) return 1;
    if (fg.value > sellThresh) return -1;
    return 0;
  }, sl, tp, params.posSize || 0.1);
}

// Strategy 3: Funding Rate Arbitrage (delta neutral)
function strategyFundingArb(candles, funding, params) {
  const { threshold = 0.0003, posSize = 0.2 } = params;
  let balance = 10000;
  let trades = 0, wins = 0;
  let maxBal = balance, maxDD = 0;
  
  for (let i = 0; i < candles.length; i += 2) {
    const fr = nearest(funding, candles[i].t, 12*3600*1000);
    if (!fr) continue;
    const absRate = Math.abs(fr.rate);
    if (absRate > threshold) {
      // Collect funding: we earn the absolute rate on our position
      const posValue = balance * posSize;
      const profit = posValue * absRate;
      // Small slippage/cost
      const cost = posValue * 0.0002;
      balance += profit - cost;
      trades++;
      if (profit > cost) wins++;
      if (balance > maxBal) maxBal = balance;
      const dd = (maxBal - balance) / maxBal;
      if (dd > maxDD) maxDD = dd;
    }
  }
  return { balance, trades, wins, maxDD, pf: wins > 0 ? (wins / Math.max(1, trades - wins)) : 0 };
}

// Strategy 4: Grid Trading
function strategyGrid(candles, params) {
  const { levels = 10, gridPct = 0.01, posPerGrid = 0.02, lookback = 50 } = params;
  let balance = 10000;
  let trades = 0, wins = 0;
  let maxBal = balance, maxDD = 0;
  let positions = []; // {price, side, size}
  
  for (let i = lookback; i < candles.length; i++) {
    const c = candles[i];
    // Calculate grid range from recent high/low
    let hi = -Infinity, lo = Infinity;
    for (let j = i - lookback; j < i; j++) {
      if (candles[j].h > hi) hi = candles[j].h;
      if (candles[j].l < lo) lo = candles[j].l;
    }
    
    const mid = (hi + lo) / 2;
    const gridSize = mid * gridPct;
    
    // Check if price hits any grid level
    for (let g = -levels/2; g <= levels/2; g++) {
      if (g === 0) continue;
      const gridPrice = mid + g * gridSize;
      
      // Price crossed this grid level
      if (c.l <= gridPrice && gridPrice <= c.h) {
        // Check existing position at this level
        const existingIdx = positions.findIndex(p => Math.abs(p.price - gridPrice) < gridSize * 0.3);
        
        if (existingIdx >= 0) {
          // Close position
          const pos = positions[existingIdx];
          const pnl = pos.side === 1 
            ? (gridPrice - pos.price) / pos.price * pos.size
            : (pos.price - gridPrice) / pos.price * pos.size;
          balance += pnl;
          trades++;
          if (pnl > 0) wins++;
          positions.splice(existingIdx, 1);
        } else if (positions.length < levels) {
          // Open position: buy in lower half, sell in upper half
          const side = g < 0 ? 1 : -1;
          const size = balance * posPerGrid;
          positions.push({ price: gridPrice, side, size });
        }
      }
    }
    
    if (balance > maxBal) maxBal = balance;
    const dd = (maxBal - balance) / maxBal;
    if (dd > maxDD) maxDD = dd;
  }
  
  // Close remaining positions at last price
  const lastPrice = candles[candles.length - 1].c;
  for (const pos of positions) {
    const pnl = pos.side === 1
      ? (lastPrice - pos.price) / pos.price * pos.size
      : (pos.price - lastPrice) / pos.price * pos.size;
    balance += pnl;
    trades++;
    if (pnl > 0) wins++;
  }
  
  return { balance, trades, wins, maxDD, pf: wins > 0 ? (wins / Math.max(1, trades - wins)) : 0 };
}

// Strategy 5: Combined Signal
function strategyCombined(candles, funding, fng, params) {
  const { emaFast = 9, emaSlow = 21, fngBuy = 25, fngSell = 75, frLong = -0.0001, frShort = 0.0003, sl = 0.035, tp = 0.05, posSize = 0.15, minSignals = 2 } = params;
  
  const closes = candles.map(c => c.c);
  const emaF = ema(closes, emaFast);
  const emaS = ema(closes, emaSlow);
  
  return runTrades(candles, (i) => {
    if (i < emaSlow + 1) return 0;
    let bullSignals = 0, bearSignals = 0;
    
    // EMA cross
    if (emaF[i] > emaS[i] && emaF[i-1] <= emaS[i-1]) bullSignals++;
    if (emaF[i] < emaS[i] && emaF[i-1] >= emaS[i-1]) bearSignals++;
    // EMA trend (weaker signal)
    if (emaF[i] > emaS[i]) bullSignals += 0.5;
    if (emaF[i] < emaS[i]) bearSignals += 0.5;
    
    // Fear & Greed
    const fg = nearest(fng, candles[i].t, 48*3600*1000);
    if (fg) {
      if (fg.value < fngBuy) bullSignals++;
      if (fg.value > fngSell) bearSignals++;
    }
    
    // Funding rate
    const fr = nearest(funding, candles[i].t, 12*3600*1000);
    if (fr) {
      if (fr.rate < frLong) bullSignals++;
      if (fr.rate > frShort) bearSignals++;
    }
    
    if (bullSignals >= minSignals) return 1;
    if (bearSignals >= minSignals) return -1;
    return 0;
  }, sl, tp, posSize);
}

// Generic trade runner with SL/TP
function runTrades(candles, signalFn, sl, tp, posSize) {
  let balance = 10000;
  let pos = null; // {side, entry, size}
  let trades = 0, wins = 0;
  let maxBal = balance, maxDD = 0;
  let grossProfit = 0, grossLoss = 0;
  
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    
    // Check SL/TP on existing position
    if (pos) {
      let pnl = 0;
      if (pos.side === 1) {
        if (c.l <= pos.entry * (1 - sl)) pnl = -sl * pos.size;
        else if (c.h >= pos.entry * (1 + tp)) pnl = tp * pos.size;
      } else {
        if (c.h >= pos.entry * (1 + sl)) pnl = -sl * pos.size;
        else if (c.l <= pos.entry * (1 - tp)) pnl = tp * pos.size;
      }
      
      if (pnl !== 0) {
        balance += pnl;
        trades++;
        if (pnl > 0) { wins++; grossProfit += pnl; }
        else grossLoss += Math.abs(pnl);
        pos = null;
      }
    }
    
    // New signal
    if (!pos) {
      const sig = signalFn(i);
      if (sig !== 0) {
        pos = { side: sig, entry: c.c, size: balance * posSize };
      }
    }
    
    if (balance > maxBal) maxBal = balance;
    const dd = (maxBal - balance) / maxBal;
    if (dd > maxDD) maxDD = dd;
  }
  
  // Close open position
  if (pos) {
    const lastPrice = candles[candles.length - 1].c;
    const pnl = pos.side === 1
      ? (lastPrice - pos.entry) / pos.entry * pos.size
      : (pos.entry - lastPrice) / pos.entry * pos.size;
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

// Parameter grids for each strategy
const fundingParams = [
  { longThresh: -0.0001, shortThresh: 0.0005, sl: 0.03, tp: 0.04, posSize: 0.15 },
  { longThresh: -0.0002, shortThresh: 0.0003, sl: 0.025, tp: 0.05, posSize: 0.1 },
  { longThresh: -0.00005, shortThresh: 0.0008, sl: 0.04, tp: 0.06, posSize: 0.2 },
  { longThresh: -0.0003, shortThresh: 0.0004, sl: 0.02, tp: 0.035, posSize: 0.12 },
];

const fngParams = [
  { buyThresh: 20, sellThresh: 80, sl: 0.04, tp: 0.06, posSize: 0.15 },
  { buyThresh: 15, sellThresh: 85, sl: 0.03, tp: 0.08, posSize: 0.1 },
  { buyThresh: 25, sellThresh: 75, sl: 0.035, tp: 0.05, posSize: 0.2 },
  { buyThresh: 10, sellThresh: 90, sl: 0.05, tp: 0.1, posSize: 0.25 },
];

const arbParams = [
  { threshold: 0.0003, posSize: 0.3 },
  { threshold: 0.0002, posSize: 0.4 },
  { threshold: 0.0005, posSize: 0.5 },
  { threshold: 0.0001, posSize: 0.25 },
];

const gridParams = [
  { levels: 10, gridPct: 0.01, posPerGrid: 0.02, lookback: 50 },
  { levels: 8, gridPct: 0.015, posPerGrid: 0.03, lookback: 40 },
  { levels: 15, gridPct: 0.008, posPerGrid: 0.015, lookback: 60 },
  { levels: 12, gridPct: 0.012, posPerGrid: 0.025, lookback: 50 },
  { levels: 6, gridPct: 0.02, posPerGrid: 0.04, lookback: 30 },
  { levels: 20, gridPct: 0.005, posPerGrid: 0.01, lookback: 50 },
];

const combinedParams = [
  { emaFast: 9, emaSlow: 21, fngBuy: 25, fngSell: 75, frLong: -0.0001, frShort: 0.0003, sl: 0.035, tp: 0.05, posSize: 0.15, minSignals: 2 },
  { emaFast: 8, emaSlow: 21, fngBuy: 20, fngSell: 80, frLong: -0.0002, frShort: 0.0005, sl: 0.03, tp: 0.06, posSize: 0.2, minSignals: 1.5 },
  { emaFast: 12, emaSlow: 26, fngBuy: 30, fngSell: 70, frLong: -0.00005, frShort: 0.0002, sl: 0.04, tp: 0.055, posSize: 0.18, minSignals: 1.5 },
  { emaFast: 9, emaSlow: 21, fngBuy: 25, fngSell: 75, frLong: -0.0001, frShort: 0.0003, sl: 0.025, tp: 0.045, posSize: 0.12, minSignals: 2 },
  { emaFast: 7, emaSlow: 18, fngBuy: 20, fngSell: 80, frLong: -0.0003, frShort: 0.0004, sl: 0.03, tp: 0.05, posSize: 0.25, minSignals: 1.5 },
  { emaFast: 10, emaSlow: 30, fngBuy: 15, fngSell: 85, frLong: -0.0001, frShort: 0.0005, sl: 0.04, tp: 0.07, posSize: 0.15, minSignals: 2 },
];

// Run all strategies
const allResults = [];

for (const paramSet of fundingParams) {
  const results = {};
  let totalBal = 0;
  for (const ds of datasets) {
    const candles = loadCandles(ds.candles);
    let funding = loadFunding(ds.funding);
    if (!funding || funding.length === 0) funding = synthFunding(candles, ds.name);
    const r = strategyFunding(candles, funding, paramSet);
    results[ds.name] = r;
    totalBal += r.balance;
  }
  allResults.push({ strategy: 'Funding Rate', params: paramSet, results, avgBal: totalBal / 4 });
}

for (const paramSet of fngParams) {
  const results = {};
  let totalBal = 0;
  for (const ds of datasets) {
    const candles = loadCandles(ds.candles);
    let fng = fearGreed;
    if (!fng || fng.length === 0) fng = synthFearGreed(candles, ds.name);
    const r = strategyFearGreed(candles, fng, paramSet);
    results[ds.name] = r;
    totalBal += r.balance;
  }
  allResults.push({ strategy: 'Fear & Greed', params: paramSet, results, avgBal: totalBal / 4 });
}

for (const paramSet of arbParams) {
  const results = {};
  let totalBal = 0;
  for (const ds of datasets) {
    const candles = loadCandles(ds.candles);
    let funding = loadFunding(ds.funding);
    if (!funding || funding.length === 0) funding = synthFunding(candles, ds.name);
    const r = strategyFundingArb(candles, funding, paramSet);
    results[ds.name] = r;
    totalBal += r.balance;
  }
  allResults.push({ strategy: 'Funding Arb', params: paramSet, results, avgBal: totalBal / 4 });
}

for (const paramSet of gridParams) {
  const results = {};
  let totalBal = 0;
  for (const ds of datasets) {
    const candles = loadCandles(ds.candles);
    const r = strategyGrid(candles, paramSet);
    results[ds.name] = r;
    totalBal += r.balance;
  }
  allResults.push({ strategy: 'Grid Trading', params: paramSet, results, avgBal: totalBal / 4 });
}

for (const paramSet of combinedParams) {
  const results = {};
  let totalBal = 0;
  for (const ds of datasets) {
    const candles = loadCandles(ds.candles);
    let funding = loadFunding(ds.funding);
    if (!funding || funding.length === 0) funding = synthFunding(candles, ds.name);
    let fng = fearGreed;
    if (!fng || fng.length === 0) fng = synthFearGreed(candles, ds.name);
    const r = strategyCombined(candles, funding, fng, paramSet);
    results[ds.name] = r;
    totalBal += r.balance;
  }
  allResults.push({ strategy: 'Combined', params: paramSet, results, avgBal: totalBal / 4 });
}

// Sort by avg balance
allResults.sort((a, b) => b.avgBal - a.avgBal);

// Print top 10
console.log('\n' + '='.repeat(90));
console.log('🔬 BACKTEST V7 - MULTI-STRATEGY RESULTS (Top 10)');
console.log('='.repeat(90));

for (let i = 0; i < Math.min(10, allResults.length); i++) {
  const r = allResults[i];
  const avgRet = ((r.avgBal - 10000) / 10000 * 100).toFixed(1);
  console.log(`\n#${i+1} 🔬 ${r.strategy} | AVG: $${r.avgBal.toFixed(0)} (${avgRet}%)`);
  console.log(`   Params: ${JSON.stringify(r.params)}`);
  console.log('   Period          Trades  WR%    Return   Final$    MaxDD    PF');
  for (const ds of datasets) {
    const res = r.results[ds.name];
    const wr = res.trades > 0 ? (res.wins / res.trades * 100).toFixed(0) : '0';
    const ret = ((res.balance - 10000) / 10000 * 100).toFixed(1);
    const dd = (res.maxDD * 100).toFixed(1);
    const pf = res.pf.toFixed(2);
    console.log(`   ${ds.name.padEnd(16)} ${String(res.trades).padStart(5)}  ${wr.padStart(3)}%  ${(ret+'%').padStart(8)}  $${res.balance.toFixed(0).padStart(6)}  ${(dd+'%').padStart(6)}  ${pf.padStart(5)}`);
  }
}

// Save full results
fs.writeFileSync(path.join(DATA, 'backtest', 'results-v7.json'), JSON.stringify(allResults.slice(0, 20), null, 2));
console.log('\n✅ Results saved to data/backtest/results-v7.json');
