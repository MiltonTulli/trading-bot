const fs = require('fs');
const path = require('path');

// Load full dataset
const dataFile = path.join(__dirname, '..', 'data', 'backtest', 'BTCUSDT_4h_full.json');
const raw = JSON.parse(fs.readFileSync(dataFile));
const candles = raw.candles.map(c => ({
    t: new Date(c.openTime).getTime(),
    o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume,
    date: c.openTime
}));

// Load funding & fear-greed for CombinedV2
let fearGreed = [];
try {
    const fg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sentiment', 'fear-greed.json')));
    fearGreed = fg.data.map(r => ({ t: parseInt(r.timestamp) * 1000, value: parseInt(r.value) })).reverse();
} catch(e) {}

let allFunding = [];
try {
    const fundingDir = path.join(__dirname, '..', 'data', 'funding');
    for (const f of fs.readdirSync(fundingDir)) {
        const data = JSON.parse(fs.readFileSync(path.join(fundingDir, f)));
        allFunding.push(...data.map(r => ({ t: r.fundingTime, rate: parseFloat(r.fundingRate) })));
    }
    allFunding.sort((a,b) => a.t - b.t);
} catch(e) {}

function nearest(series, ts, maxDiff = 48*3600*1000) {
    if (!series.length) return null;
    let lo = 0, hi = series.length - 1;
    while (lo < hi) { const mid = (lo+hi)>>1; if (series[mid].t < ts) lo = mid+1; else hi = mid; }
    let best = series[lo];
    if (lo > 0 && Math.abs(series[lo-1].t - ts) < Math.abs(best.t - ts)) best = series[lo-1];
    return Math.abs(best.t - ts) <= maxDiff ? best : null;
}

function ema(data, period) {
    const k = 2/(period+1); const r = [data[0]];
    for (let i=1; i<data.length; i++) r.push(data[i]*k + r[i-1]*(1-k));
    return r;
}

function rsi(closes, period=14) {
    const r = new Array(closes.length).fill(50);
    let ag=0, al=0;
    for (let i=1; i<=period && i<closes.length; i++) { const d=closes[i]-closes[i-1]; if(d>0)ag+=d; else al-=d; }
    ag/=period; al/=period;
    for (let i=period+1; i<closes.length; i++) {
        const d=closes[i]-closes[i-1];
        ag=(ag*(period-1)+(d>0?d:0))/period;
        al=(al*(period-1)+(d<0?-d:0))/period;
        r[i]=al===0?100:100-100/(1+ag/al);
    }
    return r;
}

// ============ STRATEGY: BREAKOUT ============
function strategyBreakout(candleSlice, params) {
    const { lookback=10, volMult=2, sl=0.03, tp=0.06, posSize=0.2, leverage=5 } = params;
    return runTrades(candleSlice, (i, cs) => {
        if (i < lookback + 1) return 0;
        let hi=-Infinity, lo=Infinity, avgVol=0;
        for (let j=i-lookback; j<i; j++) {
            if (cs[j].h > hi) hi = cs[j].h;
            if (cs[j].l < lo) lo = cs[j].l;
            avgVol += cs[j].v;
        }
        avgVol /= lookback;
        if (cs[i].v < avgVol * volMult) return 0;
        if (cs[i].c > hi) return 1;
        if (cs[i].c < lo) return -1;
        return 0;
    }, sl, tp, posSize, leverage);
}

// ============ STRATEGY: COMBINED V2 ============
function strategyCombined(candleSlice, params) {
    const { emaFast=12, emaSlow=30, rsiBuy=25, rsiSell=75, fngBuy=20, fngSell=80, sl=0.04, tp=0.06, posSize=0.15, leverage=5, minScore=2 } = params;
    const closes = candleSlice.map(c => c.c);
    const emaF = ema(closes, emaFast);
    const emaS = ema(closes, emaSlow);
    const rsiLine = rsi(closes, 14);
    
    return runTrades(candleSlice, (i, cs) => {
        if (i < emaSlow + 2) return 0;
        let score = 0;
        if (emaF[i] > emaS[i]) score += 1; else score -= 1;
        if (emaF[i] > emaS[i] && emaF[i-1] <= emaS[i-1]) score += 1.5;
        if (emaF[i] < emaS[i] && emaF[i-1] >= emaS[i-1]) score -= 1.5;
        if (rsiLine[i] < rsiBuy) score += 1;
        if (rsiLine[i] > rsiSell) score -= 1;
        const fg = nearest(fearGreed, cs[i].t);
        if (fg) { if (fg.value < fngBuy) score += 1; if (fg.value > fngSell) score -= 1; }
        const fr = nearest(allFunding, cs[i].t, 12*3600*1000);
        if (fr) { if (fr.rate < -0.0001) score += 1; if (fr.rate > 0.0003) score -= 1; }
        if (score >= minScore) return 1;
        if (score <= -minScore) return -1;
        return 0;
    }, sl, tp, posSize, leverage);
}

