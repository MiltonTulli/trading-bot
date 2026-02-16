#!/usr/bin/env node
/**
 * Backtest V4 - Percentage-based stops, multiple timeframes, simpler strategies
 * Target: >20% return to beat bonds
 */
import fs from 'fs';

// Use 4h data (available for all periods) + try 1h for recent
const PERIODS_4H = [
    { name: 'bull_2021', file: './data/backtest/BTCUSDT_4h_bull_2021.json' },
    { name: 'bear_2022', file: './data/backtest/BTCUSDT_4h_bear_2022.json' },
    { name: 'recovery_2023', file: './data/backtest/BTCUSDT_4h_recovery_2023.json' },
    { name: 'recent_6m', file: './data/backtest/BTCUSDT_4h_historical.json' },
];

const PERIODS_1H = [
    { name: 'recent_6m_1h', file: './data/backtest/BTCUSDT_1h_historical.json' },
];

const DATA = {};
for (const p of [...PERIODS_4H, ...PERIODS_1H]) {
    try { DATA[p.name] = JSON.parse(fs.readFileSync(p.file, 'utf8')).candles; } catch(e) {}
}

function sma(arr, n) { if (arr.length < n) return null; let s=0; for(let i=arr.length-n;i<arr.length;i++) s+=arr[i]; return s/n; }
function ema(arr, n) { if(arr.length<n) return null; const k=2/(n+1); let e=sma(arr.slice(0,n),n); for(let i=n;i<arr.length;i++) e=arr[i]*k+e*(1-k); return e; }
function rsi(c,n=14) { if(c.length<n+1)return 50; let g=0,l=0; for(let i=c.length-n;i<c.length;i++){const d=c[i]-c[i-1]; if(d>0)g+=d;else l-=d;} if(l===0)return 100; return 100-100/(1+(g/n)/(l/n)); }
function bbands(c,n=20) { if(c.length<n)return null; const m=sma(c,n); let v=0; for(let i=c.length-n;i<c.length;i++) v+=(c[i]-m)**2; const s=Math.sqrt(v/n); return {upper:m+2*s,mid:m,lower:m-2*s,pb:(c[c.length-1]-(m-2*s))/(4*s)}; }

