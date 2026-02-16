#!/usr/bin/env node
/**
 * Backtest V3 - Custom strategies, bypass SignalGenerator
 * Goal: >20% annual return across all market conditions
 */
import fs from 'fs';

const PERIODS = [
    { name: 'bull_2021', file: './data/backtest/BTCUSDT_4h_bull_2021.json' },
    { name: 'bear_2022', file: './data/backtest/BTCUSDT_4h_bear_2022.json' },
    { name: 'recovery_2023', file: './data/backtest/BTCUSDT_4h_recovery_2023.json' },
    { name: 'recent_6m', file: './data/backtest/BTCUSDT_4h_historical.json' },
];

const DATA = {};
for (const p of PERIODS) {
    DATA[p.name] = JSON.parse(fs.readFileSync(p.file, 'utf8')).candles;
}

// ============ INDICATOR HELPERS ============
function sma(arr, period) {
    if (arr.length < period) return null;
    let sum = 0;
    for (let i = arr.length - period; i < arr.length; i++) sum += arr[i];
    return sum / period;
}

function ema(arr, period) {
    if (arr.length < period) return null;
    const k = 2 / (period + 1);
    let e = sma(arr.slice(0, period), period);
    for (let i = period; i < arr.length; i++) {
        e = arr[i] * k + e * (1 - k);
    }
    return e;
}

function rsi(closes, period = 14) {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff; else losses -= diff;
    }
    if (losses === 0) return 100;
    const rs = (gains / period) / (losses / period);
    return 100 - 100 / (1 + rs);
}

function atr(candles, period = 14) {
    if (candles.length < period + 1) return candles[candles.length-1].close * 0.02;
    let sum = 0;
    for (let i = candles.length - period; i < candles.length; i++) {
        const tr = Math.max(
            candles[i].high - candles[i].low,
            Math.abs(candles[i].high - candles[i-1].close),
            Math.abs(candles[i].low - candles[i-1].close)
        );
        sum += tr;
    }
    return sum / period;
}

function bbands(closes, period = 20, mult = 2) {
    if (closes.length < period) return null;
    const mid = sma(closes, period);
    let variance = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
        variance += (closes[i] - mid) ** 2;
    }
    const std = Math.sqrt(variance / period);
    return { upper: mid + std * mult, mid, lower: mid - std * mult, std, pb: (closes[closes.length-1] - (mid - std * mult)) / (2 * std * mult) };
}

function adx(candles, period = 14) {
    if (candles.length < period * 2) return 0;
    let pdiSum = 0, mdiSum = 0, trSum = 0;
    for (let i = candles.length - period; i < candles.length; i++) {
        const upMove = candles[i].high - candles[i-1].high;
        const downMove = candles[i-1].low - candles[i].low;
        pdiSum += (upMove > downMove && upMove > 0) ? upMove : 0;
        mdiSum += (downMove > upMove && downMove > 0) ? downMove : 0;
        trSum += Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i-1].close), Math.abs(candles[i].low - candles[i-1].close));
    }
    const pdi = (pdiSum / trSum) * 100;
    const mdi = (mdiSum / trSum) * 100;
    const dx = Math.abs(pdi - mdi) / (pdi + mdi) * 100;
    return { adx: dx, pdi, mdi };
}

// ============ STRATEGIES ============

// Strategy 1: Mean Reversion - Buy oversold, sell overbought
function meanReversion(candles, i, closes) {
    const r = rsi(closes.slice(0, i+1), 14);
    const bb = bbands(closes.slice(0, i+1), 20, 2);
    if (!bb) return [];
    
    const signals = [];
    const price = candles[i].close;
    
    // Long: RSI < 30 AND price below lower BB
    if (r < 30 && price < bb.lower) {
        signals.push({ dir: 'long', reason: 'mean_rev_oversold', strength: (30 - r) / 30 });
    }
    // Short: RSI > 70 AND price above upper BB
    if (r > 70 && price > bb.upper) {
        signals.push({ dir: 'short', reason: 'mean_rev_overbought', strength: (r - 70) / 30 });
    }
    return signals;
}

