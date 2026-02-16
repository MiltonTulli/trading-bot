import { Hono } from 'hono'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const candles = new Hono()

const DATA_DIR = join(process.cwd(), 'data')
const BACKTEST_DIR = join(DATA_DIR, 'backtest')
const BACKTEST_DATA_FILE = join(BACKTEST_DIR, 'BTCUSDT_4h_full.json')

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

// Get recent candle data
candles.get('/', (c) => {
  try {
    // Try to read from backtest data first
    const backtestData = readJSONFile(BACKTEST_DATA_FILE)
    
    if (backtestData && Array.isArray(backtestData)) {
      // Take the last 500 candles for the chart
      const recentCandles = backtestData.slice(-500).map((candle: any) => ({
        time: new Date(candle.openTime).getTime() / 1000, // Convert to seconds for TradingView
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume),
      }))
      
      return c.json(recentCandles)
    }

    // Fallback: Generate mock data if no real data is available
    console.log('No backtest data found, generating mock candle data')
    
    const mockCandles = []
    const startTime = Date.now() - (500 * 4 * 60 * 60 * 1000) // 500 * 4 hours ago
    let currentPrice = 69000 // Starting BTC price
    
    for (let i = 0; i < 500; i++) {
      const time = startTime + (i * 4 * 60 * 60 * 1000) // 4-hour intervals
      
      // Generate realistic price movement
      const volatility = 0.02 // 2% volatility
      const trend = 0.0001 // Slight upward trend
      const change = (Math.random() - 0.5) * volatility + trend
      
      const open = currentPrice
      const close = open * (1 + change)
      const high = Math.max(open, close) * (1 + Math.random() * 0.005)
      const low = Math.min(open, close) * (1 - Math.random() * 0.005)
      const volume = 1000 + Math.random() * 2000 // Random volume
      
      mockCandles.push({
        time: Math.floor(time / 1000), // Convert to seconds
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume: Math.round(volume * 100) / 100,
      })
      
      currentPrice = close
    }
    
    return c.json(mockCandles)
    
  } catch (error) {
    console.error('Error fetching candles:', error)
    return c.json({ error: 'Failed to fetch candle data' }, 500)
  }
})

export default candles