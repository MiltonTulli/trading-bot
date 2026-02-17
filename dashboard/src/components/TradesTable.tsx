import { useState } from 'react'
import type { Trade } from '../types'

interface Props {
  trades: Trade[]
}

export default function TradesTable({ trades }: Props) {
  const [page, setPage] = useState(0)
  const perPage = 20
  const totalPages = Math.ceil(trades.length / perPage)
  const slice = trades.slice(page * perPage, (page + 1) * perPage)

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border/30">
              {['#', 'Side', 'Entry', 'Exit', 'Entry Time', 'Exit Time', 'PnL', 'PnL %', 'Duration', 'Reason'].map(h => (
                <th key={h} className="text-left p-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map(t => (
              <tr key={t.id} className="border-b border-border/10 hover:bg-muted/30">
                <td className="p-2 text-muted-foreground">{t.id}</td>
                <td className={`p-2 font-medium ${t.side === 'LONG' ? 'text-success' : 'text-destructive'}`}>{t.side}</td>
                <td className="p-2">${t.entryPrice.toFixed(0)}</td>
                <td className="p-2">${t.exitPrice.toFixed(0)}</td>
                <td className="p-2 text-muted-foreground">{t.entryTime.slice(0, 10)}</td>
                <td className="p-2 text-muted-foreground">{t.exitTime.slice(0, 10)}</td>
                <td className={`p-2 font-medium ${t.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                </td>
                <td className={`p-2 ${t.pnlPct >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct}%
                </td>
                <td className="p-2 text-muted-foreground">{t.duration}</td>
                <td className={`p-2 font-medium ${t.reason === 'TP' ? 'text-success' : 'text-destructive'}`}>{t.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="btn-secondary btn-sm">Prev</button>
          <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="btn-secondary btn-sm">Next</button>
        </div>
      )}
    </div>
  )
}
