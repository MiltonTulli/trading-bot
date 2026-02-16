#!/usr/bin/env bun
/**
 * Test Suite — Breakout #2 Strategy
 * Verifies core components work correctly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): void | Promise<void> {
  const result = fn();
  if (result instanceof Promise) {
    return result.then(
      () => { passed++; console.log(`  ✅ ${name}`); },
      (e: Error) => { failed++; console.log(`  ❌ ${name}: ${e.message}`); }
    );
  }
  try {
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}: ${(e as Error).message}`);
  }
}

function assert(cond: boolean, msg?: string): void {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// ─── Tests ─────────────────────────────────────────────────────────

console.log('🧪 Running tests...\n');

// Wrap in async IIFE to handle async tests
await (async () => {
  // Config
  test('config.json exists and has breakout params', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
    assert(cfg.params.lookback === 10, 'lookback should be 10');
    assert(cfg.params.volMult === 2, 'volMult should be 2');
    assert(cfg.params.sl === 0.03, 'sl should be 0.03');
    assert(cfg.params.tp === 0.06, 'tp should be 0.06');
    assert(cfg.params.leverage === 5, 'leverage should be 5');
  });

  // Breakout engine imports
  await test('breakout-engine.ts imports correctly', async () => {
    const mod = await import('./breakout-engine.ts');
    assert(typeof mod.runBreakoutEngine === 'function', 'runBreakoutEngine should be a function');
    assert(typeof mod.goLive === 'function', 'goLive should be a function');
    assert(typeof mod.goPaper === 'function', 'goPaper should be a function');
  });

  // Data files exist
  test('backtest data exists', () => {
    const f = path.join(__dirname, '..', 'data', 'backtest', 'BTCUSDT_4h_full.json');
    assert(fs.existsSync(f), 'BTCUSDT_4h_full.json should exist');
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert(data.candles.length > 10000, `should have >10k candles, got ${data.candles.length}`);
  });

  // State file
  test('breakout-state.json exists', () => {
    const f = path.join(__dirname, '..', 'data', 'breakout-state.json');
    assert(fs.existsSync(f), 'breakout-state.json should exist');
    const state = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert(typeof state.balance === 'number', 'balance should be a number');
    assert(state.stats, 'stats should exist');
  });

  // No old cruft in src/
  test('no old strategy files in src/', () => {
    assert(!fs.existsSync(path.join(__dirname, 'signals')), 'src/signals/ should not exist');
    assert(!fs.existsSync(path.join(__dirname, 'strategies')), 'src/strategies/ should not exist');
    assert(!fs.existsSync(path.join(__dirname, 'paper')), 'src/paper/ should not exist');
  });

  // Binance API reachable
  await test('Binance API reachable', async () => {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
    const data = await res.json() as { price: string };
    assert(parseFloat(data.price) > 0, 'BTC price should be positive');
  });
})();

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
