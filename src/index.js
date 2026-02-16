#!/usr/bin/env node
/**
 * Main Trading Bot Runner
 * Runs the Breakout #2 strategy on a configurable interval
 */

import { runBreakoutEngine } from './breakout-engine.js';

const INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

async function tick() {
  try {
    const result = await runBreakoutEngine();
    const { time, action, price, balance, position, stats, mode } = result;
    console.log(
      `[${time}] ${action} | ${mode} | Price: $${price} | Bal: $${balance} | Pos: ${position} | W:${stats.wins} L:${stats.losses} PnL:$${stats.totalPnL}`
    );
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ERROR:`, err.message);
  }
}

console.log('🚀 Breakout #2 Trading Bot starting...');
console.log(`   Interval: 4h | Strategy: lookback=10, vol×2, SL=3%, TP=6%, 5x lev`);
await tick();
setInterval(tick, INTERVAL_MS);
