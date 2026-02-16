import { useEffect, useState, useRef } from 'react'
import { Activity, TrendingUp, TrendingDown, Square, AlertCircle } from 'lucide-react'
import { useTrades } from '../hooks/useApi'

interface TradeEvent {
  id: string
  timestamp: string
  type: 'entry' | 'exit' | 'error' | 'status'
  symbol?: string
  direction?: string
  price?: number
  pnl?: number
  reason?: string
  message: string
}

export function EventFeed() {
  const { data: trades } = useTrades()
  const [events, setEvents] = useState<TradeEvent[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Convert trades to events when data changes
  useEffect(() => {
    if (!trades) return

    const newEvents: TradeEvent[] = []

    // Add entry and exit events for each trade
    trades.slice(0, 20).forEach(trade => { // Limit to recent 20 trades
      // Entry event
      newEvents.push({
        id: `${trade.id}-entry`,
        timestamp: trade.entryTime,
        type: 'entry',
        symbol: trade.symbol,
        direction: trade.direction,
        price: trade.entryPrice,
        message: `ENTER ${trade.direction} ${trade.symbol} @ $${trade.entryPrice.toLocaleString()}`
      })

      // Exit event
      newEvents.push({
        id: `${trade.id}-exit`,
        timestamp: trade.exitTime,
        type: 'exit',
        symbol: trade.symbol,
        direction: trade.direction,
        price: trade.exitPrice,
        pnl: trade.netPnL,
        reason: trade.exitReason,
        message: `EXIT ${trade.direction} ${trade.symbol} @ $${trade.exitPrice.toLocaleString()} | P&L: ${trade.netPnL >= 0 ? '+' : ''}$${trade.netPnL.toFixed(2)}`
      })
    })

    // Sort by timestamp (most recent first)
    newEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    setEvents(newEvents.slice(0, 50)) // Keep only 50 most recent events
  }, [trades])

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events])

  const getEventIcon = (event: TradeEvent) => {
    switch (event.type) {
      case 'entry':
        return event.direction === 'LONG' ? 
          <TrendingUp className="h-4 w-4 text-success" /> :
          <TrendingDown className="h-4 w-4 text-destructive" />
      case 'exit':
        return <Square className="h-4 w-4 text-muted-foreground" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      default:
        return <Activity className="h-4 w-4 text-primary" />
    }
  }

  const getEventColor = (event: TradeEvent) => {
    switch (event.type) {
      case 'entry':
        return event.direction === 'LONG' ? 'border-l-success' : 'border-l-destructive'
      case 'exit':
        return event.pnl && event.pnl >= 0 ? 'border-l-success' : 'border-l-destructive'
      case 'error':
        return 'border-l-destructive'
      default:
        return 'border-l-primary'
    }
  }

  return (
    <div className="card p-4 h-[600px] flex flex-col">
      <div className="flex items-center space-x-2 mb-4">
        <Activity className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Live Event Feed</h3>
        <div className="text-xs text-muted-foreground">
          ({events.length} events)
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2 pr-2"
      >
        {events.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No trading events yet</p>
            <p className="text-xs">Events will appear here when trading starts</p>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className={`border-l-4 ${getEventColor(event)} bg-secondary/20 p-3 rounded-r-md transition-all hover:bg-secondary/30`}
            >
              <div className="flex items-start space-x-2">
                {getEventIcon(event)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono">{event.message}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                    {event.reason && (
                      <div className="text-xs text-muted-foreground capitalize">
                        {event.reason.replace(/_/g, ' ')}
                      </div>
                    )}
                  </div>
                  {event.pnl !== undefined && (
                    <div className={`text-xs font-medium mt-1 ${
                      event.pnl >= 0 ? 'text-success' : 'text-destructive'
                    }`}>
                      {event.pnl >= 0 ? 'Profit' : 'Loss'}: {event.pnl >= 0 ? '+' : ''}${Math.abs(event.pnl).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Auto-refresh indicator */}
      <div className="text-xs text-muted-foreground text-center mt-2 pt-2 border-t border-border/20">
        Refreshes automatically • Latest events at bottom
      </div>
    </div>
  )
}