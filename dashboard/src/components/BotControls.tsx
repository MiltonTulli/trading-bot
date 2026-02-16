import { useState } from 'react'
import { Play, Square, Settings, AlertCircle } from 'lucide-react'
import { useBotStatus, useBotControls } from '../hooks/useApi'

export function BotControls() {
  const { data: status, refetch } = useBotStatus()
  const { startBot, stopBot, loading, error } = useBotControls()
  
  // Trading parameters
  const [params, setParams] = useState({
    symbol: 'BTCUSDT',
    timeframe: '4h',
    stopLoss: 3,
    takeProfit: 6,
    positionSize: 20,
    leverage: 5,
    lookback: 10,
    volMultiplier: 2.0
  })
  
  const [mode, setMode] = useState<'paper' | 'live'>('paper')

  const isRunning = status?.status === 'running' || status?.status === 'paper'

  const handleStart = async () => {
    await startBot(mode, params)
    setTimeout(refetch, 1000)
  }

  const handleStop = async () => {
    await stopBot()
    setTimeout(refetch, 1000)
  }

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center space-x-2">
        <Settings className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Bot Configuration</h3>
      </div>

      {error && (
        <div className="p-3 bg-destructive/20 border border-destructive/20 rounded-md flex items-center">
          <AlertCircle className="h-4 w-4 text-destructive mr-2" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* Trading Mode */}
      <div>
        <label className="block text-sm font-medium mb-2">Trading Mode</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('paper')}
            disabled={isRunning}
            className={`btn ${mode === 'paper' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Paper Trading
          </button>
          <button
            onClick={() => setMode('live')}
            disabled={isRunning}
            className={`btn ${mode === 'live' ? 'btn-destructive' : 'btn-secondary'}`}
          >
            Live Trading
          </button>
        </div>
      </div>

      {/* Trading Parameters */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Strategy Parameters</h4>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Symbol</label>
            <select
              value={params.symbol}
              onChange={(e) => setParams(prev => ({ ...prev, symbol: e.target.value }))}
              disabled={isRunning}
              className="input text-sm"
            >
              <option value="BTCUSDT">BTC/USDT</option>
              <option value="ETHUSDT">ETH/USDT</option>
            </select>
          </div>
          
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Timeframe</label>
            <select
              value={params.timeframe}
              onChange={(e) => setParams(prev => ({ ...prev, timeframe: e.target.value }))}
              disabled={isRunning}
              className="input text-sm"
            >
              <option value="1h">1h</option>
              <option value="4h">4h</option>
              <option value="1d">1d</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Stop Loss (%)</label>
            <input
              type="number"
              value={params.stopLoss}
              onChange={(e) => setParams(prev => ({ ...prev, stopLoss: parseFloat(e.target.value) }))}
              disabled={isRunning}
              step="0.1"
              min="0.1"
              max="10"
              className="input text-sm"
            />
          </div>
          
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Take Profit (%)</label>
            <input
              type="number"
              value={params.takeProfit}
              onChange={(e) => setParams(prev => ({ ...prev, takeProfit: parseFloat(e.target.value) }))}
              disabled={isRunning}
              step="0.1"
              min="0.1"
              max="20"
              className="input text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Position Size (%)</label>
            <input
              type="number"
              value={params.positionSize}
              onChange={(e) => setParams(prev => ({ ...prev, positionSize: parseFloat(e.target.value) }))}
              disabled={isRunning}
              step="1"
              min="1"
              max="100"
              className="input text-sm"
            />
          </div>
          
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Leverage</label>
            <input
              type="number"
              value={params.leverage}
              onChange={(e) => setParams(prev => ({ ...prev, leverage: parseFloat(e.target.value) }))}
              disabled={isRunning}
              step="1"
              min="1"
              max="20"
              className="input text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Lookback Periods</label>
            <input
              type="number"
              value={params.lookback}
              onChange={(e) => setParams(prev => ({ ...prev, lookback: parseInt(e.target.value) }))}
              disabled={isRunning}
              step="1"
              min="5"
              max="50"
              className="input text-sm"
            />
          </div>
          
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Vol Multiplier</label>
            <input
              type="number"
              value={params.volMultiplier}
              onChange={(e) => setParams(prev => ({ ...prev, volMultiplier: parseFloat(e.target.value) }))}
              disabled={isRunning}
              step="0.1"
              min="0.5"
              max="5"
              className="input text-sm"
            />
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="pt-4 border-t border-border/20">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={loading}
            className="btn btn-success w-full flex items-center justify-center"
          >
            <Play className="h-4 w-4 mr-2" />
            {loading ? 'Starting...' : `Start ${mode === 'live' ? 'Live' : 'Paper'} Trading`}
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={loading}
            className="btn btn-destructive w-full flex items-center justify-center"
          >
            <Square className="h-4 w-4 mr-2" />
            {loading ? 'Stopping...' : 'Stop Trading'}
          </button>
        )}
      </div>
    </div>
  )
}