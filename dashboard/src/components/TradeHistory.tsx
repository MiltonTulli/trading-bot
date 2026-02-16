import { History, TrendingUp, TrendingDown } from 'lucide-react'
import { useTrades } from '../hooks/useApi'

export function TradeHistory() {
  const { data: trades, loading } = useTrades()

  if (loading) {
    return (
      <div className="card p-4 h-[600px]">
        <div className="flex items-center space-x-2 mb-4">
          <History className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Trade History</h3>
        </div>
        <div className="flex items-center justify-center h-32">
          <div className="text-muted-foreground">Loading trades...</div>
        </div>
      </div>
    )
  }

  const recentTrades = trades?.slice(0, 20) || []
  const totalPnL = recentTrades.reduce((sum, trade) => sum + trade.netPnL, 0)
  const winningTrades = recentTrades.filter(trade => trade.netPnL > 0).length
  const winRate = recentTrades.length > 0 ? (winningTrades / recentTrades.length) * 100 : 0

  return (
    <div className="card p-4 h-[600px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <History className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Trade History</h3>
        </div>
        <div className="text-xs text-muted-foreground">
          Last {recentTrades.length} trades
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-secondary/20 rounded-md">
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Total P&L</div>
          <div className={`font-mono font-medium ${
            totalPnL >= 0 ? 'text-success' : 'text-destructive'
          }`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Win Rate</div>
          <div className="font-mono font-medium">
            {winRate.toFixed(1)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Trades</div>
          <div className="font-mono font-medium">
            {recentTrades.length}
          </div>
        </div>
      </div>

      {/* Trades List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {recentTrades.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No trades yet</p>
            <p className="text-xs">Completed trades will appear here</p>
          </div>
        ) : (
          recentTrades.map((trade) => (
            <div
              key={trade.id}
              className={`p-3 rounded-md border transition-all hover:bg-secondary/10 ${
                trade.netPnL >= 0 ? 'border-success/20 bg-success/5' : 'border-destructive/20 bg-destructive/5'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {trade.direction === 'LONG' ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                  <span className="font-medium text-sm">{trade.symbol}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    trade.direction === 'LONG' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                  }`}>
                    {trade.direction}
                  </span>
                </div>
                <div className={`font-mono font-medium ${
                  trade.netPnL >= 0 ? 'text-success' : 'text-destructive'
                }`}>
                  {trade.netPnL >= 0 ? '+' : ''}${trade.netPnL.toFixed(2)}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div>
                  <span className="block">Entry</span>
                  <span className="font-mono">${trade.entryPrice.toLocaleString()}</span>
                </div>
                <div>
                  <span className="block">Exit</span>
                  <span className="font-mono">${trade.exitPrice.toLocaleString()}</span>
                </div>
                <div>
                  <span className="block">Return</span>
                  <span className={`font-mono ${
                    trade.returnPercent >= 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    {trade.returnPercent >= 0 ? '+' : ''}{trade.returnPercent.toFixed(2)}%
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>
                  {new Date(trade.exitTime).toLocaleDateString()} {new Date(trade.exitTime).toLocaleTimeString()}
                </span>
                {trade.exitReason && (
                  <span className="capitalize">
                    {trade.exitReason.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}