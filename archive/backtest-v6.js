#!/usr/bin/env node
/**
 * V6 - Optimize around EMA cross + vol filter (first all-period positive strategy)
 * Also try: combining EMA cross with RSI mean reversion as independent systems
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
function bbands(c,n=20){if(c.length<n)return null;const m=sma(c,n);let v=0;for(let i=c.length-n;i<c.length;i++)v+=(c[i]-m)**2;const s=Math.sqrt(v/n);return{upper:m+2*s,lower:m-2*s};}

function run(candles, cfg) {
    const closes = candles.map(c => c.close);
    const SL = cfg.sl || 0.02; const TP = cfg.tp || 0.06;
    const RISK = cfg.risk || 0.01; const MAX_POS = cfg.maxPos || 2;
    const TRAIL = cfg.trail !== false;
    const TRAIL_ACT = cfg.trailAct || 0.02;
    const TRAIL_DIST = cfg.trailDist || 0.015;

    let bal = 10000, peak = 10000, maxDD = 0;
    let positions = [], wins = 0, losses = 0, totP = 0, totL = 0;

    for (let i = 50; i < candles.length; i++) {
        const price = candles[i].close, hi = candles[i].high, lo = candles[i].low;

        if (TRAIL) {
            for (const pos of positions) {
                const prof = pos.dir==='long'?(hi-pos.entry)/pos.entry:(pos.entry-lo)/pos.entry;
                if (prof >= TRAIL_ACT) {
                    const nsl = pos.dir==='long'?hi*(1-TRAIL_DIST):lo*(1+TRAIL_DIST);
                    if (pos.dir==='long'&&nsl>pos.sl) pos.sl=nsl;
                    if (pos.dir==='short'&&nsl<pos.sl) pos.sl=nsl;
                }
            }
        }

        const closed = [];
        for (const pos of positions) {
            let exit=null;
            if(pos.dir==='long'){if(lo<=pos.sl)exit=pos.sl;else if(hi>=pos.tp)exit=pos.tp;}
            else{if(hi>=pos.sl)exit=pos.sl;else if(lo<=pos.tp)exit=pos.tp;}
            if(exit){
                const m=pos.dir==='long'?1:-1;
                const pnl=(exit-pos.entry)*pos.qty*m-(pos.entry+exit)*pos.qty*0.001;
                bal+=pos.cost+pnl;
                if(pnl>0){wins++;totP+=pnl;}else{losses++;totL+=Math.abs(pnl);}
                closed.push(pos.id);
            }
        }
        positions=positions.filter(p=>!closed.includes(p.id));

        const eq=bal+positions.reduce((s,p)=>s+(price-p.entry)*p.qty*(p.dir==='long'?1:-1),0);
        if(eq>peak)peak=eq; const dd=(peak-eq)/peak; if(dd>maxDD)maxDD=dd;
        if(bal<3000||positions.length>=MAX_POS) continue;

        const cl = closes.slice(0, i+1);
        const clP = closes.slice(0, i);
        const signals = [];

        // SYSTEM 1: EMA Cross with volume
        if (cfg.useEMA !== false) {
            const fast = cfg.fast || 9, slow = cfg.slow || 21;
            const fN = ema(cl, fast), sN = ema(cl, slow);
            const fP = ema(clP, fast), sP = ema(clP, slow);
            if (fN && sN && fP && sP) {
                const vol = candles[i].volume;
                const avgVol = candles.slice(Math.max(0,i-20),i).reduce((s,x)=>s+x.volume,0)/20;
                const volOK = !cfg.volFilter || vol >= avgVol * (cfg.volMult || 1.2);
                if (fP <= sP && fN > sN && volOK) signals.push({ dir: 'long', sys: 'ema' });
                if (fP >= sP && fN < sN && volOK) signals.push({ dir: 'short', sys: 'ema' });
            }
        }

        // SYSTEM 2: RSI extreme bounce (mean reversion)
        if (cfg.useRSI !== false) {
            const r = rsi(cl, 14);
            if (r < (cfg.rsiBuy || 30)) signals.push({ dir: 'long', sys: 'rsi' });
            if (r > (cfg.rsiSell || 70)) signals.push({ dir: 'short', sys: 'rsi' });
        }

        // SYSTEM 3: Bollinger Bounce
        if (cfg.useBB !== false) {
            const bb = bbands(cl, 20);
            const r = rsi(cl, 14);
            if (bb && price < bb.lower && r < 40) signals.push({ dir: 'long', sys: 'bb' });
            if (bb && price > bb.upper && r > 60) signals.push({ dir: 'short', sys: 'bb' });
        }

        const hasLong = positions.some(p => p.dir === 'long');
        const hasShort = positions.some(p => p.dir === 'short');

        for (const sig of signals) {
            if (positions.length >= MAX_POS) break;
            if (sig.dir === 'long' && hasShort) continue;
            if (sig.dir === 'short' && hasLong) continue;
            if (positions.some(p => p.sys === sig.sys)) continue; // one per system

            const maxCost = bal * (cfg.maxCostPct || 0.33);
            let qty = (bal * RISK) / (price * SL);
            let cost = qty * price;
            if (cost > maxCost) { qty = maxCost / price; cost = maxCost; }
            if (cost > bal) continue;

            const sl = sig.dir==='long'?price*(1-SL):price*(1+SL);
            const tp = sig.dir==='long'?price*(1+TP):price*(1-TP);
            bal -= cost;
            positions.push({ id: `${i}_${sig.sys}`, dir: sig.dir, entry: price, qty, sl, tp, cost, sys: sig.sys });
        }
    }

    const lp = candles[candles.length-1].close;
    for (const p of positions) {
        const pnl = (lp-p.entry)*p.qty*(p.dir==='long'?1:-1)-(lp+p.entry)*p.qty*0.001;
        bal += p.cost + pnl;
        if(pnl>0)wins++;else losses++;
    }
    const t=wins+losses;
    return{trades:t,wins,losses,wr:t>0?+(wins/t*100).toFixed(1):0,ret:+((bal-10000)/100).toFixed(1),final:+bal.toFixed(0),dd:+(maxDD*100).toFixed(1),pf:totL>0?+(totP/totL).toFixed(2):(totP>0?99:0)};
}

function test(label, cfg) {
    console.log(`\n🔬 ${label}`);
    console.log('Period'.padEnd(16)+'Trades'.padStart(7)+'  WR%'.padStart(7)+'  Return'.padStart(9)+'  Final$'.padStart(9)+'  MaxDD'.padStart(8)+'  PF'.padStart(7));
    console.log('-'.repeat(63));
    let sum=0,n=0,allPos=true;
    for (const p of PERIODS) {
        const r = run(DATA[p.name], cfg);
        const mark = r.final >= 10000 ? '✅' : '❌';
        console.log(p.name.padEnd(16)+String(r.trades).padStart(7)+(r.wr+'%').padStart(7)+(r.ret+'%').padStart(9)+('$'+r.final).padStart(9)+(r.dd+'%').padStart(8)+String(r.pf).padStart(7)+' '+mark);
        sum+=r.final; n++; if(r.final<10000)allPos=false;
    }
    const avg=(sum/n).toFixed(0);
    console.log('-'.repeat(63));
    console.log(`AVG: $${avg} (${((avg-10000)/100).toFixed(1)}%) ${allPos?'🟢 ALL POSITIVE':avg>10000?'⚠️':'❌'}`);
}

console.log('🚀 V6 - MULTI-SYSTEM | Start: $10,000');
console.log('='.repeat(63));

// A: Pure EMA cross + vol filter variants
test('A1: EMA 9/21 vol 1.2x, SL 2% TP 6%', { useRSI:false, useBB:false, sl:0.02, tp:0.06, volFilter:true, volMult:1.2 });
test('A2: EMA 9/21 vol 1.0x, SL 2% TP 6%', { useRSI:false, useBB:false, sl:0.02, tp:0.06, volFilter:true, volMult:1.0 });
test('A3: EMA 9/21 vol 1.2x, SL 2% TP 6%, risk 2%', { useRSI:false, useBB:false, sl:0.02, tp:0.06, volFilter:true, volMult:1.2, risk:0.02 });
test('A4: EMA 9/21 vol 1.2x, SL 2% TP 6%, maxPos 2', { useRSI:false, useBB:false, sl:0.02, tp:0.06, volFilter:true, volMult:1.2, maxPos:2 });

// B: EMA + RSI combo
test('B1: EMA vol + RSI, SL 2% TP 6%, maxPos 2', { useBB:false, sl:0.02, tp:0.06, volFilter:true, volMult:1.2, maxPos:2 });
test('B2: EMA vol + RSI, SL 2% TP 4%, maxPos 2', { useBB:false, sl:0.02, tp:0.04, volFilter:true, volMult:1.2, maxPos:2 });
test('B3: EMA vol + RSI, SL 3% TP 6%, maxPos 2', { useBB:false, sl:0.03, tp:0.06, volFilter:true, volMult:1.2, maxPos:2 });

// C: All 3 systems
test('C1: EMA+RSI+BB, SL 2% TP 6%, maxPos 3', { sl:0.02, tp:0.06, volFilter:true, volMult:1.2, maxPos:3 });
test('C2: EMA+RSI+BB, SL 2% TP 4%, maxPos 3', { sl:0.02, tp:0.04, volFilter:true, volMult:1.2, maxPos:3 });
test('C3: EMA+RSI+BB, SL 2% TP 6%, maxPos 3, risk 1.5%', { sl:0.02, tp:0.06, volFilter:true, volMult:1.2, maxPos:3, risk:0.015 });

// D: Aggressive combos
test('D1: EMA+RSI+BB, SL 2% TP 6%, maxPos 4, risk 2%', { sl:0.02, tp:0.06, volFilter:true, volMult:1.2, maxPos:4, risk:0.02 });
test('D2: EMA+RSI+BB, SL 1.5% TP 4.5%, maxPos 3, risk 1.5%', { sl:0.015, tp:0.045, volFilter:true, volMult:1.2, maxPos:3, risk:0.015 });
test('D3: EMA(no vol)+RSI+BB, SL 2% TP 6%, maxPos 3', { sl:0.02, tp:0.06, volFilter:false, maxPos:3 });
