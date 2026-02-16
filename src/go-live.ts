#!/usr/bin/env bun
/**
 * Switch to live trading on Binance Futures
 * Usage: bun run src/go-live.ts <API_KEY> <API_SECRET>
 * To go back to paper: bun run src/go-live.ts --paper
 */
import { goLive, goPaper } from './breakout-engine.ts';

const args = process.argv.slice(2);

if (args[0] === '--paper') {
  const r = await goPaper();
  console.log('✅ Switched to PAPER trading:', r);
} else if (args.length === 2) {
  try {
    const r = await goLive(args[0], args[1]);
    console.log('✅ Switched to LIVE trading:', r);
    console.log('⚠️  USDT Balance:', r.usdtBalance);
    console.log('⚠️  The bot will now execute REAL trades on Binance Futures!');
  } catch (e) {
    console.error('❌ Failed to connect to Binance:', (e as Error).message);
    console.log('Reverting to paper mode...');
    await goPaper();
  }
} else {
  console.log('Usage:');
  console.log('  Go live:  bun run src/go-live.ts <BINANCE_API_KEY> <BINANCE_API_SECRET>');
  console.log('  Go paper: bun run src/go-live.ts --paper');
  console.log('');
  console.log('Requirements for Binance API Key:');
  console.log('  - Enable Futures Trading');
  console.log('  - Restrict to IP if possible');
  console.log('  - Only needs trading permission (no withdraw)');
}
