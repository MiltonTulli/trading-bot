#!/usr/bin/env node
/**
 * V5 - Focus on EMA cross (only strategy positive in bull AND bear)
 * + Optimize params + Add volatility filter
 */
import fs from 'fs';

const PERIODS = [
    { name: 'bull_2021', file: './data/backtest/BTCUSDT_4h_bull_2021.json' },
    { name: 'bear_2022', file: './data/backtest/BTCUSDT_4h_bear_2022.json' },
    { name: 'recovery_23', file: './data/backtest/BTCUSDT_4h_recovery_2023.json' },
    { name: 'recent_6m', file: './data/backtest/BTCUSDT_4h_historical.json' },
];
const DATA = {};
for (const p of PERIODS) DATA[p.name] = JSON.parse(fs.readFileSync(p.file, 'utf8')).candles;

function sma(a,n){if(a.length<n)return null;let s=0;for(let i=a.length-n;i<a.length;i++)s+=a[i];return s/n;}
function ema(a,n){if(a.length<n)return null;const k=2/(n+1);let e=sma(a.slice(0,n),n);for(let i=n;i<a.length;i++)e=a[i]*k+e*(1-k);return e;}
function rsi(c,n=14){if(c.length<n+1)return 50;let g=0,l=0;for(let i=c.length-n;i<c.length;i++){const d=c[i]-c[i-1];if(d>0)g+=d;else l-=d;}if(l===0)return 100;return 100-100/(1+(g/n)/(l/n));}

function run(candles, cfg) {
    const closes = candles.map(c => c.close);
    const FAST = cfg.fast || 9;
    const SLOW = cfg.slow || 21;
    const SL = cfg.sl || 0.03;
    const TP = cfg.tp || 0.06;
    const RISK = cfg.risk || 0.01;
    const TRAIL = cfg.trail !== false;
    const TRAIL_ACT = cfg.trailAct || 0.02;
    const TRAIL_DIST = cfg.trailDist || 0.015;
    const VOL_FILTER = cfg.volFilter || false;
    const RSI_FILTER = cfg.rsiFilter || false;
    const MAX_POS = cfg.maxPos || 1;
    const MAX_COST_PCT = cfg.maxCostPct || 0.33;

    let bal = 10000, peak = 10000, maxDD = 0;
    let positions = [], wins = 0, losses = 0, totP = 0, totL = 0;

    for (let i = Math.max(SLOW + 5, 50); i < candles.length; i++) {
        const price = candles[i].close, hi = candles[i].high, lo = candles[i].low;

        // Trailing
        if (TRAIL) {
            for (const pos of positions) {
                const proft = pos.dir === 'long' ? (hi - pos.entry) / pos.entry : (pos.entry - lo) / pos.entry;
                if (proft >= TRAIL_ACT) {
                    const nsl = pos.dir === 'long' ? hi * (1 - TRAIL_DIST) : lo * (1 + TRAIL_DIST);
                    if (pos.dir === 'long' && nsl > pos.sl) pos.sl = nsl;
                    if (pos.dir === 'short' && nsl < pos.sl) pos.sl = nsl;
                }
            }
        }

        // Exits
        const closed = [];
        for (const pos of positions) {
            let exit = null;
            if (pos.dir === 'long') { if (lo <= pos.sl) exit = pos.sl; else if (hi >= pos.tp) exit = pos.tp; }
            else { if (hi >= pos.sl) exit = pos.sl; else if (lo <= pos.tp) exit = pos.tp; }
            if (exit) {
                const m = pos.dir === 'long' ? 1 : -1;
                const pnl = (exit - pos.entry) * pos.qty * m - (pos.entry + exit) * pos.qty * 0.001;
                bal += pos.cost + pnl;
                if (pnl > 0) { wins++; totP += pnl; } else { losses++; totL += Math.abs(pnl); }
                closed.push(pos.id);
            }
        }
        positions = positions.filter(p => !closed.includes(p.id));

        const eq = bal + positions.reduce((s,p) => s + (price-p.entry)*p.qty*(p.dir==='long'?1:-1), 0);
        if (eq > peak) peak = eq;
        const dd = (peak - eq) / peak;
        if (dd > maxDD) maxDD = dd;

        if (bal < 3000 || positions.length >= MAX_POS) continue;

        // EMA cross signal
        const cl = closes.slice(0, i + 1);
        const clPrev = closes.slice(0, i);
        const fastNow = ema(cl, FAST);
        const slowNow = ema(cl, SLOW);
        const fastPrev = ema(clPrev, FAST);
        const slowPrev = ema(clPrev, SLOW);
        if (!fastNow || !slowNow || !fastPrev || !slowPrev) continue;

        let dir = null;
        if (fastPrev <= slowPrev && fastNow > slowNow) dir = 'long';
        if (fastPrev >= slowPrev && fastNow < slowNow) dir = 'short';
        if (!dir) continue;

        // Volume filter
        if (VOL_FILTER) {
            const vol = candles[i].volume;
            const avgVol = candles.slice(Math.max(0, i-20), i).reduce((s,x) => s + x.volume, 0) / 20;
            if (vol < avgVol * (cfg.volMult || 1.0)) continue;
        }

        // RSI filter: don't go long if already overbought, don't short if oversold
        if (RSI_FILTER) {
            const r = rsi(cl, 14);
            if (dir === 'long' && r > (cfg.rsiMax || 70)) continue;
            if (dir === 'short' && r < (cfg.rsiMin || 30)) continue;
        }

        // Don't open opposing position
        if (positions.some(p => p.dir !== dir)) continue;

        const maxCost = bal * MAX_COST_PCT;
        let qty = (bal * RISK) / (price * SL);
        let cost = qty * price;
        if (cost > maxCost) { qty = maxCost / price; cost = maxCost; }
        if (cost > bal) continue;

        const sl = dir === 'long' ? price * (1 - SL) : price * (1 + SL);
        const tp = dir === 'long' ? price * (1 + TP) : price * (1 - TP);
        bal -= cost;
        positions.push({ id: i, dir, entry: price, qty, sl, tp, cost });
    }

    const lp = candles[candles.length - 1].close;
    for (const p of positions) {
        const pnl = (lp - p.entry) * p.qty * (p.dir === 'long' ? 1 : -1) - (lp + p.entry) * p.qty * 0.001;
        bal += p.cost + pnl;
        if (pnl > 0) wins++; else losses++;
    }

    const t = wins + losses;
    return { trades:t, wins, losses, wr:t>0?+(wins/t*100).toFixed(1):0, ret:+((bal-10000)/100).toFixed(1), final:+bal.toFixed(0), dd:+(maxDD*100).toFixed(1), pf:totL>0?+(totP/totL).toFixed(2):(totP>0?99:0) };
}