function runPeriod(candles, cfg) {
    const closes = candles.map(c => c.close);
    let bal = 10000, peak = 10000, maxDD = 0;
    let positions = [], wins = 0, losses = 0, totProfit = 0, totLoss = 0;
    const SL = cfg.slPct || 0.02;   // stop loss % from entry
    const TP = cfg.tpPct || 0.04;   // take profit % from entry
    const RISK = cfg.risk || 0.01;
    const MAX_POS = cfg.maxPos || 3;
    const TRAIL = cfg.trail || false; // trail by moving SL up
    const TRAIL_ACTIVATE = cfg.trailActivate || 0.015; // activate trail after 1.5% profit
    const TRAIL_DIST = cfg.trailDist || 0.01; // trail distance as %
    const STEP = cfg.step || 1;

    for (let i = 50; i < candles.length; i++) {
        const price = candles[i].close;
        const hi = candles[i].high;
        const lo = candles[i].low;

        // Update trailing stops
        if (TRAIL) {
            for (const pos of positions) {
                if (pos.dir === 'long') {
                    const profit = (hi - pos.entry) / pos.entry;
                    if (profit >= TRAIL_ACTIVATE) {
                        const newSL = hi * (1 - TRAIL_DIST);
                        if (newSL > pos.sl) pos.sl = newSL;
                    }
                } else {
                    const profit = (pos.entry - lo) / pos.entry;
                    if (profit >= TRAIL_ACTIVATE) {
                        const newSL = lo * (1 + TRAIL_DIST);
                        if (newSL < pos.sl) pos.sl = newSL;
                    }
                }
            }
        }

        // Check exits
        const closed = [];
        for (const pos of positions) {
            let exit = null;
            if (pos.dir === 'long') {
                if (lo <= pos.sl) exit = pos.sl;
                else if (hi >= pos.tp) exit = pos.tp;
            } else {
                if (hi >= pos.sl) exit = pos.sl;
                else if (lo <= pos.tp) exit = pos.tp;
            }
            if (exit) {
                const mult = pos.dir === 'long' ? 1 : -1;
                const pnl = (exit - pos.entry) * pos.qty * mult - (pos.entry + exit) * pos.qty * 0.001;
                bal += pos.cost + pnl;
                if (pnl > 0) { wins++; totProfit += pnl; }
                else { losses++; totLoss += Math.abs(pnl); }
                closed.push(pos.id);
            }
        }
        positions = positions.filter(p => !closed.includes(p.id));

        // Drawdown
        const eq = bal + positions.reduce((s, p) => s + (price - p.entry) * p.qty * (p.dir==='long'?1:-1), 0);
        if (eq > peak) peak = eq;
        const dd = (peak - eq) / peak;
        if (dd > maxDD) maxDD = dd;

        if (bal < 5000 || i % STEP !== 0 || positions.length >= MAX_POS) continue;

        // ============ SIGNAL GENERATION ============
        const c = closes.slice(0, i+1);
        const r = rsi(c, 14);
        const r7 = rsi(c, 7); // faster RSI
        const bb = bbands(c, 20);
        const ema9 = ema(c, 9);
        const ema21 = ema(c, 21);
        const sma50v = sma(c, 50);
        const vol = candles[i].volume;
        const avgVol = candles.slice(Math.max(0,i-20), i).reduce((s,x)=>s+x.volume,0) / Math.min(20, i);
        
        const signals = [];
        
        // --- STRATEGY: RSI Mean Reversion ---
        if (cfg.useRSI !== false) {
            if (r < 30) signals.push({ dir: 'long', str: 0.7 + (30-r)/100 });
            if (r > 70) signals.push({ dir: 'short', str: 0.7 + (r-70)/100 });
            if (r7 < 20) signals.push({ dir: 'long', str: 0.8 });
            if (r7 > 80) signals.push({ dir: 'short', str: 0.8 });
        }
        
        // --- STRATEGY: Bollinger Bounce ---
        if (cfg.useBB !== false && bb) {
            if (price < bb.lower && r < 40) signals.push({ dir: 'long', str: 0.7 });
            if (price > bb.upper && r > 60) signals.push({ dir: 'short', str: 0.7 });
        }
        
        // --- STRATEGY: EMA Cross Momentum ---
        if (cfg.useEMA !== false && ema9 && ema21 && i > 1) {
            const prevEma9 = ema(closes.slice(0, i), 9);
            const prevEma21 = ema(closes.slice(0, i), 21);
            if (prevEma9 <= prevEma21 && ema9 > ema21) {
                signals.push({ dir: 'long', str: 0.6 + (vol > avgVol * 1.2 ? 0.2 : 0) });
            }
            if (prevEma9 >= prevEma21 && ema9 < ema21) {
                signals.push({ dir: 'short', str: 0.6 + (vol > avgVol * 1.2 ? 0.2 : 0) });
            }
        }
        
        // --- STRATEGY: Support/Resistance Bounce ---
        if (cfg.useSR !== false && i > 30) {
            const last30 = candles.slice(i-30, i);
            const support = Math.min(...last30.map(x => x.low));
            const resist = Math.max(...last30.map(x => x.high));
            const range = resist - support;
            if (range / price > 0.02 && range / price < 0.15) {
                if (price < support + range * 0.15 && r < 45) signals.push({ dir: 'long', str: 0.6 });
                if (price > resist - range * 0.15 && r > 55) signals.push({ dir: 'short', str: 0.6 });
            }
        }

        // Pick best signal
        if (signals.length === 0) continue;
        signals.sort((a,b) => b.str - a.str);
        const best = signals[0];
        if (best.str < (cfg.minStr || 0.3)) continue;
        
        // Don't open opposing positions
        if (positions.some(p => p.dir !== best.dir)) continue;

        // Position size: risk amount / stop distance, capped at maxPosPct of balance
        const maxCost = bal * (cfg.maxPosPct || 0.33);
        const riskAmt = bal * RISK;
        let qty = riskAmt / (price * SL);
        let cost = qty * price;
        if (cost > maxCost) { qty = maxCost / price; cost = maxCost; }
        if (cost > bal) continue;

        const sl = best.dir === 'long' ? price * (1 - SL) : price * (1 + SL);
        const tp = best.dir === 'long' ? price * (1 + TP) : price * (1 - TP);

        bal -= cost;
        positions.push({ id: i, dir: best.dir, entry: price, qty, sl, tp, cost });
    }

    // Close remaining
    const lp = candles[candles.length-1].close;
    for (const p of positions) {
        const pnl = (lp-p.entry)*p.qty*(p.dir==='long'?1:-1)-(p.entry+lp)*p.qty*0.001;
        bal += p.cost + pnl;
        if(pnl>0) wins++; else losses++;
    }

    const t = wins+losses;
    return { trades:t, wins, losses, wr:t>0?+(wins/t*100).toFixed(1):0, ret:+((bal-10000)/100).toFixed(1), final:+bal.toFixed(0), dd:+(maxDD*100).toFixed(1), pf:totLoss>0?+(totProfit/totLoss).toFixed(2):(totProfit>0?99:0) };
}

