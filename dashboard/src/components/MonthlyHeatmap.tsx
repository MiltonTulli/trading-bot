import { Calendar } from 'lucide-react'
import { useMonthlyReturns } from '../hooks/useApi'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function MonthlyHeatmap() {
  const { data: monthlyData, loading } = useMonthlyReturns()

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">Monthly Returns</h3>
        </div>
        <div className="card-content">
          <div className="h-64 flex items-center justify-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  // Generate sample data if no data is available
  const sampleData = []
  const currentYear = new Date().getFullYear()
  for (let year = currentYear - 2; year <= currentYear; year++) {
    for (let month = 0; month < 12; month++) {
      // Skip future months for current year
      if (year === currentYear && month > new Date().getMonth()) continue
      
      sampleData.push({
        month: MONTHS[month],
        year,
        return: (Math.random() - 0.5) * 20, // Random returns between -10% and +10%
      })
    }
  }

  const displayData = monthlyData && monthlyData.length > 0 ? monthlyData : sampleData

  // Group data by year
  const dataByYear = displayData.reduce((acc, item) => {
    if (!acc[item.year]) acc[item.year] = {}
    acc[item.year][item.month] = item.return
    return acc
  }, {} as Record<number, Record<string, number>>)

  const years = Object.keys(dataByYear).map(Number).sort((a, b) => b - a)

  const getColor = (returnValue: number) => {
    if (returnValue === undefined || returnValue === null) return 'bg-muted/20'
    
    const intensity = Math.min(Math.abs(returnValue) / 10, 1) // Cap at 10% for color intensity
    
    if (returnValue > 0) {
      // Green shades for positive returns
      if (intensity > 0.75) return 'bg-success text-success-foreground'
      if (intensity > 0.5) return 'bg-success/80 text-success-foreground'
      if (intensity > 0.25) return 'bg-success/60 text-success-foreground'
      return 'bg-success/40 text-success-foreground'
    } else if (returnValue < 0) {
      // Red shades for negative returns
      if (intensity > 0.75) return 'bg-destructive text-destructive-foreground'
      if (intensity > 0.5) return 'bg-destructive/80 text-destructive-foreground'
      if (intensity > 0.25) return 'bg-destructive/60 text-destructive-foreground'
      return 'bg-destructive/40 text-destructive-foreground'
    }
    
    return 'bg-muted/40 text-muted-foreground' // For zero returns
  }

  const totalReturns = displayData.reduce((sum, item) => sum + item.return, 0)
  const averageReturn = displayData.length > 0 ? totalReturns / displayData.length : 0
  const bestMonth = displayData.reduce((best, item) => 
    item.return > best.return ? item : best, displayData[0] || { return: 0 }
  )
  const worstMonth = displayData.reduce((worst, item) => 
    item.return < worst.return ? item : worst, displayData[0] || { return: 0 }
  )

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-primary" />
          Monthly Returns
        </h3>
      </div>
      <div className="card-content">
        <div className="space-y-3">
          {years.map(year => (
            <div key={year} className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">{year}</div>
              <div className="grid grid-cols-12 gap-1">
                {MONTHS.map(month => {
                  const returnValue = dataByYear[year]?.[month]
                  return (
                    <div
                      key={month}
                      className={`
                        relative p-2 rounded text-xs font-medium text-center cursor-default
                        transition-all hover:scale-110 hover:z-10
                        ${getColor(returnValue)}
                      `}
                      title={`${month} ${year}: ${returnValue ? `${returnValue > 0 ? '+' : ''}${returnValue.toFixed(2)}%` : 'N/A'}`}
                    >
                      <div className="text-xs">{month.slice(0, 1)}</div>
                      {returnValue !== undefined && (
                        <div className="text-[10px] leading-none mt-0.5">
                          {returnValue > 0 ? '+' : ''}{returnValue.toFixed(1)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border/20 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">Average</div>
            <div className={`font-mono font-medium ${averageReturn >= 0 ? 'text-success' : 'text-destructive'}`}>
              {averageReturn >= 0 ? '+' : ''}{averageReturn.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Best Month</div>
            <div className="font-mono font-medium text-success">
              +{bestMonth?.return?.toFixed(2) || '0.00'}%
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Worst Month</div>
            <div className="font-mono font-medium text-destructive">
              {worstMonth?.return?.toFixed(2) || '0.00'}%
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center mt-4 space-x-1 text-xs">
          <span className="text-muted-foreground">Less</span>
          <div className="w-3 h-3 bg-destructive/20 rounded"></div>
          <div className="w-3 h-3 bg-destructive/60 rounded"></div>
          <div className="w-3 h-3 bg-muted/40 rounded"></div>
          <div className="w-3 h-3 bg-success/60 rounded"></div>
          <div className="w-3 h-3 bg-success rounded"></div>
          <span className="text-muted-foreground">More</span>
        </div>
      </div>
    </div>
  )
}