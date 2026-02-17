import type { SimulationStats } from '../types'
import { TrendingUp, TrendingDown, Target, BarChart3, AlertTriangle, Zap } from 'lucide-react'

interface Props {
  stats: SimulationStats
}

export default function StatsCards({ stats }: Props) {
  const cards = [
    { label: 'Total Return', value: `${stats.totalReturn >= 0 ? '+' : ''}${stats.totalReturn}%`, color: stats.totalReturn >= 0 ? 'text-success' : 'text-destructive', icon: stats.totalReturn >= 0 ? TrendingUp : TrendingDown },
    { label: 'Win Rate', value: `${stats.winRate}%`, color: stats.winRate >= 50 ? 'text-success' : 'text-destructive', icon: Target },
    { label: 'Total Trades', value: stats.totalTrades.toString(), color: 'text-primary', icon: BarChart3 },
    { label: 'Profit Factor', value: stats.profitFactor.toString(), color: stats.profitFactor >= 1 ? 'text-success' : 'text-destructive', icon: Zap },
    { label: 'Max Drawdown', value: `${stats.maxDrawdown}%`, color: 'text-destructive', icon: AlertTriangle },
    { label: 'Sharpe Ratio', value: stats.sharpeRatio.toString(), color: stats.sharpeRatio >= 1 ? 'text-success' : 'text-muted-foreground', icon: BarChart3 },
    { label: 'Avg Win', value: `$${stats.avgWin.toFixed(0)}`, color: 'text-success', icon: TrendingUp },
    { label: 'Avg Loss', value: `$${stats.avgLoss.toFixed(0)}`, color: 'text-destructive', icon: TrendingDown },
    { label: 'Best Month', value: `${stats.bestMonth >= 0 ? '+' : ''}${stats.bestMonth}%`, color: 'text-success', icon: TrendingUp },
    { label: 'Worst Month', value: `${stats.worstMonth >= 0 ? '+' : ''}${stats.worstMonth}%`, color: 'text-destructive', icon: TrendingDown },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map(({ label, value, color, icon: Icon }) => (
        <div key={label} className="card p-3">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-3.5 h-3.5 ${color}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
          <div className={`text-lg font-bold ${color}`}>{value}</div>
        </div>
      ))}
    </div>
  )
}
