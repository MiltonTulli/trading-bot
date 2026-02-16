import { Bot, TrendingUp, TrendingDown } from 'lucide-react'
import { useBotStatus } from '../hooks/useApi'

export function StatusBar() {
  const { data: status } = useBotStatus()

  const totalPnL = status?.equity ? status.equity - 10000 : 0 // Assuming 10k starting balance
  const pnlPercent = ((totalPnL / 10000) * 100)

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        {/* Bot Status */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-semibold">Trading Bot</span>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              status?.status === 'running' ? 'bg-success/20 text-success' :
              status?.status === 'paper' ? 'bg-yellow-500/20 text-yellow-500' :
              'bg-destructive/20 text-destructive'
            }`}>
              {status?.status === 'running' ? 'LIVE' :
               status?.status === 'paper' ? 'PAPER' :
               'STOPPED'}
            </div>
          </div>
        </div>

        {/* P&L Summary */}
        <div className="flex items-center space-x-6">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Balance</div>
            <div className="font-mono font-medium">
              ${status?.balance.toLocaleString() || '10,000'}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Total P&L</div>
            <div className={`font-mono font-medium flex items-center ${
              totalPnL >= 0 ? 'text-success' : 'text-destructive'
            }`}>
              {totalPnL >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
            </div>
          </div>

          {/* Current Position */}
          {status?.currentPosition ? (
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Open Position</div>
              <div className={`font-mono font-medium ${
                status.currentPosition.unrealizedPnL >= 0 ? 'text-success' : 'text-destructive'
              }`}>
                {status.currentPosition.direction.toUpperCase()} {status.currentPosition.symbol}
                <br />
                <span className="text-xs">
                  {status.currentPosition.unrealizedPnL >= 0 ? '+' : ''}${status.currentPosition.unrealizedPnL.toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Position</div>
              <div className="font-mono text-muted-foreground">None</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}