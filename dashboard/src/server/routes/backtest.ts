import { Hono } from 'hono'
import { readFileSync } from 'fs'
import { join } from 'path'

const backtest = new Hono()

const DATA_DIR = join(process.cwd(), '..', 'data', 'backtest')

// ─── Types ─────────────────────────────────────────────────────────
interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }
interface RawCandle { openTime: string | number; open: number; high: number; low: number; close: number; volume: number }
interface Position { side: 1 | -1; entry: number; size: number }
interface StrategyParams { lookback: number; volMult: number; sl: number; tp: number; posSize: number; leverage: number; fees: number }

// ─── Load candles ──────────────────────────────────────────────────
function loadCandles(file: string): Candle[] {
  const raw: { candles: RawCandle[] } = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'))
  return raw.candles.map(c => ({
    t: new Date(c.openTime).getTime(),
    o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume,
  }))
}

// ─── Breakout signal ───────────────────────────────────────────────
function breakoutSignal(candles: Candle[], i: number, params: StrategyParams): 0 | 1 | -1 {
  const { lookback, volMult } = params
  if (i < lookback + 1) return 0
  let hi = -Infinity, lo = Infinity, avgVol = 0
  for (let j = i - lookback; j < i; j++) {
    if (candles[j].h > hi) hi = candles[j].h
    if (candles[j].l < lo) lo = candles[j].l
    avgVol += candles[j].v
  }
  avgVol /= lookback
  if (candles[i].v < avgVol * volMult) return 0
  if (candles[i].c > hi) return 1
  if (candles[i].c < lo) return -1
  return 0
}

// ─── Trade engine ──────────────────────────────────────────────────
function runBacktest(candles: Candle[], params: StrategyParams) {
  const { sl, tp, posSize, leverage, fees } = params
  const INITIAL = 10000
  let balance = INITIAL
  let pos: Position | null = null
  let trades = 0, wins = 0, maxBal = INITIAL, maxDD = 0
  let grossProfit = 0, grossLoss = 0
  const equity: Array<{ time: string; equity: number; drawdown: number }> = []
  const tradeList: any[] = []
  let peakEquity = INITIAL

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]

    if (pos) {
      let pnl = 0
      if (pos.side === 1) {
        const worst = (c.l - pos.entry) / pos.entry
        const best = (c.h - pos.entry) / pos.entry
        if (worst <= -sl) pnl = -sl * pos.size * leverage
        else if (best >= tp) pnl = tp * pos.size * leverage
      } else {
        const worst = (pos.entry - c.h) / pos.entry
        const best = (pos.entry - c.l) / pos.entry
        if (worst <= -sl) pnl = -sl * pos.size * leverage
        else if (best >= tp) pnl = tp * pos.size * leverage
      }

      if (pnl !== 0) {
        const feeCost = pos.size * fees * 2
        const net = pnl - feeCost
        balance += net
        trades++
        if (net > 0) { wins++; grossProfit += net }
        else { grossLoss += Math.abs(net) }

        tradeList.push({
          id: `bt_${trades}`,
          symbol: 'BTCUSDT',
          direction: pos.side === 1 ? 'LONG' : 'SHORT',
          entryPrice: pos.entry,
          exitPrice: pos.side === 1
            ? (pnl > 0 ? pos.entry * (1 + tp) : pos.entry * (1 - sl))
            : (pnl > 0 ? pos.entry * (1 - tp) : pos.entry * (1 + sl)),
          quantity: pos.size / pos.entry,
          netPnL: net,
          returnPercent: (net / INITIAL) * 100,
          exitReason: pnl > 0 ? 'TP' : 'SL',
          entryTime: new Date(candles[i - 1].t).toISOString(),
          exitTime: new Date(c.t).toISOString(),
        })
        pos = null
      }
    }

    if (!pos) {
      const sig = breakoutSignal(candles, i, params)
      if (sig !== 0) {
        pos = { side: sig, entry: c.c, size: balance * posSize }
      }
    }

    // Record equity every 6 candles (~1 day for 4h)
    if (i % 6 === 0) {
      peakEquity = Math.max(peakEquity, balance)
      equity.push({
        time: new Date(c.t).toISOString(),
        equity: Math.round(balance * 100) / 100,
        drawdown: peakEquity > 0 ? ((peakEquity - balance) / peakEquity) * 100 : 0,
      })
    }

    if (balance > maxBal) maxBal = balance
    const dd = ((maxBal - balance) / maxBal) * 100
    if (dd > maxDD) maxDD = dd
  }

  const totalPnL = balance - INITIAL
  const winRate = trades > 0 ? (wins / trades) * 100 : 0
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0
  const avgWin = wins > 0 ? grossProfit / wins : 0
  const avgLoss = (trades - wins) > 0 ? grossLoss / (trades - wins) : 0

  // Simplified Sharpe
  const returns = equity.map((e, i) => i > 0 ? (e.equity - equity[i - 1].equity) / equity[i - 1].equity : 0).slice(1)
  const meanRet = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0
  const stdRet = returns.length > 1 ? Math.sqrt(returns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / (returns.length - 1)) : 1
  const sharpeRatio = stdRet > 0 ? (meanRet / stdRet) * Math.sqrt(252) : 0

  return {
    equity,
    trades: tradeList,
    stats: {
      totalPnL: Math.round(totalPnL * 100) / 100,
      totalPnLPercent: Math.round((totalPnL / INITIAL) * 10000) / 100,
      winRate: Math.round(winRate * 10) / 10,
      totalTrades: trades,
      maxDrawdown: Math.round(maxDD * 100) / 100,
      winningTrades: wins,
      losingTrades: trades - wins,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    },
    period: {
      start: new Date(candles[0].t).toISOString(),
      end: new Date(candles[candles.length - 1].t).toISOString(),
    },
    params,
  }
}

// ─── API Route ─────────────────────────────────────────────────────
backtest.get('/backtest', async (c) => {
  try {
    // Read params from query string (with defaults = Breakout #2)
    const q = c.req.query()
    const params: StrategyParams = {
      lookback: Number(q.lookback) || 10,
      volMult: Number(q.volMult) || 2.0,
      sl: Number(q.sl) || 0.03,
      tp: Number(q.tp) || 0.06,
      posSize: Number(q.posSize) || 0.2,
      leverage: Number(q.leverage) || 5,
      fees: Number(q.fees) || 0.001,
    }
    const period = q.period || 'full'

    // Load candles based on period
    let candles: Candle[]
    try {
      if (period === 'bull') candles = loadCandles('BTCUSDT_4h_bull_2021.json')
      else if (period === 'bear') candles = loadCandles('BTCUSDT_4h_bear_2022.json')
      else if (period === 'recovery') candles = loadCandles('BTCUSDT_4h_recovery_2023.json')
      else candles = loadCandles('BTCUSDT_4h_full.json')
    } catch {
      return c.json({ error: 'Candle data not found' }, 404)
    }

    const result = runBacktest(candles, params)
    return c.json(result)
  } catch (error) {
    console.error('Backtest error:', error)
    return c.json({ error: 'Failed to run backtest' }, 500)
  }
})

export default backtest
