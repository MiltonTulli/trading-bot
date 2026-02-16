import { Hono } from 'hono'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const bot = new Hono()

const DATA_DIR = join(process.cwd(), '..', 'data')  // Parent directory's data folder
const STATE_FILE = join(DATA_DIR, 'state.json')
const CONFIG_FILE = join(process.cwd(), '..', 'config.json')  // Parent directory's config

// Helper function to read JSON file
function readJSONFile(filePath: string) {
  try {
    if (!existsSync(filePath)) {
      return null
    }
    const data = readFileSync(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error)
    return null
  }
}

// Helper function to write JSON file
function writeJSONFile(filePath: string, data: any) {
  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2))
    return true
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error)
    return false
  }
}

// Get bot status
bot.get('/status', (c) => {
  const state = readJSONFile(STATE_FILE)
  const config = readJSONFile(CONFIG_FILE)
  
  if (!state) {
    return c.json({
      status: 'stopped',
      balance: 10000,
      equity: 10000,
      currentPosition: null,
      lastUpdated: new Date().toISOString()
    })
  }

  // Get current position from open trades
  const openTrades = Object.values(state.openTrades || {}) as any[]
  const currentPosition = openTrades.length > 0 ? {
    id: openTrades[0].id,
    symbol: openTrades[0].symbol,
    direction: openTrades[0].direction,
    entryPrice: openTrades[0].entryPrice,
    quantity: openTrades[0].quantity,
    unrealizedPnL: openTrades[0].unrealizedPnL || 0,
    entryTime: openTrades[0].entryTime,
  } : null

  return c.json({
    status: config?.mode === 'live' ? 'running' : config?.mode === 'paper' ? 'paper' : 'stopped',
    balance: state.balance || 10000,
    equity: state.equity || state.balance || 10000,
    currentPosition,
    lastUpdated: state.lastUpdated || new Date().toISOString()
  })
})

// Start bot
bot.post('/start', async (c) => {
  let body = {}
  try {
    body = await c.req.json()
  } catch (error) {
    // Handle empty body or invalid JSON gracefully
    console.log('No JSON body provided, using defaults')
    body = {}
  }
  const mode = (body as any).mode || 'paper'
  const params = (body as any).params || {}
  
  const config = readJSONFile(CONFIG_FILE) || {}
  config.mode = mode
  
  // Update strategy parameters if provided
  if (params) {
    if (!config.params) config.params = {}
    
    // Map UI parameters to config structure
    if (params.stopLoss) config.params.sl = params.stopLoss / 100
    if (params.takeProfit) config.params.tp = params.takeProfit / 100
    if (params.positionSize) config.params.posSize = params.positionSize / 100
    if (params.leverage) config.params.leverage = params.leverage
    if (params.lookback) config.params.lookback = params.lookback
    if (params.volMultiplier) config.params.volMult = params.volMultiplier
    
    // Update other settings
    if (params.symbol) config.pairs = [params.symbol]
    if (params.timeframe) config.timeframe = params.timeframe
  }
  
  if (!writeJSONFile(CONFIG_FILE, config)) {
    return c.json({ error: 'Failed to update config' }, 500)
  }

  console.log(`🤖 Bot started in ${mode} mode with parameters:`, params)
  
  return c.json({ success: true, mode, params })
})

// Stop bot
bot.post('/stop', (c) => {
  const config = readJSONFile(CONFIG_FILE) || {}
  config.mode = 'stopped'
  
  if (!writeJSONFile(CONFIG_FILE, config)) {
    return c.json({ error: 'Failed to update config' }, 500)
  }

  console.log('🛑 Bot stopped')
  
  return c.json({ success: true })
})

// Get aggregated stats
bot.get('/stats', (c) => {
  const state = readJSONFile(STATE_FILE)
  
  if (!state) {
    return c.json({
      totalPnL: 0,
      totalPnLPercent: 0,
      winRate: 0,
      totalTrades: 0,
      currentMonthReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winningTrades: 0,
      losingTrades: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
    })
  }

  const closedTrades = state.closedTrades || []
  const totalPnL = state.totalProfit - state.totalLoss || 0
  const initialBalance = 10000
  const totalPnLPercent = (totalPnL / initialBalance) * 100
  
  const winningTrades = closedTrades.filter((t: any) => t.netPnL > 0).length
  const losingTrades = closedTrades.filter((t: any) => t.netPnL < 0).length
  const totalTrades = closedTrades.length
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0

  const wins = closedTrades.filter((t: any) => t.netPnL > 0)
  const losses = closedTrades.filter((t: any) => t.netPnL < 0)
  
  const avgWin = wins.length > 0 ? wins.reduce((sum: number, t: any) => sum + t.netPnL, 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? losses.reduce((sum: number, t: any) => sum + t.netPnL, 0) / losses.length : 0
  const grossProfit = wins.reduce((sum: number, t: any) => sum + t.netPnL, 0)
  const grossLoss = Math.abs(losses.reduce((sum: number, t: any) => sum + t.netPnL, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0

  // Calculate current month return (simplified)
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const currentMonthTrades = closedTrades.filter((t: any) => {
    const tradeDate = new Date(t.exitTime)
    return tradeDate.getMonth() === currentMonth && tradeDate.getFullYear() === currentYear
  })
  const currentMonthPnL = currentMonthTrades.reduce((sum: number, t: any) => sum + t.netPnL, 0)
  const currentMonthReturn = (currentMonthPnL / initialBalance) * 100

  return c.json({
    totalPnL,
    totalPnLPercent,
    winRate,
    totalTrades,
    currentMonthReturn,
    sharpeRatio: 0.75, // Mock value
    maxDrawdown: state.maxDrawdown || 0,
    winningTrades,
    losingTrades,
    avgWin,
    avgLoss,
    profitFactor,
  })
})

// Get equity curve data
bot.get('/equity', (c) => {
  const state = readJSONFile(STATE_FILE)
  
  if (!state || !state.closedTrades || state.closedTrades.length === 0) {
    // Return initial point
    return c.json([
      {
        time: new Date().toISOString(),
        equity: 10000,
        drawdown: 0
      }
    ])
  }

  let runningBalance = 10000
  let peak = 10000
  const equityPoints = [
    {
      time: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      equity: runningBalance,
      drawdown: 0
    }
  ]

  // Generate equity curve from trades
  state.closedTrades.forEach((trade: any) => {
    runningBalance += trade.netPnL
    peak = Math.max(peak, runningBalance)
    const drawdown = peak > 0 ? ((peak - runningBalance) / peak) * 100 : 0
    
    equityPoints.push({
      time: trade.exitTime,
      equity: runningBalance,
      drawdown: -drawdown // Negative for display
    })
  })

  return c.json(equityPoints)
})

// Get monthly returns
bot.get('/monthly', (c) => {
  const state = readJSONFile(STATE_FILE)
  
  if (!state || !state.closedTrades) {
    return c.json([])
  }

  // Group trades by month/year
  const monthlyReturns: { [key: string]: number } = {}
  
  state.closedTrades.forEach((trade: any) => {
    const date = new Date(trade.exitTime)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    if (!monthlyReturns[monthKey]) {
      monthlyReturns[monthKey] = 0
    }
    monthlyReturns[monthKey] += trade.netPnL
  })

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  return c.json(
    Object.entries(monthlyReturns).map(([monthKey, pnl]) => {
      const [year, month] = monthKey.split('-')
      return {
        month: months[parseInt(month) - 1],
        year: parseInt(year),
        return: (pnl / 10000) * 100 // Convert to percentage
      }
    })
  )
})

export default bot