// Strategy 2: Momentum Breakout - Strong moves with volume
function momentumBreakout(candles, i, closes) {
    if (i < 50) return [];
    const signals = [];
    const price = candles[i].close;
    const vol = candles[i].volume;
    const avgVol = candles.slice(i-20, i).reduce((s,c) => s + c.volume, 0) / 20;
    const ema10 = ema(closes.slice(0, i+1), 10);
    const ema30 = ema(closes.slice(0, i+1), 30);
    const prevEma10 = ema(closes.slice(0, i), 10);
    const prevEma30 = ema(closes.slice(0, i), 30);
    
    // EMA crossover with volume confirmation
    if (prevEma10 <= prevEma30 && ema10 > ema30 && vol > avgVol * 1.3) {
        signals.push({ dir: 'long', reason: 'momentum_cross_up', strength: vol / avgVol - 1 });
    }
    if (prevEma10 >= prevEma30 && ema10 < ema30 && vol > avgVol * 1.3) {
        signals.push({ dir: 'short', reason: 'momentum_cross_down', strength: vol / avgVol - 1 });
    }
    
    // 20-bar high/low breakout
    const high20 = Math.max(...candles.slice(i-20, i).map(c => c.high));
    const low20 = Math.min(...candles.slice(i-20, i).map(c => c.low));
    if (price > high20 && vol > avgVol * 1.2) {
        signals.push({ dir: 'long', reason: 'breakout_high20', strength: (price - high20) / high20 });
    }
    if (price < low20 && vol > avgVol * 1.2) {
        signals.push({ dir: 'short', reason: 'breakout_low20', strength: (low20 - price) / low20 });
    }
    
    return signals;
}

// Strategy 3: Trend Following with pullback entry
function trendPullback(candles, i, closes) {
    if (i < 200) return [];
    const signals = [];
    const price = candles[i].close;
    const ema21v = ema(closes.slice(0, i+1), 21);
    const sma50v = sma(closes.slice(0, i+1), 50);
    const sma200v = sma(closes.slice(0, i+1), 200);
    const r = rsi(closes.slice(0, i+1), 14);
    
    if (!ema21v || !sma50v || !sma200v) return [];
    
    // Uptrend: price > SMA200, EMA21 > SMA50
    const uptrend = price > sma200v && ema21v > sma50v;
    // Downtrend: price < SMA200, EMA21 < SMA50
    const downtrend = price < sma200v && ema21v < sma50v;
    
    // Long: uptrend + pullback to EMA21 + RSI not overbought
    if (uptrend && price <= ema21v * 1.005 && price >= ema21v * 0.97 && r < 60) {
        signals.push({ dir: 'long', reason: 'trend_pullback_long', strength: 1 - (price - ema21v * 0.97) / (ema21v * 0.035) });
    }
    // Short: downtrend + rally to EMA21 + RSI not oversold
    if (downtrend && price >= ema21v * 0.995 && price <= ema21v * 1.03 && r > 40) {
        signals.push({ dir: 'short', reason: 'trend_pullback_short', strength: (price - ema21v * 0.995) / (ema21v * 0.035) });
    }
    
    return signals;
}

// Strategy 4: Range/Grid - trade between support and resistance
function rangeGrid(candles, i, closes) {
    if (i < 50) return [];
    const signals = [];
    const price = candles[i].close;
    
    // Find recent range (last 50 bars)
    const recent = candles.slice(i-50, i);
    const rangeHigh = Math.max(...recent.map(c => c.high));
    const rangeLow = Math.min(...recent.map(c => c.low));
    const rangeSize = rangeHigh - rangeLow;
    const rangePercent = rangeSize / ((rangeHigh + rangeLow) / 2);
    
    // Only trade if in a defined range (3-15% range)
    if (rangePercent < 0.03 || rangePercent > 0.15) return [];
    
    const r = rsi(closes.slice(0, i+1), 14);
    
    // Buy near bottom of range
    if (price < rangeLow + rangeSize * 0.15 && r < 40) {
        signals.push({ dir: 'long', reason: 'range_bottom', strength: 1 - (price - rangeLow) / (rangeSize * 0.15) });
    }
    // Sell near top of range
    if (price > rangeHigh - rangeSize * 0.15 && r > 60) {
        signals.push({ dir: 'short', reason: 'range_top', strength: (price - (rangeHigh - rangeSize * 0.15)) / (rangeSize * 0.15) });
    }
    
    return signals;
}

