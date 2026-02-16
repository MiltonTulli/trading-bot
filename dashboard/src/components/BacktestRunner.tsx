import { useState } from 'react'
import { Play, BarChart3, CheckCircle2, AlertCircle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useBacktest } from '../hooks/useApi'

export function BacktestRunner() {
  const { data: result, loading, error, runBacktest } = useBacktest()
  const [period, setPeriod] = useState('full')

  const periods = [
    { id: 'full', name: 'Full Dataset (2+ years)', description: 'Complete historical data' },
    { id: 'recent', name: 'Recent (6 months)', description: 'Last 6 months only' },
    { id: 'bull', name: 'Bull Market (2021)', description: 'Bull market conditions' },
    { id: 'bear', name: 'Bear Market (2022)', description: 'Bear market conditions' },
  ]

  return (
    <div className="space-y-6">
      {!result ? (
        // Backtest Configuration
        <div className="card p-6 max-w-2xl">
          <div className="flex items-center space-x-2 mb-6">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">Run Backtest</h2>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-destructive/20 border border-destructive/20 rounded-md flex items-center">
              <AlertCircle className="h-5 w-5 text-destructive mr-3" />
              <span className="text-destructive">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-3">Test Period</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {periods.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPeriod(p.id)}
                    className={`p-4 rounded-md text-left border transition-all ${
                      period === p.id 
                        ? 'border-primary bg-primary/10 text-primary' 
                        : 'border-border hover:border-primary/50 hover:bg-primary/5'
                    }`}
                  >
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">{p.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border/20">
              <button
                onClick={runBacktest}
                disabled={loading}
                className="btn btn-primary btn-lg w-full md:w-auto flex items-center justify-center"
              >
                <Play className="h-5 w-5 mr-2" />
                {loading ? 'Running Backtest...' : 'Run Backtest'}
              </button>
              
              <p className="text-sm text-muted-foreground mt-3">
                This will test your current strategy parameters against historical data to validate performance before going live.
              </p>
            </div>
          </div>
        </div>
      ) : (
        // Backtest Results
        <div className="space-y-6">
          {/* Results Header */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <h2 className="text-xl font-semibold">Backtest Results</h2>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-secondary btn-sm"
              >
                Run New Test
              </button>
            </div>
            
            <div className="text-sm text-muted-foreground mt-2">
              Period: {new Date(result.period.start).toLocaleDateString()} - {new Date(result.period.end).toLocaleDateString()}
            </div>
          </div>

          {/* Performance Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <div className="text-sm text-muted-foreground">Total Return</div>
              <div className={`text-2xl font-bold ${
                result.stats.totalPnLPercent >= 0 ? 'text-success' : 'text-destructive'
              }`}>
                {result.stats.totalPnLPercent >= 0 ? '+' : ''}{result.stats.totalPnLPercent.toFixed(2)}%
              </div>
            </div>
            
            <div className="card p-4 text-center">
              <div className="text-sm text-muted-foreground">Win Rate</div>
              <div className="text-2xl font-bold text-foreground">
                {result.stats.winRate.toFixed(1)}%
              </div>
            </div>
            
            <div className="card p-4 text-center">
              <div className="text-sm text-muted-foreground">Total Trades</div>
              <div className="text-2xl font-bold text-foreground">
                {result.stats.totalTrades}
              </div>
            </div>
            
            <div className="card p-4 text-center">
              <div className="text-sm text-muted-foreground">Max Drawdown</div>
              <div className="text-2xl font-bold text-destructive">
                -{result.stats.maxDrawdown.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Equity Curve */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Equity Curve</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.equity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#666666"
                    fontSize={12}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="#666666"
                    fontSize={12}
                    tick={{ fontSize: 12 }}
                    domain={['dataMin - 100', 'dataMax + 100']}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#12121a', 
                      border: '1px solid #1a1a2e',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '14px'
                    }}
                    labelStyle={{ color: '#a1a1aa' }}
                    formatter={(value: any) => [`$${value.toLocaleString()}`, 'Equity']}
                  />
                  <Line
                    type="monotone"
                    dataKey="equity"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-4">
              <h4 className="font-medium mb-3">Risk Metrics</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sharpe Ratio</span>
                  <span className="font-mono">{result.stats.sharpeRatio.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Profit Factor</span>
                  <span className="font-mono">{result.stats.profitFactor.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Drawdown</span>
                  <span className="font-mono text-destructive">-{result.stats.maxDrawdown.toFixed(2)}%</span>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <h4 className="font-medium mb-3">Trade Stats</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Winning Trades</span>
                  <span className="font-mono text-success">{result.stats.winningTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Losing Trades</span>
                  <span className="font-mono text-destructive">{result.stats.losingTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average Win</span>
                  <span className="font-mono text-success">${result.stats.avgWin.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average Loss</span>
                  <span className="font-mono text-destructive">${result.stats.avgLoss.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}