function test(label, cfg) {
    console.log(`\n🔬 ${label}`);
    console.log('Period'.padEnd(16)+'Trades'.padStart(7)+'  WR%'.padStart(7)+'  Return'.padStart(9)+'  Final$'.padStart(9)+'  MaxDD'.padStart(8)+'  PF'.padStart(7));
    console.log('-'.repeat(63));
    let sum=0,n=0;
    for (const p of PERIODS) {
        const r = run(DATA[p.name], cfg);
        console.log(p.name.padEnd(16)+String(r.trades).padStart(7)+(r.wr+'%').padStart(7)+(r.ret+'%').padStart(9)+('$'+r.final).padStart(9)+(r.dd+'%').padStart(8)+String(r.pf).padStart(7));
        sum+=r.final; n++;
    }
    const avg=(sum/n).toFixed(0);
    console.log('-'.repeat(63));
    console.log(`AVG: $${avg} (${((avg-10000)/100).toFixed(1)}%) ${avg>12000?'🔥':avg>11000?'✅':avg>10000?'⚠️':'❌'}`);
}

console.log('🚀 V5 - EMA CROSS FOCUSED | Start: $10,000');
console.log('='.repeat(63));

// Vary EMA periods
test('EMA 9/21, SL 3% TP 6% trail', { fast:9, slow:21, sl:0.03, tp:0.06, trail:true });
test('EMA 5/13, SL 2% TP 4% trail (faster)', { fast:5, slow:13, sl:0.02, tp:0.04, trail:true });
test('EMA 12/26 (MACD), SL 3% TP 6% trail', { fast:12, slow:26, sl:0.03, tp:0.06, trail:true });
test('EMA 8/21, SL 2.5% TP 5% trail', { fast:8, slow:21, sl:0.025, tp:0.05, trail:true });
test('EMA 9/21, SL 2% TP 6% trail, vol filter 1.2x', { fast:9, slow:21, sl:0.02, tp:0.06, trail:true, volFilter:true, volMult:1.2 });
test('EMA 9/21, SL 3% TP 9% trail (1:3)', { fast:9, slow:21, sl:0.03, tp:0.09, trail:true });
test('EMA 9/21, SL 2% TP 8% trail (1:4)', { fast:9, slow:21, sl:0.02, tp:0.08, trail:true });
test('EMA 5/13, SL 1.5% TP 4.5% trail (1:3)', { fast:5, slow:13, sl:0.015, tp:0.045, trail:true });
test('EMA 9/21, SL 3% TP 6% NO trail', { fast:9, slow:21, sl:0.03, tp:0.06, trail:false });
test('EMA 9/21, SL 3% TP 6% trail, RSI filter', { fast:9, slow:21, sl:0.03, tp:0.06, trail:true, rsiFilter:true });
test('EMA 9/21, SL 4% TP 8% trail (wider)', { fast:9, slow:21, sl:0.04, tp:0.08, trail:true });
test('EMA 5/13, SL 2% TP 6% trail, vol+RSI', { fast:5, slow:13, sl:0.02, tp:0.06, trail:true, volFilter:true, volMult:1.1, rsiFilter:true });
test('EMA 9/21, SL 3% TP 6% trail, risk 2%', { fast:9, slow:21, sl:0.03, tp:0.06, trail:true, risk:0.02 });
test('EMA 9/21, SL 2% TP 6% trail, maxPos 2', { fast:9, slow:21, sl:0.02, tp:0.06, trail:true, maxPos:2 });