// Strategy 5: RSI Divergence approximation
function rsiDivergence(candles, i, closes) {
    if (i < 30) return [];
    const signals = [];
    const price = candles[i].close;
    const r = rsi(closes.slice(0, i+1), 14);
    const r5 = rsi(closes.slice(0, i-5+1), 14);
    const price5 = candles[i-5].close;
    
    // Bullish divergence: price lower low, RSI higher low
    if (price < price5 && r > r5 && r < 40) {
        signals.push({ dir: 'long', reason: 'bullish_divergence', strength: (r - r5) / 20 });
    }
    // Bearish divergence: price higher high, RSI lower high
    if (price > price5 && r < r5 && r > 60) {
        signals.push({ dir: 'short', reason: 'bearish_divergence', strength: (r5 - r) / 20 });
    }
    
    return signals;
}

// ============ COMPOSITE STRATEGY ============
function getSignals(candles, i, closes, cfg) {
    const all = [];
    
    if (cfg.useMeanRev !== false) all.push(...meanReversion(candles, i, closes));
    if (cfg.useMomentum !== false) all.push(...momentumBreakout(candles, i, closes));
    if (cfg.useTrendPB !== false) all.push(...trendPullback(candles, i, closes));
    if (cfg.useRange !== false) all.push(...rangeGrid(candles, i, closes));
    if (cfg.useDivergence !== false) all.push(...rsiDivergence(candles, i, closes));
    
    // Filter by minimum strength
    return all.filter(s => s.strength >= (cfg.minStrength || 0.1));
}

// ============ BACKTEST ENGINE ============
function runPeriod(candles, cfg) {
    const closes = candles.map(c => c.close);
    let bal = 10000, peak = 10000, maxDD = 0;
    let positions = [], wins = 0, losses = 0, totProfit = 0, totLoss = 0;
    const risk = cfg.risk || 0.01;
    const maxPos = cfg.maxPositions || 3;
    const trailMult = cfg.trailATR || 2;
    const tpMult = cfg.tpATR || 3;
    const fees = 0.001; // 0.1%

    for (let i = 200; i < candles.length; i++) {
        const price = candles[i].close;
        const hi = candles[i].high;
        const lo = candles[i].low;
        const currentATR = atr(candles.slice(0, i+1), 14);

        // Update trailing stops
        for (const pos of positions) {
            if (pos.dir === 'long') {
                const newSL = hi - currentATR * trailMult;
                if (newSL > pos.sl) pos.sl = newSL;
            } else {
                const newSL = lo + currentATR * trailMult;
                if (newSL < pos.sl) pos.sl = newSL;
            }
        }

        // Check exits
        const closed = [];
        for (const pos of positions) {
            let exit = null;
            if (pos.dir === 'long') {
                if (lo <= pos.sl) exit = pos.sl;
                else if (pos.tp && hi >= pos.tp) exit = pos.tp;
            } else {
                if (hi >= pos.sl) exit = pos.sl;
                else if (pos.tp && lo <= pos.tp) exit = pos.tp;
            }
            if (exit) {
                const mult = pos.dir === 'long' ? 1 : -1;
                const pnl = (exit - pos.entry) * pos.qty * mult - (pos.entry + exit) * pos.qty * fees;
                bal += pos.cost + pnl;
                if (pnl > 0) { wins++; totProfit += pnl; }
                else { losses++; totLoss += Math.abs(pnl); }
                closed.push(pos.id);
            }
        }
        positions = positions.filter(p => !closed.includes(p.id));

        // Drawdown
        const equity = bal + positions.reduce((s, pos) => {
            const mult = pos.dir === 'long' ? 1 : -1;
            return s + (price - pos.entry) * pos.qty * mult;
        }, 0);
        if (equity > peak) peak = equity;
        const dd = (peak - equity) / peak;
        if (dd > maxDD) maxDD = dd;

        // Circuit breaker
        if (bal < 5000) continue;

        // Generate signals every 2 bars
        if (i % 2 !== 0 || positions.length >= maxPos) continue;

        const signals = getSignals(candles, i, closes, cfg);
        
        // Don't open opposing positions
        const hasLong = positions.some(p => p.dir === 'long');
        const hasShort = positions.some(p => p.dir === 'short');

        for (const sig of signals) {
            if (positions.length >= maxPos) break;
            if (sig.dir === 'long' && hasShort) continue;
            if (sig.dir === 'short' && hasLong) continue;
            
            // Avoid duplicate strategies in same direction
            if (positions.some(p => p.dir === sig.dir && p.reason === sig.reason)) continue;

            const stopDist = currentATR * trailMult;
            const riskAmt = bal * risk;
            const qty = riskAmt / stopDist;
            const cost = qty * price;

            if (cost > bal * 0.2 || cost > bal) continue;

            const sl = sig.dir === 'long' ? price - stopDist : price + stopDist;
            const tp = sig.dir === 'long' ? price + currentATR * tpMult : price - currentATR * tpMult;

            bal -= cost;
            positions.push({
                id: `${i}_${sig.reason}`,
                dir: sig.dir, entry: price, qty, sl, tp, cost,
                reason: sig.reason, strength: sig.strength
            });
        }
    }

    // Close remaining
    const lastP = candles[candles.length-1].close;
    for (const pos of positions) {
        const mult = pos.dir === 'long' ? 1 : -1;
        const pnl = (lastP - pos.entry) * pos.qty * mult - (pos.entry + lastP) * pos.qty * 0.001;
        bal += pos.cost + pnl;
        if (pnl > 0) wins++; else losses++;
    }

    const total = wins + losses;
    return {
        trades: total, wins, losses,
        wr: total > 0 ? +(wins/total*100).toFixed(1) : 0,
        ret: +((bal-10000)/100).toFixed(1),
        final: +bal.toFixed(0),
        dd: +(maxDD*100).toFixed(1),
        pf: totLoss > 0 ? +(totProfit/totLoss).toFixed(2) : (totProfit > 0 ? 99 : 0),
    };
}

