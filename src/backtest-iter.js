#!/usr/bin/env node
/**
 * Iterative Backtest Engine - Fast iteration on strategy improvements
 */
import fs from 'fs';
import TechnicalIndicators from './indicators/index.js';
import SignalGenerator from './signals/generator.js';

const PERIODS = [
    { name: 'bull_2021', file: './data/backtest/BTCUSDT_4h_bull_2021.json' },
    { name: 'bear_2022', file: './data/backtest/BTCUSDT_4h_bear_2022.json' },
    { name: 'recovery_2023', file: './data/backtest/BTCUSDT_4h_recovery_2023.json' },
    { name: 'recent_6m', file: './data/backtest/BTCUSDT_4h_historical.json' },
];

// Load all data once
const DATA = {};
for (const p of PERIODS) {
    DATA[p.name] = JSON.parse(fs.readFileSync(p.file, 'utf8')).candles;
}

const ind = new TechnicalIndicators();

export function backtest(cfg) {
    const results = {};
    for (const p of PERIODS) {
        results[p.name] = runPeriod(DATA[p.name], cfg);
    }
    return results;
}

function runPeriod(candles, cfg) {
    const sg = new SignalGenerator({ preset: cfg.preset || 'active', riskPerTrade: cfg.risk || 0.01 });
    let bal = 10000, peak = 10000, maxDD = 0;
    let positions = [], wins = 0, losses = 0, totProfit = 0, totLoss = 0;
    const trailEnabled = cfg.trailingStop || false;
    const trailATR = cfg.trailATRMult || 2;
    const tpMult = cfg.tpMult || 1.5;
    const maxPos = cfg.maxPositions || 3;
    const maxPosPct = cfg.maxPositionPct || 0.15;
    const useRegimeFilter = cfg.regimeFilter || false;
    const stepSize = cfg.stepSize || 4;

    for (let i = 200; i < candles.length; i++) {
        const p = candles[i].close, hi = candles[i].high, lo = candles[i].low;

        // Update trailing stops
        if (trailEnabled) {
            for (const pos of positions) {
                if (pos.dir === 'long') {
                    const newTrail = hi - pos.atr * trailATR;
                    if (newTrail > pos.sl) pos.sl = newTrail;
                } else {
                    const newTrail = lo + pos.atr * trailATR;
                    if (newTrail < pos.sl) pos.sl = newTrail;
                }
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
            // Time-based exit: close after N bars
            if (cfg.maxBars && (i - pos.entryBar) >= cfg.maxBars) {
                exit = p;
            }
            if (exit) {
                const mult = pos.dir === 'long' ? 1 : -1;
                const pnl = (exit - pos.entry) * pos.qty * mult - (pos.entry + exit) * pos.qty * 0.001;
                bal += pos.entry * pos.qty + pnl;
                if (pnl > 0) { wins++; totProfit += pnl; } else { losses++; totLoss += Math.abs(pnl); }
                closed.push(pos.id);
            }
        }
        positions = positions.filter(x => !closed.includes(x.id));

        // Drawdown
        const eq = bal + positions.reduce((s, pos) => s + (p - pos.entry) * pos.qty * (pos.dir === 'long' ? 1 : -1), 0);
        if (eq > peak) peak = eq;
        const dd = (peak - eq) / peak;
        if (dd > maxDD) maxDD = dd;

        // Signals
        if (i % stepSize !== 0 || positions.length >= maxPos || bal < 2000) continue;

        try {
            const window = candles.slice(Math.max(0, i - 500), i + 1);
            const analysis = ind.analyzeMarket(window);
            
            // Extract indicators properly
            const adxVal = analysis.indicators?.adx?.current?.adx || 0;
            const ema21 = analysis.indicators?.emas?.ema21?.current || p;
            const sma50 = analysis.indicators?.smas?.sma50?.current || p;
            const sma200 = analysis.indicators?.smas?.sma200?.current || p;
            const atrVal = analysis.indicators?.atr?.current || (p * 0.02);

            // Regime filter: skip if no clear trend
            if (useRegimeFilter) {
                if (adxVal < cfg.regimeADX && Math.abs(ema21 - sma50) / p < 0.005) continue;
            }

            const signals = sg.generateSignals(analysis, 'BTCUSDT');
            const atr = atrVal;

            for (const s of signals) {
                if (!sg.validateSignal(s) || positions.length >= maxPos) continue;
                
                const dir = s.direction || 'long';
                
                // Trend alignment filter
                if (cfg.trendAlign === true) {
                    const trend = ema21 > sma200 ? 'up' : 'down';
                    if (dir === 'long' && trend === 'down') continue;
                    if (dir === 'short' && trend === 'up') continue;
                } else if (cfg.trendAlign === 'long_only') {
                    // Only filter: no shorts in uptrend, allow longs always
                    const trend = ema21 > sma200 ? 'up' : 'down';
                    if (dir === 'short' && trend === 'up') continue;
                }

                const entry = s.entryPrice || p;
                const slFromSignal = s.stopLoss;
                const stopDist = slFromSignal ? Math.abs(entry - slFromSignal) : atr * trailATR;
                if (stopDist <= 0) continue;

                const riskAmt = bal * (cfg.risk || 0.01);
                const qty = riskAmt / stopDist;
                const cost = qty * entry;
                if (cost > bal * maxPosPct || cost > bal) continue;

                const sl = slFromSignal || (dir === 'long' ? entry - stopDist : entry + stopDist);
                let tp = null;
                if (!cfg.noTP) {
                    tp = dir === 'long' ? entry + stopDist * tpMult : entry - stopDist * tpMult;
                }

                bal -= cost;
                positions.push({ id: i, dir, entry, qty, sl, tp, atr, entryBar: i });
            }
        } catch (e) {}
    }

    // Close remaining
    const lastP = candles[candles.length - 1].close;
    for (const pos of positions) {
        const pnl = (lastP - pos.entry) * pos.qty * (pos.dir === 'long' ? 1 : -1) - (pos.entry + lastP) * pos.qty * 0.001;
        bal += pos.entry * pos.qty + pnl;
        if (pnl > 0) wins++; else losses++;
    }

    const total = wins + losses;
    return {
        trades: total, wins, losses,
        wr: total > 0 ? +(wins / total * 100).toFixed(1) : 0,
        ret: +((bal - 10000) / 100).toFixed(1),  // % return
        final: +bal.toFixed(0),
        dd: +(maxDD * 100).toFixed(1),
        pf: totLoss > 0 ? +(totProfit / totLoss).toFixed(2) : (totProfit > 0 ? 99 : 0),
    };
}

export function printResults(label, results) {
    console.log(`\n🔬 ${label}`);
    console.log('Period'.padEnd(18) + 'Trades'.padStart(7) + '  WR%'.padStart(7) + '  Return'.padStart(9) + '  Final$'.padStart(9) + '  MaxDD'.padStart(8) + '  PF'.padStart(7));
    console.log('-'.repeat(65));
    let totalFinal = 0, periods = 0;
    for (const [name, r] of Object.entries(results)) {
        console.log(
            name.padEnd(18) +
            String(r.trades).padStart(7) +
            (r.wr + '%').padStart(7) +
            (r.ret + '%').padStart(9) +
            ('$' + r.final).padStart(9) +
            (r.dd + '%').padStart(8) +
            String(r.pf).padStart(7)
        );
        totalFinal += r.final;
        periods++;
    }
    const avg = (totalFinal / periods).toFixed(0);
    console.log('-'.repeat(65));
    console.log(`Promedio final: $${avg} (${((avg - 10000) / 100).toFixed(1)}%)`);
}

// If run directly, do iterations
if (import.meta.url === `file://${process.argv[1]}`) {
    const configs = JSON.parse(process.argv[2] || '{}');
    const r = backtest(configs);
    printResults(configs._label || 'Test', r);
}
