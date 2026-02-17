export interface SimulationParams {
  startDate: string
  endDate: string
  lookback: number
  volMult: number
  sl: number
  tp: number
  posSize: number
  leverage: number
  initialBalance: number
  fee: number
}

export interface Trade {
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

export interface EquityPoint {
  time: string
  balance: number
}

export interface MonthlyReturn {
  year: number
  month: number
  returnPct: number
  trades: number
}

export interface SimulationStats {
  totalReturn: number
  winRate: number
  totalTrades: number
  profitFactor: number
  maxDrawdown: number
  sharpeRatio: number
  avgWin: number
  avgLoss: number
  bestMonth: number
  worstMonth: number
}

export interface SimulationResult {
  stats: SimulationStats
  trades: Trade[]
  equity: EquityPoint[]
  monthlyReturns: MonthlyReturn[]
  candles: number[][] // [timestamp, o, h, l, c, v]
}