function test(label, cfg) {
    console.log(`\n🔬 ${label}`);
    console.log('Period'.padEnd(18)+'Trades'.padStart(7)+'  WR%'.padStart(7)+'  Return'.padStart(9)+'  Final$'.padStart(9)+'  MaxDD'.padStart(8)+'  PF'.padStart(7));
    console.log('-'.repeat(65));
    let sum = 0, n = 0;
    for (const p of PERIODS) {
        const r = runPeriod(DATA[p.name], cfg);
        console.log(p.name.padEnd(18)+String(r.trades).padStart(7)+(r.wr+'%').padStart(7)+(r.ret+'%').padStart(9)+('$'+r.final).padStart(9)+(r.dd+'%').padStart(8)+String(r.pf).padStart(7));
        sum += r.final; n++;
    }
    const avg = (sum/n).toFixed(0);
    console.log('-'.repeat(65));
    console.log(`Promedio: $${avg} (${((avg-10000)/100).toFixed(1)}%) ${avg > 10500 ? '✅' : avg > 10000 ? '⚠️' : '❌'}`);
}

// ============ RUN ITERATIONS ============
console.log('🚀 V3 - CUSTOM STRATEGIES | Start: $10,000 | BTC 4h');
console.log('='.repeat(65));

test('ALL strategies, risk 1%, trail 2x, TP 3x', {
    risk: 0.01, trailATR: 2, tpATR: 3, maxPositions: 3
});

test('ALL strategies, risk 1.5%, trail 2x, TP 4x', {
    risk: 0.015, trailATR: 2, tpATR: 4, maxPositions: 3
});

test('ALL strats, risk 1%, trail 2.5x, TP 3x, maxPos 2', {
    risk: 0.01, trailATR: 2.5, tpATR: 3, maxPositions: 2
});

test('Only Mean Rev + Range (counter-trend)', {
    risk: 0.01, trailATR: 1.5, tpATR: 2, maxPositions: 3,
    useMomentum: false, useTrendPB: false, useDivergence: false
});

test('Only Momentum + TrendPB (trend-follow)', {
    risk: 0.01, trailATR: 2.5, tpATR: 4, maxPositions: 2,
    useMeanRev: false, useRange: false, useDivergence: false
});

test('Mean Rev + Divergence + Range (reversal-focused)', {
    risk: 0.01, trailATR: 1.5, tpATR: 2.5, maxPositions: 3,
    useMomentum: false, useTrendPB: false
});

test('ALL strats, risk 2%, trail 2x, TP 3x, maxPos 4', {
    risk: 0.02, trailATR: 2, tpATR: 3, maxPositions: 4
});

test('ALL strats, risk 1%, trail 1.5x tight, TP 2x, maxPos 4', {
    risk: 0.01, trailATR: 1.5, tpATR: 2, maxPositions: 4
});

test('ALL strats, risk 1.5%, trail 2x, TP 3x, maxPos 4, minStr 0.2', {
    risk: 0.015, trailATR: 2, tpATR: 3, maxPositions: 4, minStrength: 0.2
});

test('ALL strats, risk 1%, trail 2x, TP 5x (big winners), maxPos 3', {
    risk: 0.01, trailATR: 2, tpATR: 5, maxPositions: 3
});
