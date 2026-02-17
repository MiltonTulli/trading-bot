import { useState, useCallback } from 'react'
import type { SimulationParams, SimulationResult } from './types'
import { runSimulation as simulate } from './simulate'
import ConfigPanel from './components/ConfigPanel'
import StatsCards from './components/StatsCards'
import EquityCurve from './components/EquityCurve'
import CandlestickChart from './components/CandlestickChart'
import MonthlyHeatmap from './components/MonthlyHeatmap'
import TradesTable from './components/TradesTable'
import { Activity, TrendingUp } from 'lucide-react'

export default function App() {
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runSimulation = useCallback(async (params: SimulationParams) => {
    setLoading(true)
    setError(null)
    try {
      const data = await simulate(params)
      setResult(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3">
        <Activity className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">Breakout Strategy Simulator</h1>
        <span className="text-xs text-muted-foreground ml-2 bg-muted px-2 py-0.5 rounded">BTC/USDT · 4H</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 min-w-[320px] border-r border-border/30 overflow-y-auto p-4">
          <ConfigPanel onRun={runSimulation} loading={loading} />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-destructive/20 border border-destructive/50 rounded-lg p-4 text-destructive">
              {error}
            </div>
          )}

          {!result && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
              <TrendingUp className="w-16 h-16 opacity-30" />
              <p className="text-lg">Configure parameters and run a simulation</p>
              <p className="text-sm opacity-60">BTC/USDT 4H · Jan 2021 – Feb 2026 · 11,236 candles</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <span className="ml-3 text-muted-foreground">Running simulation...</span>
            </div>
          )}

          {result && !loading && (
            <>
              <StatsCards stats={result.stats} />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="card p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Equity Curve</h3>
                  <EquityCurve data={result.equity} />
                </div>
                <div className="card p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Price Chart & Trades</h3>
                  <CandlestickChart candles={result.candles} trades={result.trades} />
                </div>
              </div>
              <div className="card p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Monthly Returns Heatmap</h3>
                <MonthlyHeatmap data={result.monthlyReturns} />
              </div>
              <div className="card p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Trade History ({result.trades.length} trades)</h3>
                <TradesTable trades={result.trades} />
              </div>
            </>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/20 px-6 py-2 text-center text-xs text-muted-foreground">
        Built with ☕ by{' '}
        <a href="https://github.com/MiltonTulli" target="_blank" rel="noopener" className="text-primary hover:underline">
          @MiltonTulli
        </a>{' · '}
        <a href="https://github.com/MiltonTulli/trading-bot" target="_blank" rel="noopener" className="text-primary hover:underline">
          GitHub
        </a>
      </footer>
    </div>
  )
}
