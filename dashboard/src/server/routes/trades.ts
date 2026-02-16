import { Hono } from 'hono'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const trades = new Hono()

const DATA_DIR = join(process.cwd(), '..', 'data')  // Parent directory's data folder
const STATE_FILE = join(DATA_DIR, 'state.json')
const BREAKOUT_TRADES_FILE = join(DATA_DIR, 'breakout-trades.json')

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

// Get all trades
trades.get('/', (c) => {
  const state = readJSONFile(STATE_FILE)
  const breakoutTrades = readJSONFile(BREAKOUT_TRADES_FILE) || []
  
  if (!state) {
    return c.json(breakoutTrades)
  }

  // Combine trades from both sources and transform to match frontend types
  const allTrades = [...breakoutTrades]
  
  if (state.closedTrades) {
    const transformedTrades = state.closedTrades.map((trade: any) => ({
      id: trade.id,
      symbol: trade.symbol,
      direction: trade.direction === 'long' ? 'LONG' : 'SHORT',
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice || trade.entryPrice, // fallback for open trades
      quantity: trade.quantity,
      entryTime: trade.entryTime,
      exitTime: trade.exitTime || new Date().toISOString(),
      grossPnL: trade.grossPnL || trade.netPnL || 0,
      netPnL: trade.netPnL || 0,
      returnPercent: trade.netPnL ? ((trade.netPnL / (trade.entryPrice * trade.quantity)) * 100) : 0,
      exitReason: trade.exitReason || 'manual',
      duration: trade.holdingPeriod ? trade.holdingPeriod / (1000 * 60 * 60) : 0, // Convert ms to hours
    }))
    
    allTrades.push(...transformedTrades)
  }

  // Sort by exit time (most recent first)
  allTrades.sort((a, b) => new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime())

  return c.json(allTrades)
})

// Get current open position
trades.get('/open', (c) => {
  const state = readJSONFile(STATE_FILE)
  
  if (!state || !state.openTrades) {
    return c.json(null)
  }

  const openTrades = Object.values(state.openTrades) as any[]
  
  if (openTrades.length === 0) {
    return c.json(null)
  }

  const position = openTrades[0]
  
  return c.json({
    id: position.id,
    symbol: position.symbol,
    direction: position.direction,
    entryPrice: position.entryPrice,
    quantity: position.quantity,
    unrealizedPnL: position.unrealizedPnL || 0,
    entryTime: position.entryTime,
  })
})

export default trades