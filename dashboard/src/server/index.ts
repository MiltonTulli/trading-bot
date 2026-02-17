import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '..', '..', '..', 'data', 'backtest', 'BTCUSDT_4h_full.json')

// Load candles once at startup
console.log('📊 Loading candle data...')
const rawData = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
const rawCandles: number[][] = rawData.candles.map((c: any) => [
  new Date(c.openTime).getTime(), c.open, c.high, c.low, c.close, c.volume
])
console.log(`✅ Loaded ${rawCandles.length} candles`)

interface SimParams {
  startDate?: string
  endDate?: string
  lookback?: number
  volMult?: number
  sl?: number
  tp?: number
  posSize?: number
  leverage?: number
  initialBalance?: number
  fee?: number
}

interface Position {
  side: 1 | -1
  entry: number
  size: number
  entryTime: number
  entryIdx: number
}

interface TradeResult {
  id: number
  side: 'LONG' | 'SHORT'
  entryPrice: number
  exitPrice: number
  entryTime: string
  exitTime: string
  pnl: number
  pnlPct: number
  reason: 'SL' | 'TP'
  duration: string
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

function simulate(params: SimParams) {
  const lookback = params.lookback ?? 10
  const volMult = params.volMult ?? 2.0
  const sl = params.sl ?? 0.03
  const tp = params.tp ?? 0.06
  const posSize = params.posSize ?? 0.2
  const leverage = params.leverage ?? 5
  const fee = params.fee ?? 0.001
  let balance = params.initialBalance ?? 10000
  const initialBalance = balance

  const startMs = params.startDate ? new Date(params.startDate).getTime() : rawCandles[0][0]
  const endMs = params.endDate ? new Date(params.endDate).getTime() : rawCandles[rawCandles.length - 1][0]

  // Filter candles + include lookback warmup
  const startIdx = rawCandles.findIndex(c => c[0] >= startMs)
  const warmupIdx = Math.max(0, startIdx - lookback - 1)
  const candles = rawCandles.filter((c, i) => i >= warmupIdx && c[0] <= endMs)
  const displayCandles = rawCandles.filter(c => c[0] >= startMs && c[0] <= endMs)

  const trades: TradeResult[] = []
  const equity: { time: string; balance: number }[] = []
  let pos: Position | null = null
  let maxBal = balance
  let maxDD = 0
  let grossProfit = 0
  let grossLoss = 0
  let tradeId = 0

  // Monthly tracking
  const monthlyBalances: Record<string, { start: number; end: number; trades: number }> = {}

  function getYM(ts: number) {
    const d = new Date(ts)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }

  // Track starting balance per month
  let currentYM = ''

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]
    const [ts, , high, low, close, vol] = c
    const isInRange = ts >= startMs

    const ym = getYM(ts)
    if (isInRange && ym !== currentYM) {
      currentYM = ym
      if (!monthlyBalances[ym]) {
        monthlyBalances[ym] = { start: balance, end: balance, trades: 0 }
      }
    }

    // Check exit
    if (pos) {
      let pnl = 0
      let reason: 'SL' | 'TP' | null = null
      let exitPrice = 0

      if (pos.side === 1) {
        const worst = (low - pos.entry) / pos.entry
        const best = (high - pos.entry) / pos.entry
        if (worst <= -sl) { pnl = -sl * pos.size * leverage; reason = 'SL'; exitPrice = pos.entry * (1 - sl) }
        else if (best >= tp) { pnl = tp * pos.size * leverage; reason = 'TP'; exitPrice = pos.entry * (1 + tp) }
      } else {
        const worst = (pos.entry - high) / pos.entry
        const best = (pos.entry - low) / pos.entry
        if (worst <= -sl) { pnl = -sl * pos.size * leverage; reason = 'SL'; exitPrice = pos.entry * (1 + sl) }
        else if (best >= tp) { pnl = tp * pos.size * leverage; reason = 'TP'; exitPrice = pos.entry * (1 - tp) }
      }

      if (reason) {
        const exitFee = pos.size * fee
        pnl -= exitFee
        balance += pnl
        tradeId++

        if (pnl > 0) grossProfit += pnl
        else grossLoss += Math.abs(pnl)

        trades.push({
          id: tradeId,
          side: pos.side === 1 ? 'LONG' : 'SHORT',
          entryPrice: pos.entry,
          exitPrice,
          entryTime: new Date(pos.entryTime).toISOString(),
          exitTime: new Date(ts).toISOString(),
          pnl: Math.round(pnl * 100) / 100,
          pnlPct: Math.round(pnl / pos.size * 10000) / 100,
          reason,
          duration: formatDuration(ts - pos.entryTime),
        })

        const tradeYM = getYM(ts)
        if (monthlyBalances[tradeYM]) monthlyBalances[tradeYM].trades++

        pos = null
      }
    }

    // Check entry (only in range)
    if (!pos && isInRange && i > lookback && balance > 100) {
      let hi = -Infinity, lo = Infinity, avgVol = 0
      for (let j = i - lookback; j < i; j++) {
        if (candles[j][2] > hi) hi = candles[j][2]
        if (candles[j][3] < lo) lo = candles[j][3]
        avgVol += candles[j][5]
      }
      avgVol /= lookback

      if (vol >= avgVol * volMult) {
        let signal: 0 | 1 | -1 = 0
        if (close > hi) signal = 1
        else if (close < lo) signal = -1

        if (signal !== 0) {
          const size = balance * posSize
          const entryFee = size * fee
          balance -= entryFee
          pos = { side: signal, entry: close, size, entryTime: ts, entryIdx: i }
        }
      }
    }