function runTrades(cs, signalFn, sl, tp, posSize, leverage) {
    let balance = 10000, pos = null;
    let trades = 0, wins = 0, maxBal = 10000, maxDD = 0;
    let grossProfit = 0, grossLoss = 0;

    for (let i = 1; i < cs.length; i++) {
        const c = cs[i];
        if (pos) {
            let pnl = 0;
            if (pos.side === 1) {
                if ((c.l - pos.entry) / pos.entry <= -sl) pnl = -sl * pos.size * leverage;
                else if ((c.h - pos.entry) / pos.entry >= tp) pnl = tp * pos.size * leverage;
            } else {
                if ((pos.entry - c.h) / pos.entry <= -sl) pnl = -sl * pos.size * leverage;
                else if ((pos.entry - c.l) / pos.entry >= tp) pnl = tp * pos.size * leverage;
            }
            if (pnl !== 0) {
                balance += pnl;
                trades++;
                if (pnl > 0) { wins++; grossProfit += pnl; } else grossLoss += Math.abs(pnl);
                pos = null;
            }
        }
        if (!pos && balance > 1000) {
            const sig = signalFn(i, cs);
            if (sig !== 0) pos = { side: sig, entry: c.c, size: balance * posSize };
        }
        if (balance > maxBal) maxBal = balance;
        const dd = (maxBal - balance) / maxBal;
        if (dd > maxDD) maxDD = dd;
        if (balance <= 0) { balance = 0; break; }
    }
    // Close remaining
    if (pos) {
        const lp = cs[cs.length-1].c;
        const move = pos.side === 1 ? (lp - pos.entry) / pos.entry : (pos.entry - lp) / pos.entry;
        const pnl = move * pos.size * leverage;
        balance += pnl; trades++;
        if (pnl > 0) { wins++; grossProfit += pnl; } else grossLoss += Math.abs(pnl);
    }
    return { balance: +balance.toFixed(0), trades, wins, maxDD: +(maxDD*100).toFixed(1), pf: grossLoss > 0 ? +(grossProfit/grossLoss).toFixed(2) : (grossProfit > 0 ? 99 : 0) };
}

