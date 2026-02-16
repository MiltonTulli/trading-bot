import { TrendingUp, TrendingDown, Target, Calendar, BarChart3, AlertTriangle } from 'lucide-react'
import { useStats } from '../hooks/useApi'

export function StatsCards() {
  const { data: stats, loading } = useStats()

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="h-4 bg-muted rounded mb-2" />
            <div className="h-8 bg-muted rounded mb-1" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  const totalPnL = Number(stats?.totalPnL || 0)
  const totalPnLPercent = Number(stats?.totalPnLPercent || 0)
  const winRate = Number(stats?.winRate || 0)
  const currentMonthReturn = Number(stats?.currentMonthReturn || 0)
  const sharpeRatio = Number(stats?.sharpeRatio || 0)
  const maxDrawdown = Number(stats?.maxDrawdown || 0)

  const cards = [
    {
      title: 'Total P&L',
      value: `$${(totalPnL || 0).toLocaleString()}`,
      subtitle: `${totalPnLPercent >= 0 ? '+' : ''}${(totalPnLPercent || 0).toFixed(2)}%`,
      icon: totalPnL >= 0 ? TrendingUp : TrendingDown,
      color: totalPnL >= 0 ? 'text-success' : 'text-destructive'
    },
    {
      title: 'Win Rate',
      value: `${(winRate || 0).toFixed(1)}%`,
      subtitle: `${stats?.winningTrades || 0}/${stats?.totalTrades || 0} trades`,
      icon: Target,
      color: winRate >= 50 ? 'text-success' : 'text-destructive'
    },
    {
      title: 'Total Trades',
      value: (stats?.totalTrades || 0).toString(),
      subtitle: `${stats?.winningTrades || 0} wins, ${stats?.losingTrades || 0} losses`,
      icon: BarChart3,
      color: 'text-primary'
    },
    {
      title: 'Monthly Return',
      value: `${currentMonthReturn >= 0 ? '+' : ''}${(currentMonthReturn || 0).toFixed(2)}%`,
      subtitle: 'This month',
      icon: Calendar,
      color: currentMonthReturn >= 0 ? 'text-success' : 'text-destructive'
    },
    {
      title: 'Sharpe Ratio',
      value: (sharpeRatio || 0).toFixed(2),
      subtitle: 'Risk-adjusted return',
      icon: TrendingUp,
      color: sharpeRatio >= 1 ? 'text-success' : sharpeRatio >= 0.5 ? 'text-yellow-500' : 'text-destructive'
    },
    {
      title: 'Max Drawdown',
      value: `-${(maxDrawdown || 0).toFixed(2)}%`,
      subtitle: 'Peak to trough',
      icon: AlertTriangle,
      color: 'text-destructive'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card, index) => (
        <div key={index} className="card p-4 transition-all hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">{card.title}</h3>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </div>
          <div className="space-y-1">
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.subtitle}</p>
          </div>
        </div>
      ))}
    </div>
  )
}