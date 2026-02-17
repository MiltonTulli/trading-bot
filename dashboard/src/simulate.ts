import type { SimulationParams, SimulationResult, Trade, EquityPoint, MonthlyReturn, SimulationStats } from './types'

let cachedCandles: number[][] | null = null

export async function loadCandles(): Promise<number[][]> {
  if (cachedCandles) return cachedCandles
  const res = await fetch(`${import.meta.env.BASE_URL}candles.json`)
  cachedCandles = await res.json()
  return cachedCandles!
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

function getYM(ts: number): string {
  const d = new Date(ts)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function runSimulation(params: SimulationParams): Promise<SimulationResult> {
  const allCandles = await loadCandles()

  const lookback = params.lookback
  const volMult = params.volMult
  const sl = params.sl
  const tp = params.tp
  const posSize = params.posSize
  const leverage = params.leverage
  const fee = params.fee
  const initialBalance = params.initialBalance
  let balance = initialBalance

  const startMs = new Date(params.startDate).getTime()
  const endMs = new Date(params.endDate).getTime()

  const startIdx = allCandles.findIndex(c => c[0] >= startMs)
  const warmupIdx = Math.max(0, startIdx - lookback - 1)
  const candles = allCandles.filter((c, i) => i >= warmupIdx && c[0] <= endMs)
  const displayCandles = allCandles.filter(c => c[0] >= startMs && c[0] <= endMs)

  const trades: Trade[] = []
  const equity: EquityPoint[] = []
  let pos: { side: 1 | -1; entry: number; size: number; entryTime: number } | null = null
  let maxBal = balance, maxDD = 0, grossProfit = 0, grossLoss = 0, tradeId = 0

  const monthlyBalances: Record<string, { start: number; end: number; trades: number }> = {}
  let currentYM = ''

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]
    const [ts, , high, low, close, vol] = c
    const isInRange = ts >= startMs

    const ym = getYM(ts)
    if (isInRange && ym !== currentYM) {
      currentYM = ym
      if (!monthlyBalances[ym]) monthlyBalances[ym] = { start: balance, end: balance, trades: 0 }
    }

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
        pnl -= pos.size * fee
        balance += pnl
        tradeId++
        if (pnl > 0) grossProfit += pnl; else grossLoss += Math.abs(pnl)

        trades.push({
          id: tradeId, side: pos.side === 1 ? 'LONG' : 'SHORT',
          entryPrice: pos.entry, exitPrice,
          entryTime: new Date(pos.entryTime).toISOString(),
          exitTime: new Date(ts).toISOString(),
          pnl: Math.round(pnl * 100) / 100,
          pnlPct: Math.round(pnl / pos.size * 10000) / 100,
          reason, duration: formatDuration(ts - pos.entryTime),
        })

        const tradeYM = getYM(ts)
        if (monthlyBalances[tradeYM]) monthlyBalances[tradeYM].trades++
        pos = null
      }
    }

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
          balance -= size * fee
          pos = { side: signal, entry: close, size, entryTime: ts }
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

  // Close open position
  if (pos) {
    const last = candles[candles.length - 1]
    const move = pos.side === 1 ? (last[4] - pos.entry) / pos.entry : (pos.entry - last[4]) / pos.entry
    const pnl = move * pos.size * leverage - pos.size * fee
    balance += pnl
    tradeId++
    if (pnl > 0) grossProfit += pnl; else grossLoss += Math.abs(pnl)
    trades.push({
      id: tradeId, side: pos.side === 1 ? 'LONG' : 'SHORT',
      entryPrice: pos.entry, exitPrice: last[4],
      entryTime: new Date(pos.entryTime).toISOString(), exitTime: new Date(last[0]).toISOString(),
      pnl: Math.round(pnl * 100) / 100, pnlPct: Math.round(pnl / pos.size * 10000) / 100,
      reason: pnl > 0 ? 'TP' : 'SL', duration: formatDuration(last[0] - pos.entryTime),
    })
  }

  const monthlyReturns: MonthlyReturn[] = Object.entries(monthlyBalances)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, data]) => ({
      year: parseInt(ym.split('-')[0]),
      month: parseInt(ym.split('-')[1]),
      returnPct: data.start > 0 ? Math.round((data.end - data.start) / data.start * 10000) / 100 : 0,
      trades: data.trades,
    }))

  const wins = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl <= 0)

  const monthlyRets = monthlyReturns.map(m => m.returnPct / 100)
  const avgMR = monthlyRets.length > 0 ? monthlyRets.reduce((a, b) => a + b, 0) / monthlyRets.length : 0
  const stdDev = monthlyRets.length > 1
    ? Math.sqrt(monthlyRets.reduce((s, r) => s + (r - avgMR) ** 2, 0) / (monthlyRets.length - 1)) : 0
  const sharpe = stdDev > 0 ? (avgMR / stdDev) * Math.sqrt(12) : 0

  const step = Math.max(1, Math.floor(equity.length / 500))
  const sampledEquity = equity.filter((_, i) => i % step === 0 || i === equity.length - 1)
  const cStep = Math.max(1, Math.floor(displayCandles.length / 2000))
  const sampledCandles = displayCandles.filter((_, i) => i % cStep === 0)

  const stats: SimulationStats = {
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
  }

  return { stats, trades, equity: sampledEquity, monthlyReturns, candles: sampledCandles }
}
