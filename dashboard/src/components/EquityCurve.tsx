import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { useEquity } from '../hooks/useApi'

export function EquityCurve() {
  const { data: equityData, loading } = useEquity()

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">Equity Curve</h3>
        </div>
        <div className="card-content">
          <div className="h-80 flex items-center justify-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!equityData || equityData.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">Equity Curve</h3>
        </div>
        <div className="card-content">
          <div className="h-80 flex items-center justify-center">
            <div className="text-muted-foreground">No equity data available</div>
          </div>
        </div>
      </div>
    )
  }

  // Transform data for chart
  const chartData = equityData.map(point => ({
    time: new Date(point.time).toLocaleDateString(),
    timestamp: new Date(point.time).getTime(),
    equity: point.equity,
    drawdown: Math.abs(point.drawdown), // Make positive for display
  }))

  const currentEquity = Number(equityData[equityData.length - 1]?.equity || 0)
  const initialEquity = Number(equityData[0]?.equity || 10000)
  const totalReturn = initialEquity > 0 ? ((currentEquity - initialEquity) / initialEquity) * 100 : 0
  const maxDrawdown = equityData.length > 0 ? Math.max(...equityData.map(p => Math.abs(Number(p.drawdown || 0)))) : 0

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-primary" />
            Equity Curve
          </h3>
          <div className="text-right text-sm">
            <div className={`font-mono ${totalReturn >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalReturn >= 0 ? '+' : ''}{(totalReturn || 0).toFixed(2)}%
            </div>
            <div className="text-muted-foreground">
              Max DD: -{(maxDrawdown || 0).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
      <div className="card-content">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
              <XAxis 
                dataKey="time" 
                stroke="#666666"
                fontSize={12}
              />
              <YAxis 
                stroke="#666666"
                fontSize={12}
                domain={['dataMin - 100', 'dataMax + 100']}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#12121a', 
                  border: '1px solid #1a1a2e',
                  borderRadius: '8px',
                  color: '#ffffff'
                }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(value: any, name: string) => [
                  name === 'equity' ? `$${Number(value || 0).toLocaleString()}` : `${Number(value || 0).toFixed(2)}%`,
                  name === 'equity' ? 'Equity' : 'Drawdown'
                ]}
              />
              
              {/* Drawdown area (negative space) */}
              <Area
                dataKey="drawdown"
                type="monotone"
                stroke="#ef4444"
                fill="#ef444440"
                fillOpacity={0.3}
                strokeWidth={1}
                yAxisId="right"
              />
              
              {/* Equity line */}
              <Line
                type="monotone"
                dataKey="equity"
                stroke="#22c55e"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: '#22c55e' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/20 text-sm">
          <div>
            <div className="text-muted-foreground">Current Equity</div>
            <div className="font-mono font-medium">${(currentEquity || 0).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Initial Balance</div>
            <div className="font-mono font-medium">${(initialEquity || 0).toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  )
}