// ============ MONTHLY BACKTEST ============
function monthlyBacktest(strategyFn, params, label) {
    // Split candles into months
    const months = {};
    for (const c of candles) {
        const ym = c.date.slice(0, 7); // "2021-01"
        if (!months[ym]) months[ym] = [];
        months[ym].push(c);
    }
    
    const sortedMonths = Object.keys(months).sort();
    
    // We need lookback data, so we'll use a rolling window approach
    // For each month, include previous N candles as warmup
    const WARMUP = 200; // candles needed for indicators
    
    console.log(`\n🔬 ${label}`);
    console.log('Month'.padEnd(10) + 'BTC Price'.padStart(10) + 'Trades'.padStart(8) + '  WR%'.padStart(7) + '  Return'.padStart(9) + '  Final$'.padStart(9) + '  MaxDD'.padStart(8) + '  PF'.padStart(7));
    console.log('-'.repeat(68));
    
    let totalReturn = 0;
    let monthCount = 0;
    let positiveMonths = 0;
    let negativeMonths = 0;
    let worstMonth = Infinity;
    let bestMonth = -Infinity;
    let compoundBal = 10000; // compound across months
    
    for (let m = 0; m < sortedMonths.length; m++) {
        const ym = sortedMonths[m];
        
        // Build slice: warmup + this month
        // Find start index of this month in full candles array
        const monthStart = candles.findIndex(c => c.date.startsWith(ym));
        if (monthStart < 0) continue;
        const monthEnd = candles.findIndex(c => !c.date.startsWith(ym) && candles.indexOf(c) > monthStart);
        const actualEnd = monthEnd < 0 ? candles.length : monthEnd;
        
        const warmupStart = Math.max(0, monthStart - WARMUP);
        const slice = candles.slice(warmupStart, actualEnd);
        
        if (slice.length < WARMUP + 10) continue; // skip if not enough data
        
        const r = strategyFn(slice, params);
        const ret = ((r.balance - 10000) / 100);
        const wr = r.trades > 0 ? (r.wins / r.trades * 100).toFixed(0) : '-';
        const btcPrice = months[ym][months[ym].length - 1].c;
        
        console.log(
            ym.padEnd(10) +
            ('$' + btcPrice.toFixed(0)).padStart(10) +
            String(r.trades).padStart(8) +
            (wr === '-' ? '-' : wr + '%').padStart(7) +
            (ret.toFixed(1) + '%').padStart(9) +
            ('$' + r.balance).padStart(9) +
            (r.maxDD + '%').padStart(8) +
            String(r.pf).padStart(7)
        );
        
        totalReturn += ret;
        monthCount++;
        if (ret > 0) positiveMonths++;
        if (ret < 0) negativeMonths++;
        if (ret < worstMonth) worstMonth = ret;
        if (ret > bestMonth) bestMonth = ret;
        
        // Compound
        compoundBal *= (1 + ret / 100);
    }
    
    console.log('-'.repeat(68));
    console.log(`📊 ${monthCount} meses | ✅ ${positiveMonths} positivos | ❌ ${negativeMonths} negativos`);
    console.log(`   Avg mensual: ${(totalReturn / monthCount).toFixed(1)}% | Mejor: +${bestMonth.toFixed(1)}% | Peor: ${worstMonth.toFixed(1)}%`);
    console.log(`   Compuesto final: $${compoundBal.toFixed(0)} (${((compoundBal - 10000) / 100).toFixed(1)}%)`);
    console.log(`   Win ratio meses: ${(positiveMonths / monthCount * 100).toFixed(0)}%`);
    
    return { monthCount, positiveMonths, negativeMonths, avgMonthly: totalReturn / monthCount, best: bestMonth, worst: worstMonth, compound: compoundBal };
}

// ============ RUN ============
console.log('🚀 MONTHLY BACKTEST | BTC 4h | Jan 2021 → Feb 2026');
console.log('Start: $10,000 per month (independent) + compound tracking');
console.log('='.repeat(68));

// Breakout #2 (winner from V7)
monthlyBacktest(strategyBreakout, {
    lookback: 10, volMult: 2, sl: 0.03, tp: 0.06, posSize: 0.2, leverage: 5
}, '⭐ BREAKOUT #2 (lookback=10, vol×2, SL 3%, TP 6%, 5x lev)');

// Breakout variants
monthlyBacktest(strategyBreakout, {
    lookback: 10, volMult: 2, sl: 0.025, tp: 0.06, posSize: 0.2, leverage: 5
}, 'BREAKOUT #4 (SL 2.5%)');

monthlyBacktest(strategyBreakout, {
    lookback: 10, volMult: 1.5, sl: 0.03, tp: 0.06, posSize: 0.2, leverage: 5
}, 'BREAKOUT (vol×1.5, looser filter)');

monthlyBacktest(strategyBreakout, {
    lookback: 15, volMult: 2, sl: 0.03, tp: 0.08, posSize: 0.2, leverage: 5
}, 'BREAKOUT (lookback=15, TP 8%)');

// Combined V2 #1 (runner up)
monthlyBacktest(strategyCombined, {
    emaFast: 12, emaSlow: 30, rsiBuy: 25, rsiSell: 75, fngBuy: 20, fngSell: 80,
    sl: 0.04, tp: 0.06, posSize: 0.15, leverage: 5, minScore: 2
}, '⭐ COMBINED V2 #1 (EMA 12/30, F&G, Funding, 5x lev)');

// Combined with different params
monthlyBacktest(strategyCombined, {
    emaFast: 12, emaSlow: 21, rsiBuy: 25, rsiSell: 75, fngBuy: 20, fngSell: 80,
    sl: 0.04, tp: 0.06, posSize: 0.15, leverage: 5, minScore: 2
}, 'COMBINED V2 (EMA 12/21)');