    if (balance > maxBal) maxBal = balance
    const dd = (maxBal - balance) / maxBal
    if (dd > maxDD) maxDD = dd

    if (isInRange) {
      if (monthlyBalances[currentYM]) monthlyBalances[currentYM].end = balance
      equity.push({ time: new Date(ts).toISOString(), balance: Math.round(balance * 100) / 100 })
    }

    if (balance <= 0) { balance = 0; break }
  }

  // Close open position at end
  if (pos) {
    const lastCandle = candles[candles.length - 1]
    const lastClose = lastCandle[4]
    const move = pos.side === 1
      ? (lastClose - pos.entry) / pos.entry
      : (pos.entry - lastClose) / pos.entry
    const pnl = move * pos.size * leverage - pos.size * fee
    balance += pnl
    tradeId++
    if (pnl > 0) grossProfit += pnl
    else grossLoss += Math.abs(pnl)
    trades.push({
      id: tradeId,
      side: pos.side === 1 ? 'LONG' : 'SHORT',
      entryPrice: pos.entry,
      exitPrice: lastClose,
      entryTime: new Date(pos.entryTime).toISOString(),
      exitTime: new Date(lastCandle[0]).toISOString(),
      pnl: Math.round(pnl * 100) / 100,
      pnlPct: Math.round(pnl / pos.size * 10000) / 100,
      reason: pnl > 0 ? 'TP' : 'SL',
      duration: formatDuration(lastCandle[0] - pos.entryTime),
    })
  }

  // Monthly returns
  const monthlyReturns = Object.entries(monthlyBalances)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, data]) => ({
      year: parseInt(ym.split('-')[0]),
      month: parseInt(ym.split('-')[1]),
      returnPct: data.start > 0 ? Math.round((data.end - data.start) / data.start * 10000) / 100 : 0,
      trades: data.trades,
    }))

  const wins = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl <= 0)

  // Sharpe ratio (annualized from monthly returns)
  const monthlyRets = monthlyReturns.map(m => m.returnPct / 100)
  const avgMonthlyRet = monthlyRets.length > 0 ? monthlyRets.reduce((a, b) => a + b, 0) / monthlyRets.length : 0
  const stdDev = monthlyRets.length > 1
    ? Math.sqrt(monthlyRets.reduce((s, r) => s + (r - avgMonthlyRet) ** 2, 0) / (monthlyRets.length - 1))
    : 0
  const sharpe = stdDev > 0 ? (avgMonthlyRet / stdDev) * Math.sqrt(12) : 0

  // Sample equity for chart (max ~500 points)
  const step = Math.max(1, Math.floor(equity.length / 500))
  const sampledEquity = equity.filter((_, i) => i % step === 0 || i === equity.length - 1)

  // Sample candles for chart (max ~2000)
  const cStep = Math.max(1, Math.floor(displayCandles.length / 2000))
  const sampledCandles = displayCandles.filter((_, i) => i % cStep === 0)

  return {
    stats: {
      totalReturn: Math.round((balance - initialBalance) / initialBalance * 10000) / 100,
      winRate: trades.length > 0 ? Math.round(wins.length / trades.length * 10000) / 100 : 0,
      totalTrades: trades.length,
      profitFactor: grossLoss > 0 ? Math.round(grossProfit / grossLoss * 100) / 100 : grossProfit > 0 ? 99 : 0,
      maxDrawdown: Math.round(maxDD * 10000) / 100,
      sharpeRatio: Math.round(sharpe * 100) / 100,
      avgWin: wins.length > 0 ? Math.round(wins.reduce((s, t) => s + t.pnl, 0) / wins.length * 100) / 100 : 0,
      avgLoss: losses.length > 0 ? Math.round(losses.reduce((s, t) => s + t.pnl, 0) / losses.length * 100) / 100 : 0,
      bestMonth: monthlyReturns.length > 0 ? Math.max(...monthlyReturns.map(m => m.returnPct)) : 0,
      worstMonth: monthlyReturns.length > 0 ? Math.min(...monthlyReturns.map(m => m.returnPct)) : 0,
    },
    trades,
    equity: sampledEquity,
    monthlyReturns,
    candles: sampledCandles,
  }
}

const app = new Hono()
app.use('*', cors())

app.post('/api/simulate', async (c) => {
  try {
    const params = await c.req.json<SimParams>()
    const result = simulate(params)
    return c.json(result)
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

app.get('/api/health', (c) => c.json({ status: 'ok', candles: rawCandles.length }))

// Static files
app.get('/assets/*', serveStatic({ root: './dist' }))
app.get('/favicon.ico', serveStatic({ root: './dist' }))
app.get('*', serveStatic({ path: './dist/index.html' }))

const port = process.env.PORT || 3847

console.log(`🚀 Breakout Strategy Simulator on http://localhost:${port}`)

export default { port, fetch: app.fetch }
