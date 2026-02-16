import { TrendingUp, TrendingDown, Clock, DollarSign } from 'lucide-react'
import { useBotStatus } from '../hooks/useApi'

export function PositionCard() {
  const { data: status } = useBotStatus()
  const position = status?.currentPosition

  if (!position) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Current Position</h3>
          <div className="px-2 py-1 rounded-full text-xs font-medium bg-muted/20 text-muted-foreground">
            NO POSITION
          </div>
        </div>
        <div className="text-center py-8">
          <div className="text-muted-foreground mb-2">No active position</div>
          <div className="text-sm text-muted-foreground">
            The bot is currently not holding any positions
          </div>
        </div>
      </div>
    )
  }

  const isLong = position.direction === 'long'
  const pnlColor = position.unrealizedPnL >= 0 ? 'text-success' : 'text-destructive'
  
  // Calculate hours since entry
  const hoursSinceEntry = Math.floor(
    (new Date().getTime() - new Date(position.entryTime).getTime()) / (1000 * 60 * 60)
  )

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Current Position</h3>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
          isLong ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
        }`}>
          {position.direction.toUpperCase()}
        </div>
      </div>

      <div className="space-y-4">
        {/* Symbol and Direction */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {isLong ? (
              <TrendingUp className="h-5 w-5 text-success mr-2" />
            ) : (
              <TrendingDown className="h-5 w-5 text-destructive mr-2" />
            )}
            <span className="font-medium text-lg">{position.symbol}</span>
          </div>
          <div className={`text-lg font-bold ${pnlColor}`}>
            {position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(2)}
          </div>
        </div>

        {/* Position Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">Entry Price</div>
            <div className="font-mono font-medium">${position.entryPrice.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Quantity</div>
            <div className="font-mono font-medium">{position.quantity}</div>
          </div>
        </div>

        {/* Time and Duration */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center text-muted-foreground">
            <Clock className="h-4 w-4 mr-1" />
            <span>
              {hoursSinceEntry}h ago
            </span>
          </div>
          <div className="text-muted-foreground">
            {new Date(position.entryTime).toLocaleDateString()}
          </div>
        </div>

        {/* Position Value */}
        <div className="pt-2 border-t border-border/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-muted-foreground">
              <DollarSign className="h-4 w-4 mr-1" />
              <span>Position Value</span>
            </div>
            <div className="font-mono font-medium">
              ${(position.entryPrice * position.quantity).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}