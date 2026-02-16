import { useState } from 'react'
import { Play, BarChart3, CheckCircle2, AlertCircle, RotateCcw, Settings2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useBacktest } from '../hooks/useApi'

const DEFAULT_PARAMS = {
  lookback: 10,
  volMult: 2.0,
  sl: 3,
  tp: 6,
  posSize: 20,
  leverage: 5,
}

export function BacktestRunner() {
  const { data: result, loading, error, runBacktest } = useBacktest()
  const [period, setPeriod] = useState('full')
  const [params, setParams] = useState(DEFAULT_PARAMS)

  const periods = [
    { id: 'full', name: 'Full Dataset (2+ years)', description: 'Complete historical data' },
    { id: 'recent', name: 'Recent (6 months)', description: 'Last 6 months only' },
    { id: 'bull', name: 'Bull Market (2021)', description: 'Bull market conditions' },
    { id: 'bear', name: 'Bear Market (2022)', description: 'Bear market conditions' },
  ]

  const updateParam = (key: string, value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num)) setParams(p => ({ ...p, [key]: num }))
  }

  const resetParams = () => setParams(DEFAULT_PARAMS)

  const handleRun = () => {
    runBacktest({
      period,
      lookback: params.lookback,
      volMult: params.volMult,
      sl: params.sl / 100,
      tp: params.tp / 100,
      posSize: params.posSize / 100,
      leverage: params.leverage,
    })
  }

  return (
    <div className="space-y-6">
      {!result ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Period + Run */}
          <div className="card p-6">
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
                <div className="grid grid-cols-2 gap-3">
                  {periods.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPeriod(p.id)}
                      className={`p-3 rounded-md text-left border transition-all ${
                        period === p.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 hover:bg-primary/5'
                      }`}
                    >
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{p.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-border/20">
                <button
                  onClick={handleRun}
                  disabled={loading}
                  className="btn btn-primary btn-lg w-full flex items-center justify-center"
                >
                  <Play className="h-5 w-5 mr-2" />
                  {loading ? 'Running Backtest...' : 'Run Backtest'}
                </button>
                <p className="text-sm text-muted-foreground mt-3">
                  Tests the strategy against historical 4h BTC candle data with the configured parameters.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Strategy Parameters */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Settings2 className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-semibold">Strategy Parameters</h2>
              </div>
              <button onClick={resetParams} className="text-sm text-muted-foreground hover:text-primary flex items-center">
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset Defaults
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Lookback Periods</label>
                  <input type="number" value={params.lookback} onChange={e => updateParam('lookback', e.target.value)}
                    className="w-full bg-muted/20 border border-border rounded-md px-3 py-2 font-mono text-lg" />
                  <p className="text-xs text-muted-foreground mt-1">Candles for high/low calculation</p>
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Volume Multiplier</label>
                  <input type="number" step="0.1" value={params.volMult} onChange={e => updateParam('volMult', e.target.value)}
                    className="w-full bg-muted/20 border border-border rounded-md px-3 py-2 font-mono text-lg" />
                  <p className="text-xs text-muted-foreground mt-1">Volume must exceed avg × this</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Stop Loss (%)</label>
                  <input type="number" step="0.5" value={params.sl} onChange={e => updateParam('sl', e.target.value)}
                    className="w-full bg-muted/20 border border-border rounded-md px-3 py-2 font-mono text-lg text-destructive" />
                  <p className="text-xs text-muted-foreground mt-1">Max loss per trade</p>
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Take Profit (%)</label>
                  <input type="number" step="0.5" value={params.tp} onChange={e => updateParam('tp', e.target.value)}
                    className="w-full bg-muted/20 border border-border rounded-md px-3 py-2 font-mono text-lg text-success" />
                  <p className="text-xs text-muted-foreground mt-1">Target profit per trade</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Position Size (%)</label>
                  <input type="number" step="5" value={params.posSize} onChange={e => updateParam('posSize', e.target.value)}
                    className="w-full bg-muted/20 border border-border rounded-md px-3 py-2 font-mono text-lg" />
                  <p className="text-xs text-muted-foreground mt-1">% of balance per trade</p>
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Leverage</label>
                  <input type="number" value={params.leverage} onChange={e => updateParam('leverage', e.target.value)}
                    className="w-full bg-muted/20 border border-border rounded-md px-3 py-2 font-mono text-lg" />
                  <p className="text-xs text-muted-foreground mt-1">Futures leverage multiplier</p>
                </div>
              </div>

              {/* R:R Display */}
              <div className="bg-muted/10 rounded-md p-3 border border-border/20">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Risk:Reward Ratio</span>
                  <span className="font-mono font-medium">1:{(params.tp / params.sl).toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Breakeven Win Rate</span>
                  <span className="font-mono font-medium">{(params.sl / (params.sl + params.tp) * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Risk per Trade</span>
                  <span className="font-mono font-medium">{(params.sl / 100 * params.posSize / 100 * params.leverage * 100).toFixed(1)}% of balance</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Results
        <div className="space-y-6">
          {/* Results Header */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <h2 className="text-xl font-semibold">Backtest Results</h2>
              </div>
              <button onClick={() => window.location.reload()} className="btn btn-secondary btn-sm">
                <RotateCcw className="h-4 w-4 mr-1" /> New Test
              </button>
            </div>
            <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground mt-2">
              <span>{new Date(result.period.start).toLocaleDateString()} → {new Date(result.period.end).toLocaleDateString()}</span>
              {(result as any).params && (
                <span className="font-mono">
                  LB={((result as any).params.lookback)} · Vol={((result as any).params.volMult)}x · SL={((result as any).params.sl * 100).toFixed(1)}% · TP={((result as any).params.tp * 100).toFixed(1)}% · Size={((result as any).params.posSize * 100).toFixed(0)}% · {((result as any).params.leverage)}x
                </span>
              )}
            </div>
          </div>

          {/* Performance Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <div className="text-sm text-muted-foreground">Total Return</div>
              <div className={`text-2xl font-bold ${Number(result.stats.totalPnLPercent || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                {Number(result.stats.totalPnLPercent || 0) >= 0 ? '+' : ''}{Number(result.stats.totalPnLPercent || 0).toFixed(2)}%
              </div>
              <div className={`text-sm ${Number(result.stats.totalPnL || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                ${Number(result.stats.totalPnL || 0).toLocaleString()}
              </div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-sm text-muted-foreground">Win Rate</div>
              <div className="text-2xl font-bold">{Number(result.stats.winRate || 0).toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">{result.stats.winningTrades || 0}W / {result.stats.losingTrades || 0}L</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-sm text-muted-foreground">Total Trades</div>
              <div className="text-2xl font-bold">{result.stats.totalTrades || 0}</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-sm text-muted-foreground">Max Drawdown</div>
              <div className="text-2xl font-bold text-destructive">-{Number(result.stats.maxDrawdown || 0).toFixed(2)}%</div>
            </div>
          </div>

          {/* Equity Curve */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Equity Curve</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.equity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                  <XAxis dataKey="time" stroke="#666666" fontSize={12} tick={{ fontSize: 12 }} />
                  <YAxis stroke="#666666" fontSize={12} tick={{ fontSize: 12 }} domain={['dataMin - 100', 'dataMax + 100']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1a1a2e', borderRadius: '8px', color: '#ffffff', fontSize: '14px' }}
                    labelStyle={{ color: '#a1a1aa' }}
                    formatter={(value: any) => [`$${Number(value || 0).toLocaleString()}`, 'Equity']}
                  />
                  <Line type="monotone" dataKey="equity" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-4">
              <h4 className="font-medium mb-3">Risk Metrics</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sharpe Ratio</span>
                  <span className={`font-mono ${Number(result.stats.sharpeRatio || 0) >= 1 ? 'text-success' : 'text-yellow-500'}`}>
                    {Number(result.stats.sharpeRatio || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Profit Factor</span>
                  <span className={`font-mono ${Number(result.stats.profitFactor || 0) >= 1 ? 'text-success' : 'text-destructive'}`}>
                    {Number(result.stats.profitFactor || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Drawdown</span>
                  <span className="font-mono text-destructive">-{Number(result.stats.maxDrawdown || 0).toFixed(2)}%</span>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <h4 className="font-medium mb-3">Trade Stats</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average Win</span>
                  <span className="font-mono text-success">${Number(result.stats.avgWin || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average Loss</span>
                  <span className="font-mono text-destructive">-${Number(result.stats.avgLoss || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Win/Loss Ratio</span>
                  <span className="font-mono">
                    {Number(result.stats.avgLoss || 0) > 0
                      ? (Number(result.stats.avgWin || 0) / Number(result.stats.avgLoss || 1)).toFixed(2)
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
