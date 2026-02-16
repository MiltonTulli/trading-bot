import { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, ArrowUpDown, List } from 'lucide-react'
import { useTrades } from '../hooks/useApi'

type SortField = 'exitTime' | 'symbol' | 'direction' | 'netPnL' | 'returnPercent' | 'duration'
type SortDirection = 'asc' | 'desc'

export function TradesTable() {
  const { data: trades, loading } = useTrades()
  const [sortField, setSortField] = useState<SortField>('exitTime')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filterDirection, setFilterDirection] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL')

  const sortedAndFilteredTrades = useMemo(() => {
    if (!trades) return []

    let filtered = trades
    if (filterDirection !== 'ALL') {
      filtered = trades.filter(trade => trade.direction === filterDirection)
    }

    return filtered.sort((a, b) => {
      let aVal: any = a[sortField]
      let bVal: any = b[sortField]

      // Handle date sorting
      if (sortField === 'exitTime') {
        aVal = new Date(aVal).getTime()
        bVal = new Date(bVal).getTime()
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })
  }, [trades, sortField, sortDirection, filterDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">Trade History</h3>
        </div>
        <div className="card-content">
          <div className="h-64 flex items-center justify-center">
            <div className="text-muted-foreground">Loading trades...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!trades || trades.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold flex items-center">
            <List className="h-5 w-5 mr-2 text-primary" />
            Trade History
          </h3>
        </div>
        <div className="card-content">
          <div className="h-64 flex items-center justify-center">
            <div className="text-muted-foreground">No trades found</div>
          </div>
        </div>
      </div>
    )
  }

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 hover:text-primary transition-colors"
    >
      <span>{children}</span>
      <ArrowUpDown className="h-3 w-3" />
    </button>
  )

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center">
            <List className="h-5 w-5 mr-2 text-primary" />
            Trade History ({sortedAndFilteredTrades.length} trades)
          </h3>
          
          {/* Filter buttons */}
          <div className="flex space-x-1">
            {['ALL', 'LONG', 'SHORT'].map(filter => (
              <button
                key={filter}
                onClick={() => setFilterDirection(filter as any)}
                className={`btn btn-sm ${filterDirection === filter ? 'btn-primary' : 'btn-secondary'}`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="card-content">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/20 text-sm text-muted-foreground">
                <th className="text-left py-3 px-2">
                  <SortButton field="direction">Direction</SortButton>
                </th>
                <th className="text-left py-3 px-2">
                  <SortButton field="symbol">Symbol</SortButton>
                </th>
                <th className="text-right py-3 px-2">Entry Price</th>
                <th className="text-right py-3 px-2">Exit Price</th>
                <th className="text-right py-3 px-2">
                  <SortButton field="netPnL">P&L ($)</SortButton>
                </th>
                <th className="text-right py-3 px-2">
                  <SortButton field="returnPercent">P&L (%)</SortButton>
                </th>
                <th className="text-right py-3 px-2">
                  <SortButton field="duration">Duration</SortButton>
                </th>
                <th className="text-right py-3 px-2">
                  <SortButton field="exitTime">Exit Time</SortButton>
                </th>
                <th className="text-left py-3 px-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {sortedAndFilteredTrades.map((trade) => (
                <tr 
                  key={trade.id} 
                  className={`
                    border-b border-border/10 hover:bg-muted/20 transition-colors
                    ${trade.netPnL >= 0 ? 'hover:bg-success/5' : 'hover:bg-destructive/5'}
                  `}
                >
                  <td className="py-3 px-2">
                    <div className="flex items-center">
                      {trade.direction === 'LONG' ? (
                        <TrendingUp className="h-4 w-4 text-success mr-2" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-destructive mr-2" />
                      )}
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        trade.direction === 'LONG' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                      }`}>
                        {trade.direction}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-2 font-medium">{trade.symbol}</td>
                  <td className="py-3 px-2 text-right font-mono text-sm">
                    ${Number(trade.entryPrice || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-sm">
                    ${Number(trade.exitPrice || 0).toLocaleString()}
                  </td>
                  <td className={`py-3 px-2 text-right font-mono text-sm font-medium ${
                    Number(trade.netPnL || 0) >= 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    {Number(trade.netPnL || 0) >= 0 ? '+' : ''}${Number(trade.netPnL || 0).toFixed(2)}
                  </td>
                  <td className={`py-3 px-2 text-right font-mono text-sm font-medium ${
                    Number(trade.returnPercent || 0) >= 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    {Number(trade.returnPercent || 0) >= 0 ? '+' : ''}{Number(trade.returnPercent || 0).toFixed(2)}%
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-sm">
                    {trade.duration ? `${Number(trade.duration || 0).toFixed(1)}h` : 'N/A'}
                  </td>
                  <td className="py-3 px-2 text-right text-sm text-muted-foreground">
                    {new Date(trade.exitTime).toLocaleDateString()}
                    <br />
                    <span className="text-xs">
                      {new Date(trade.exitTime).toLocaleTimeString()}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-sm text-muted-foreground">
                    {trade.exitReason?.replace(/_/g, ' ') || 'Manual'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Summary stats */}
        {sortedAndFilteredTrades.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t border-border/20 text-sm">
            <div>
              <div className="text-muted-foreground mb-1">Total P&L</div>
              <div className={`font-mono font-medium ${
                sortedAndFilteredTrades.reduce((sum, t) => sum + Number(t.netPnL || 0), 0) >= 0 ? 'text-success' : 'text-destructive'
              }`}>
                ${sortedAndFilteredTrades.reduce((sum, t) => sum + Number(t.netPnL || 0), 0).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Win Rate</div>
              <div className="font-mono font-medium">
                {sortedAndFilteredTrades.length > 0 
                  ? ((sortedAndFilteredTrades.filter(t => Number(t.netPnL || 0) > 0).length / sortedAndFilteredTrades.length) * 100).toFixed(1)
                  : '0.0'
                }%
              </div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Avg Win</div>
              <div className="font-mono font-medium text-success">
                $
                {(() => {
                  const wins = sortedAndFilteredTrades.filter(t => Number(t.netPnL || 0) > 0)
                  return wins.length > 0 
                    ? (wins.reduce((sum, t) => sum + Number(t.netPnL || 0), 0) / wins.length).toFixed(2)
                    : '0.00'
                })()}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Avg Loss</div>
              <div className="font-mono font-medium text-destructive">
                $
                {(() => {
                  const losses = sortedAndFilteredTrades.filter(t => Number(t.netPnL || 0) < 0)
                  return losses.length > 0 
                    ? (losses.reduce((sum, t) => sum + Number(t.netPnL || 0), 0) / losses.length).toFixed(2)
                    : '0.00'
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}