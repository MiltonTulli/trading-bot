import { runBreakoutEngine } from './breakout-engine.js';

const s = await runBreakoutEngine();
console.log(`[${s.time}] ${s.action} | Price: $${s.price} | Bal: $${s.balance} | Pos: ${s.position} | W:${s.stats.wins} L:${s.stats.losses} PnL:$${s.stats.totalPnL}`);
