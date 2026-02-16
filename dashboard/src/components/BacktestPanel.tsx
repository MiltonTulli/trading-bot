import { useState } from 'react'
import { Play, BarChart3, AlertCircle, CheckCircle2, RotateCcw, Settings2 } from 'lucide-react'
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

export function BacktestPanel() {
  const { data: backtestResult, loading, error, runBacktest } = useBacktest()
  const [selectedPeriod, setSelectedPeriod] = useState('full')
  const [params, setParams] = useState(DEFAULT_PARAMS)

  const periods = [
    { id: 'full', name: 'Full Dataset', description: '2021–2026' },
    { id: 'recent', name: 'Recent', description: 'Last 6 months' },
    { id: 'bull', name: 'Bull Market', description: '2021 period' },
    { id: 'bear', name: 'Bear Market', description: '2022 period' },
  ]

  const handleRunBacktest = () => {
    runBacktest({
      period: selectedPeriod,
      lookback: params.lookback,
      volMult: params.volMult,
      sl: params.sl / 100,
      tp: params.tp / 100,
      posSize: params.posSize / 100,
      leverage: params.leverage,
    })
  }

  const updateParam = (key: string, value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num)) setParams(p => ({ ...p, [key]: num }))
  }

  const resetParams = () => setParams(DEFAULT_PARAMS)

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
                    className={`p-2 rounded-md text-left transition-colors ${
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

            {/* Strategy Parameters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center">
                  <Settings2 className="h-3.5 w-3.5 mr-1" />
                  Strategy Parameters
                </label>
                <button onClick={resetParams} className="text-xs text-muted-foreground hover:text-primary flex items-center">
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Lookback</label>
                  <input type="number" value={params.lookback} onChange={e => updateParam('lookback', e.target.value)}
                    className="w-full bg-muted/20 border border-border/20 rounded px-2 py-1.5 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Vol Multiplier</label>
                  <input type="number" step="0.1" value={params.volMult} onChange={e => updateParam('volMult', e.target.value)}
                    className="w-full bg-muted/20 border border-border/20 rounded px-2 py-1.5 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Stop Loss (%)</label>
                  <input type="number" step="0.5" value={params.sl} onChange={e => updateParam('sl', e.target.value)}
                    className="w-full bg-muted/20 border border-border/20 rounded px-2 py-1.5 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Take Profit (%)</label>
                  <input type="number" step="0.5" value={params.tp} onChange={e => updateParam('tp', e.target.value)}
                    className="w-full bg-muted/20 border border-border/20 rounded px-2 py-1.5 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Position Size (%)</label>
                  <input type="number" step="5" value={params.posSize} onChange={e => updateParam('posSize', e.target.value)}
                    className="w-full bg-muted/20 border border-border/20 rounded px-2 py-1.5 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Leverage</label>
                  <input type="number" value={params.leverage} onChange={e => updateParam('leverage', e.target.value)}
                    className="w-full bg-muted/20 border border-border/20 rounded px-2 py-1.5 text-sm font-mono" />
                </div>
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
          </div>
        ) : (
          <div className="space-y-4">
            {/* Success Header */}
            <div className="flex items-center text-success">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">Backtest completed — {backtestResult.stats.totalTrades} trades</span>
            </div>

            {/* Params used */}
            {(backtestResult as any).params && (
              <div className="text-xs text-muted-foreground bg-muted/10 rounded p-2 font-mono flex flex-wrap gap-x-3">
                <span>LB={((backtestResult as any).params.lookback)}</span>
                <span>Vol={((backtestResult as any).params.volMult)}x</span>
                <span>SL={((backtestResult as any).params.sl * 100).toFixed(1)}%</span>
                <span>TP={((backtestResult as any).params.tp * 100).toFixed(1)}%</span>
                <span>Size={((backtestResult as any).params.posSize * 100).toFixed(0)}%</span>
                <span>Lev={((backtestResult as any).params.leverage)}x</span>
              </div>
            )}

            {/* Equity Curve */}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={backtestResult.equity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                  <XAxis dataKey="time" stroke="#666666" fontSize={10} tick={{ fontSize: 10 }} />
                  <YAxis stroke="#666666" fontSize={10} tick={{ fontSize: 10 }} domain={['dataMin - 100', 'dataMax + 100']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1a1a2e', borderRadius: '8px', color: '#ffffff', fontSize: '12px' }}
                    labelStyle={{ color: '#a1a1aa', fontSize: '11px' }}
                    formatter={(value: any) => [`$${Number(value || 0).toLocaleString()}`, 'Equity']}
                  />
                  <Line type="monotone" dataKey="equity" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Return</div>
                <div className={`font-mono font-medium ${Number(backtestResult.stats.totalPnLPercent || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {Number(backtestResult.stats.totalPnLPercent || 0) >= 0 ? '+' : ''}{Number(backtestResult.stats.totalPnLPercent || 0).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Win Rate</div>
                <div className="font-mono font-medium">{Number(backtestResult.stats.winRate || 0).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Max DD</div>
                <div className="font-mono font-medium text-destructive">-{Number(backtestResult.stats.maxDrawdown || 0).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">PF</div>
                <div className={`font-mono font-medium ${Number(backtestResult.stats.profitFactor || 0) >= 1 ? 'text-success' : 'text-destructive'}`}>
                  {Number(backtestResult.stats.profitFactor || 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Sharpe</div>
                <div className={`font-mono font-medium ${Number(backtestResult.stats.sharpeRatio || 0) >= 1 ? 'text-success' : 'text-yellow-500'}`}>
                  {Number(backtestResult.stats.sharpeRatio || 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">P&L</div>
                <div className={`font-mono font-medium ${Number(backtestResult.stats.totalPnL || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                  ${Number(backtestResult.stats.totalPnL || 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Period Info */}
            <div className="text-xs text-muted-foreground border-t border-border/20 pt-2 flex justify-between">
              <span>{new Date(backtestResult.period.start).toLocaleDateString()} → {new Date(backtestResult.period.end).toLocaleDateString()}</span>
            </div>

            {/* Run New Test */}
            <button onClick={() => window.location.reload()} className="btn btn-secondary w-full text-sm">
              <RotateCcw className="h-3.5 w-3.5 mr-2" />
              New Backtest
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
