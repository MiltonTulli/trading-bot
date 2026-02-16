import { Hono } from 'hono'

const backtest = new Hono()

// Run backtest
backtest.get('/backtest', async (c) => {
  try {
    // For now, we'll return mock backtest results
    // In a real implementation, you would run the actual backtest script
    
    const mockEquityData: Array<{ time: string; equity: number; drawdown: number }> = []
    const startDate = new Date('2023-01-01')
    const endDate = new Date()
    let currentDate = new Date(startDate)
    let equity = 10000
    let peakEquity = equity
    
    // Generate mock equity curve
    while (currentDate <= endDate) {
      const dailyReturn = (Math.random() - 0.5) * 0.02 // Random daily return between -1% and +1%
      equity *= (1 + dailyReturn)
      peakEquity = Math.max(peakEquity, equity)
      
      mockEquityData.push({
        time: currentDate.toISOString(),
        equity: Math.round(equity * 100) / 100,
        drawdown: peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * -100 : 0
      })
      
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Generate mock trades
    const mockTrades = []
    for (let i = 0; i < 50; i++) {
      const entryDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()))
      const exitDate = new Date(entryDate.getTime() + (1 + Math.random() * 10) * 24 * 60 * 60 * 1000) // 1-10 days later
      const isLong = Math.random() > 0.5
      const entryPrice = 50000 + Math.random() * 50000
      const returnPercent = (Math.random() - 0.45) * 10 // Slightly positive bias
      const exitPrice = entryPrice * (1 + returnPercent / 100)
      const quantity = 0.1
      const grossPnL = (exitPrice - entryPrice) * quantity
      const netPnL = grossPnL - Math.abs(grossPnL) * 0.001 // 0.1% fees
      
      mockTrades.push({
        id: `backtest_${i}`,
        symbol: 'BTCUSDT',
        direction: isLong ? 'LONG' : 'SHORT',
        entryPrice,
        exitPrice,
        quantity,
        entryTime: entryDate.toISOString(),
        exitTime: exitDate.toISOString(),
        grossPnL,
        netPnL,
        returnPercent,
        exitReason: 'backtest',
        duration: (exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60), // hours
      })
    }

    // Calculate stats
    const totalPnL = mockTrades.reduce((sum, t) => sum + t.netPnL, 0)
    const winningTrades = mockTrades.filter(t => t.netPnL > 0).length
    const losingTrades = mockTrades.filter(t => t.netPnL < 0).length
    const winRate = (winningTrades / mockTrades.length) * 100
    const totalPnLPercent = (totalPnL / 10000) * 100
    
    const wins = mockTrades.filter(t => t.netPnL > 0)
    const losses = mockTrades.filter(t => t.netPnL < 0)
    const grossProfit = wins.reduce((sum, t) => sum + t.netPnL, 0)
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.netPnL, 0))
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0
    
    const equityValues = mockEquityData.map(d => d.equity)
    const peak = Math.max(...equityValues)
    const trough = Math.min(...equityValues.slice(equityValues.indexOf(peak)))
    const maxDrawdown = ((peak - trough) / peak) * 100

    const result = {
      equity: mockEquityData,
      trades: mockTrades,
      stats: {
        totalPnL,
        totalPnLPercent,
        winRate,
        totalTrades: mockTrades.length,
        currentMonthReturn: 0, // Not applicable for backtests
        sharpeRatio: 1.2, // Mock value
        maxDrawdown,
        winningTrades,
        losingTrades,
        avgWin: wins.length > 0 ? wins.reduce((sum, t) => sum + t.netPnL, 0) / wins.length : 0,
        avgLoss: losses.length > 0 ? losses.reduce((sum, t) => sum + t.netPnL, 0) / losses.length : 0,
        profitFactor,
      },
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      }
    }

    return c.json(result)
    
  } catch (error) {
    console.error('Backtest error:', error)
    return c.json({ error: 'Failed to run backtest' }, 500)
  }
})

export default backtest