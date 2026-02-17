import type { MonthlyReturn } from '../types'

interface Props {
  data: MonthlyReturn[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function MonthlyHeatmap({ data }: Props) {
  const years = [...new Set(data.map(d => d.year))].sort()
  const lookup = new Map(data.map(d => [`${d.year}-${d.month}`, d]))

  const getColor = (pct: number) => {
    if (pct > 10) return 'bg-green-500/80'
    if (pct > 5) return 'bg-green-500/50'
    if (pct > 0) return 'bg-green-500/25'
    if (pct === 0) return 'bg-muted'
    if (pct > -5) return 'bg-red-500/25'
    if (pct > -10) return 'bg-red-500/50'
    return 'bg-red-500/80'
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left text-muted-foreground p-1 w-16">Year</th>
            {MONTHS.map(m => <th key={m} className="text-center text-muted-foreground p-1">{m}</th>)}
          </tr>
        </thead>
        <tbody>
          {years.map(year => (
            <tr key={year}>
              <td className="text-muted-foreground font-medium p-1">{year}</td>
              {MONTHS.map((_, mi) => {
                const d = lookup.get(`${year}-${mi + 1}`)
                if (!d) return <td key={mi} className="p-1"><div className="h-8 rounded bg-muted/30" /></td>
                return (
                  <td key={mi} className="p-1">
                    <div className={`h-8 rounded flex items-center justify-center font-medium ${getColor(d.returnPct)} ${d.returnPct >= 0 ? 'text-green-300' : 'text-red-300'}`}
                      title={`${MONTHS[mi]} ${year}: ${d.returnPct}% (${d.trades} trades)`}>
                      {d.returnPct > 0 ? '+' : ''}{d.returnPct}%
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
