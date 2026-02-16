import { useState } from 'react'
import { Play, BarChart3, AlertCircle, CheckCircle2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useBacktest } from '../hooks/useApi'

export function BacktestPanel() {
  const { data: backtestResult, loading, error, runBacktest } = useBacktest()
  const [selectedPeriod, setSelectedPeriod] = useState('full')

  const periods = [
    { id: 'full', name: 'Full Dataset', description: '2+ years' },
    { id: 'recent', name: 'Recent', description: 'Last 6 months' },
    { id: 'bull', name: 'Bull Market', description: '2021 period' },
    { id: 'bear', name: 'Bear Market', description: '2022 period' },
  ]

  const handleRunBacktest = () => {
    runBacktest()
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold flex items-center">
          <BarChart3 className="h-5 w-5 mr-2 text-primary" />
          Backtest
        </h3>
      </div>
      <div className="card-content">
        {!backtestResult ? (
          <div className="space-y-4">
            {/* Period Selection */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Test Period
              </label>
              <div className="grid grid-cols-2 gap-2">
                {periods.map(period => (
                  <button
                    key={period.id}
                    onClick={() => setSelectedPeriod(period.id)}
                    className={`p-3 rounded-md text-left transition-colors ${
                      selectedPeriod === period.id 
                        ? 'bg-primary/20 border border-primary/40 text-primary' 
                        : 'bg-muted/20 border border-border/20 hover:bg-muted/30'
                    }`}
                  >
                    <div className="font-medium text-sm">{period.name}</div>
                    <div className="text-xs text-muted-foreground">{period.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-destructive/20 border border-destructive/20 rounded-md flex items-center">
                <AlertCircle className="h-4 w-4 text-destructive mr-2" />
                <span className="text-sm text-destructive">{error}</span>
              </div>
            )}

            {/* Run Button */}
            <button
              onClick={handleRunBacktest}
              disabled={loading}
              className="btn btn-primary w-full flex items-center justify-center"
            >
              <Play className="h-4 w-4 mr-2" />
              {loading ? 'Running Backtest...' : 'Run Backtest'}
            </button>

            {/* Info */}
            <div className="text-xs text-muted-foreground text-center">
              Backtests are run on historical 4h candle data using the current strategy parameters
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Success Header */}
            <div className="flex items-center text-success">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">Backtest completed successfully</span>
            </div>

            {/* Equity Curve */}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={backtestResult.equity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#666666"
                    fontSize={10}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis 
                    stroke="#666666"
                    fontSize={10}
                    tick={{ fontSize: 10 }}
                    domain={['dataMin - 100', 'dataMax + 100']}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#12121a', 
                      border: '1px solid #1a1a2e',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '12px'
                    }}
                    labelStyle={{ color: '#a1a1aa', fontSize: '11px' }}
                    formatter={(value: any) => [`$${Number(value || 0).toLocaleString()}`, 'Equity']}
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

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Total Return</div>
                <div className={`font-mono font-medium ${
                  Number(backtestResult.stats.totalPnLPercent || 0) >= 0 ? 'text-success' : 'text-destructive'
                }`}>
                  {Number(backtestResult.stats.totalPnLPercent || 0) >= 0 ? '+' : ''}
                  {Number(backtestResult.stats.totalPnLPercent || 0).toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Win Rate</div>
                <div className="font-mono font-medium">
                  {Number(backtestResult.stats.winRate || 0).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Total Trades</div>
                <div className="font-mono font-medium">
                  {backtestResult.stats.totalTrades || 0}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Max Drawdown</div>
                <div className="font-mono font-medium text-destructive">
                  -{Number(backtestResult.stats.maxDrawdown || 0).toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Profit Factor</div>
                <div className={`font-mono font-medium ${
                  Number(backtestResult.stats.profitFactor || 0) >= 1 ? 'text-success' : 'text-destructive'
                }`}>
                  {Number(backtestResult.stats.profitFactor || 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Sharpe Ratio</div>
                <div className={`font-mono font-medium ${
                  Number(backtestResult.stats.sharpeRatio || 0) >= 1 ? 'text-success' : 
                  Number(backtestResult.stats.sharpeRatio || 0) >= 0.5 ? 'text-yellow-500' : 'text-destructive'
                }`}>
                  {Number(backtestResult.stats.sharpeRatio || 0).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Period Info */}
            <div className="text-xs text-muted-foreground border-t border-border/20 pt-3">
              <div className="flex justify-between">
                <span>Period:</span>
                <span>
                  {new Date(backtestResult.period.start).toLocaleDateString()} - 
                  {new Date(backtestResult.period.end).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Run New Test Button */}
            <button
              onClick={() => window.location.reload()} // Simple reset - could be improved
              className="btn btn-secondary w-full text-sm"
            >
              Run New Backtest
            </button>
          </div>
        )}
      </div>
    </div>
  )
}