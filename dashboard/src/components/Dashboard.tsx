import { StatsCards } from './StatsCards'
import { BotControls } from './BotControls'
import { CandlestickChart } from './CandlestickChart'
import { EquityCurve } from './EquityCurve'
import { TradesTable } from './TradesTable'
import { MonthlyHeatmap } from './MonthlyHeatmap'
import { PositionCard } from './PositionCard'
import { BacktestPanel } from './BacktestPanel'

export function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Controls and Position */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <BotControls />
        <PositionCard />
        <div className="lg:col-span-1">
          {/* This space can be used for additional controls or info */}
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards />

      {/* Main Chart and Equity Curve */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <CandlestickChart />
        </div>
        <div className="xl:col-span-1">
          <EquityCurve />
        </div>
      </div>

      {/* Monthly Returns and Backtest */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <MonthlyHeatmap />
        <BacktestPanel />
      </div>

      {/* Trades Table */}
      <TradesTable />
    </div>
  )
}