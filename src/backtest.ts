#!/usr/bin/env bun
/**
 * Breakout Strategy Backtester
 *
 * Runs the winning Breakout #2 strategy:
 *   lookback=10, volMult=2.0, SL=3%, TP=6%, posSize=20%, leverage=5x
 *
 * Usage:
 *   bun run backtest           → Full backtest + period breakdown
 *   bun run backtest -- monthly → Month-by-month breakdown
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { BacktestCandle, BacktestResult, BacktestPeriodResult, BacktestDataset, StrategyParams } from './types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'backtest');

// ─── Winning strategy params ───────────────────────────────────────
const STRATEGY: StrategyParams = {
  lookback: 10,
  volMult: 2.0,
  sl: 0.03,
  tp: 0.06,
  posSize: 0.2,
  leverage: 5,
  fees: 0.001,
};

const INITIAL_BALANCE = 10000;

// ─── Data loading ──────────────────────────────────────────────────

interface RawCandleData {
  candles: Array<{
    openTime: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

function loadCandles(file: string): BacktestCandle[] {
  const raw: RawCandleData = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'));
  return raw.candles.map((c) => ({
    t: new Date(c.openTime).getTime(),
    o: c.open,
    h: c.high,
    l: c.low,
    c: c.close,
    v: c.volume,
    date: typeof c.openTime === 'string' ? c.openTime : new Date(c.openTime).toISOString(),
  }));
}

// ─── Breakout signal ───────────────────────────────────────────────

function breakoutSignal(candles: BacktestCandle[], i: number, params: StrategyParams): 0 | 1 | -1 {
  const { lookback, volMult } = params;
  if (i < lookback + 1) return 0;

  let hi = -Infinity, lo = Infinity, avgVol = 0;
  for (let j = i - lookback; j < i; j++) {
    if (candles[j].h > hi) hi = candles[j].h;
    if (candles[j].l < lo) lo = candles[j].l;
    avgVol += candles[j].v;
  }
  avgVol /= lookback;

  if (candles[i].v < avgVol * volMult) return 0;

  if (candles[i].c > hi) return 1;
  if (candles[i].c < lo) return -1;
  return 0;
}

// ─── Trade engine ──────────────────────────────────────────────────

interface BacktestPosition {
  side: 1 | -1;
  entry: number;
  size: number;
}

function runTrades(candles: BacktestCandle[], params: StrategyParams = STRATEGY): BacktestResult {
  const { sl, tp, posSize, leverage } = params;
  let balance = INITIAL_BALANCE;
  let pos: BacktestPosition | null = null;
  let trades = 0, wins = 0, maxBal = INITIAL_BALANCE, maxDD = 0;
  let grossProfit = 0, grossLoss = 0;

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];

    if (pos) {
      let pnl = 0;
      if (pos.side === 1) {
        const worst = (c.l - pos.entry) / pos.entry;
        const best = (c.h - pos.entry) / pos.entry;
        if (worst <= -sl) pnl = -sl * pos.size * leverage;
        else if (best >= tp) pnl = tp * pos.size * leverage;
      } else {
        const worst = (pos.entry - c.h) / pos.entry;
        const best = (pos.entry - c.l) / pos.entry;
        if (worst <= -sl) pnl = -sl * pos.size * leverage;
        else if (best >= tp) pnl = tp * pos.size * leverage;
      }

      if (pnl !== 0) {
        balance += pnl;
        trades++;
        if (pnl > 0) { wins++; grossProfit += pnl; }
        else grossLoss += Math.abs(pnl);
        pos = null;
      }
    }

    if (!pos && balance > 1000) {
      const sig = breakoutSignal(candles, i, params);
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
    const lp = candles[candles.length - 1].c;
    const move = pos.side === 1
      ? (lp - pos.entry) / pos.entry
      : (pos.entry - lp) / pos.entry;
    const pnl = move * pos.size * leverage;
    balance += pnl;
    trades++;
    if (pnl > 0) { wins++; grossProfit += pnl; }
    else grossLoss += Math.abs(pnl);
  }

  return {
    balance: +balance.toFixed(0),
    trades,
    wins,
    winRate: trades > 0 ? +(wins / trades * 100).toFixed(1) : 0,
    returnPct: +((balance - INITIAL_BALANCE) / INITIAL_BALANCE * 100).toFixed(1),
    maxDD: +(maxDD * 100).toFixed(1),
    pf: grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? 99 : 0),
  };
}

// ─── Period backtest ───────────────────────────────────────────────

function runPeriodBacktest(): void {
  const datasets: BacktestDataset[] = [
    { name: 'Bull 2021', file: 'BTCUSDT_4h_bull_2021.json' },
    { name: 'Bear 2022', file: 'BTCUSDT_4h_bear_2022.json' },
    { name: 'Recovery 2023', file: 'BTCUSDT_4h_recovery_2023.json' },
    { name: 'Recent 6m', file: 'BTCUSDT_4h_historical.json' },
    { name: 'Full (2021-2026)', file: 'BTCUSDT_4h_full.json' },
  ];

  console.log('='.repeat(75));
  console.log('⭐ BREAKOUT #2 BACKTEST | lookback=10 vol×2.0 SL=3% TP=6% 5x lev');
  console.log(`   Start: $${INITIAL_BALANCE.toLocaleString()}`);
  console.log('='.repeat(75));
  console.log('');
  console.log(
    'Period'.padEnd(22) +
    'Trades'.padStart(7) +
    'WR%'.padStart(7) +
    'Return'.padStart(9) +
    'Final$'.padStart(10) +
    'MaxDD'.padStart(8) +
    'PF'.padStart(7)
  );
  console.log('-'.repeat(70));

  const results: BacktestPeriodResult[] = [];
  for (const ds of datasets) {
    try {
      const candles = loadCandles(ds.file);
      const r = runTrades(candles);
      results.push({ ...r, name: ds.name });

      console.log(
        ds.name.padEnd(22) +
        String(r.trades).padStart(7) +
        (r.winRate + '%').padStart(7) +
        (r.returnPct + '%').padStart(9) +
        ('$' + r.balance.toLocaleString()).padStart(10) +
        (r.maxDD + '%').padStart(8) +
        String(r.pf).padStart(7)
      );
    } catch (e) {
      console.log(`${ds.name.padEnd(22)} ⚠ ${(e as Error).message}`);
    }
  }

  console.log('-'.repeat(70));
  const avgReturn = results.reduce((s, r) => s + r.returnPct, 0) / results.length;
  console.log(`\n📊 Average return across periods: ${avgReturn.toFixed(1)}%`);
}

// ─── Monthly backtest ──────────────────────────────────────────────

function runMonthlyBacktest(): void {
  const candles = loadCandles('BTCUSDT_4h_full.json');

  const months: Record<string, BacktestCandle[]> = {};
  for (const c of candles) {
    const ym = c.date.slice(0, 7);
    if (!months[ym]) months[ym] = [];
    months[ym].push(c);
  }

  const sortedMonths = Object.keys(months).sort();
  const WARMUP = 200;

  console.log('='.repeat(72));
  console.log('⭐ MONTHLY BACKTEST | Breakout #2 | BTC 4h | Jan 2021 → Feb 2026');
  console.log(`   $${INITIAL_BALANCE.toLocaleString()} per month (independent) + compound tracking`);
  console.log('='.repeat(72));
  console.log('');
  console.log(
    'Month'.padEnd(10) +
    'BTC Price'.padStart(10) +
    'Trades'.padStart(8) +
    'WR%'.padStart(7) +
    'Return'.padStart(9) +
    'Final$'.padStart(9) +
    'MaxDD'.padStart(8) +
    'PF'.padStart(7)
  );
  console.log('-'.repeat(68));

  let totalReturn = 0, monthCount = 0, posMonths = 0, negMonths = 0;
  let bestMonth = -Infinity, worstMonth = Infinity;
  let compoundBal = INITIAL_BALANCE;

  for (const ym of sortedMonths) {
    const monthStart = candles.findIndex((c) => c.date.startsWith(ym));
    if (monthStart < 0) continue;
    let monthEnd = candles.findIndex((c, idx) => idx > monthStart && !c.date.startsWith(ym));
    if (monthEnd < 0) monthEnd = candles.length;

    const warmupStart = Math.max(0, monthStart - WARMUP);
    const slice = candles.slice(warmupStart, monthEnd);
    if (slice.length < WARMUP + 10) continue;

    const r = runTrades(slice);
    const ret = r.returnPct;
    const btcPrice = months[ym][months[ym].length - 1].c;

    console.log(
      ym.padEnd(10) +
      ('$' + btcPrice.toFixed(0)).padStart(10) +
      String(r.trades).padStart(8) +
      (r.trades > 0 ? r.winRate + '%' : '-').padStart(7) +
      (ret + '%').padStart(9) +
      ('$' + r.balance).padStart(9) +
      (r.maxDD + '%').padStart(8) +
      String(r.pf).padStart(7)
    );

    totalReturn += ret;
    monthCount++;
    if (ret > 0) posMonths++;
    if (ret < 0) negMonths++;
    if (ret > bestMonth) bestMonth = ret;
    if (ret < worstMonth) worstMonth = ret;
    compoundBal *= (1 + ret / 100);
  }

  console.log('-'.repeat(68));
  console.log(`📊 ${monthCount} months | ✅ ${posMonths} positive | ❌ ${negMonths} negative`);
  console.log(`   Avg monthly: ${(totalReturn / monthCount).toFixed(1)}% | Best: +${bestMonth.toFixed(1)}% | Worst: ${worstMonth.toFixed(1)}%`);
  console.log(`   Compound final: $${compoundBal.toFixed(0)} (${((compoundBal - INITIAL_BALANCE) / 100).toFixed(1)}%)`);
  console.log(`   Win ratio months: ${(posMonths / monthCount * 100).toFixed(0)}%`);
}

// ─── CLI entry point ───────────────────────────────────────────────

const mode = process.argv[2] || 'full';

if (mode === 'monthly') {
  runMonthlyBacktest();
} else {
  runPeriodBacktest();
  console.log('');
  runMonthlyBacktest();
}