function test(label, cfg, periods) {
    console.log(`\n🔬 ${label}`);
    console.log('Period'.padEnd(20)+'Trades'.padStart(7)+'  WR%'.padStart(7)+'  Return'.padStart(9)+'  Final$'.padStart(9)+'  MaxDD'.padStart(8)+'  PF'.padStart(7));
    console.log('-'.repeat(67));
    let sum=0,n=0;
    for (const p of periods) {
        if (!DATA[p.name]) continue;
        const r = runPeriod(DATA[p.name], cfg);
        console.log(p.name.padEnd(20)+String(r.trades).padStart(7)+(r.wr+'%').padStart(7)+(r.ret+'%').padStart(9)+('$'+r.final).padStart(9)+(r.dd+'%').padStart(8)+String(r.pf).padStart(7));
        sum+=r.final; n++;
    }
    const avg=(sum/n).toFixed(0);
    console.log('-'.repeat(67));
    console.log(`Promedio: $${avg} (${((avg-10000)/100).toFixed(1)}%) ${avg>12000?'🔥':avg>10500?'✅':avg>10000?'⚠️':'❌'}`);
}

const P4 = PERIODS_4H;
const ALL = [...PERIODS_4H, ...PERIODS_1H];

console.log('🚀 V4 - PERCENTAGE STOPS | Start: $10,000');
console.log('='.repeat(67));

// Test on 4h
test('SL 2% TP 4% trail, risk 1%', { slPct:0.02, tpPct:0.04, risk:0.01, trail:true, maxPos:3 }, P4);
test('SL 1.5% TP 3% trail, risk 1%', { slPct:0.015, tpPct:0.03, risk:0.01, trail:true, maxPos:3 }, P4);
test('SL 1% TP 3% trail, risk 1% (tight stops)', { slPct:0.01, tpPct:0.03, risk:0.01, trail:true, maxPos:3 }, P4);
test('SL 2% TP 6% trail, risk 1% (big winners)', { slPct:0.02, tpPct:0.06, risk:0.01, trail:true, maxPos:3 }, P4);
test('SL 3% TP 6% no trail, risk 1%', { slPct:0.03, tpPct:0.06, risk:0.01, trail:false, maxPos:3 }, P4);
test('SL 2% TP 4% trail, risk 2%, maxPos 2', { slPct:0.02, tpPct:0.04, risk:0.02, trail:true, maxPos:2 }, P4);
test('SL 1.5% TP 4.5% trail (1:3 RR), risk 1%', { slPct:0.015, tpPct:0.045, risk:0.01, trail:true, maxPos:3 }, P4);
test('Only RSI + BB, SL 2% TP 4% trail', { slPct:0.02, tpPct:0.04, risk:0.01, trail:true, maxPos:3, useEMA:false, useSR:false }, P4);
test('Only EMA cross, SL 2% TP 6% trail', { slPct:0.02, tpPct:0.06, risk:0.01, trail:true, maxPos:2, useRSI:false, useBB:false, useSR:false }, P4);

// Test on 1h for recent
test('SL 1% TP 3% trail, risk 1% — 1H CANDLES', { slPct:0.01, tpPct:0.03, risk:0.01, trail:true, maxPos:3 }, PERIODS_1H);
test('SL 1.5% TP 3% trail, risk 1% — 1H', { slPct:0.015, tpPct:0.03, risk:0.01, trail:true, maxPos:3 }, PERIODS_1H);
test('SL 2% TP 4% trail, risk 1% — 1H', { slPct:0.02, tpPct:0.04, risk:0.01, trail:true, maxPos:3 }, PERIODS_1H);
