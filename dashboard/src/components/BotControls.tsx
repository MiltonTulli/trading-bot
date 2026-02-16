import { useState } from 'react'
import { Play, Square, Settings, AlertCircle } from 'lucide-react'
import { useBotStatus, useBotControls } from '../hooks/useApi'

export function BotControls() {
  const { data: status, refetch } = useBotStatus()
  const { startBot, stopBot, loading, error } = useBotControls()
  const [mode, setMode] = useState<'paper' | 'live'>('paper')

  const handleStart = async () => {
    await startBot(mode)
    setTimeout(refetch, 1000) // Refetch status after a short delay
  }

  const handleStop = async () => {
    await stopBot()
    setTimeout(refetch, 1000)
  }

  const isRunning = status?.status === 'running' || status?.status === 'paper'

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Settings className="h-5 w-5 mr-2 text-primary" />
          Bot Controls
        </h3>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
          status?.status === 'running' ? 'bg-success/20 text-success' :
          status?.status === 'paper' ? 'bg-yellow-500/20 text-yellow-500' :
          'bg-destructive/20 text-destructive'
        }`}>
          {status?.status === 'running' ? 'LIVE' :
           status?.status === 'paper' ? 'PAPER' :
           'STOPPED'}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/20 border border-destructive/20 rounded-md flex items-center">
          <AlertCircle className="h-4 w-4 text-destructive mr-2" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Mode Selection */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Trading Mode
          </label>
          <div className="flex space-x-2">
            <button
              onClick={() => setMode('paper')}
              className={`btn btn-sm flex-1 ${mode === 'paper' ? 'btn-primary' : 'btn-secondary'}`}
              disabled={isRunning}
            >
              Paper Trading
            </button>
            <button
              onClick={() => setMode('live')}
              className={`btn btn-sm flex-1 ${mode === 'live' ? 'btn-destructive' : 'btn-secondary'}`}
              disabled={isRunning}
            >
              Live Trading
            </button>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex space-x-2">
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={loading}
              className="btn btn-success flex-1 flex items-center justify-center"
            >
              <Play className="h-4 w-4 mr-2" />
              {loading ? 'Starting...' : 'Start Bot'}
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              className="btn btn-destructive flex-1 flex items-center justify-center"
            >
              <Square className="h-4 w-4 mr-2" />
              {loading ? 'Stopping...' : 'Stop Bot'}
            </button>
          )}
        </div>

        {/* Status Info */}
        <div className="text-sm text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Balance:</span>
            <span className="font-mono">${status?.balance.toLocaleString() || '0'}</span>
          </div>
          <div className="flex justify-between">
            <span>Equity:</span>
            <span className="font-mono">${status?.equity.toLocaleString() || '0'}</span>
          </div>
          <div className="flex justify-between">
            <span>Last Update:</span>
            <span>
              {status?.lastUpdated 
                ? new Date(status.lastUpdated).toLocaleTimeString()
                : 'Never'
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}