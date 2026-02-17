import { useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import type { SimulationParams } from '../types'
import { Play, RotateCcw } from 'lucide-react'

const DEFAULTS: SimulationParams = {
  startDate: '2024-01-01',
  endDate: '2025-01-01',
  lookback: 10,
  volMult: 2.0,
  sl: 3,
  tp: 6,
  posSize: 20,
  leverage: 5,
  initialBalance: 10000,
  fee: 0.1,
}

interface Props {
  onRun: (params: SimulationParams) => void
  loading: boolean
}

export default function ConfigPanel({ onRun, loading }: Props) {
  const [params, setParams] = useState<SimulationParams>({ ...DEFAULTS })

  const set = (key: keyof SimulationParams, value: string) => {
    setParams(p => ({ ...p, [key]: key === 'startDate' || key === 'endDate' ? value : Number(value) }))
  }

  const handleRun = () => {
    onRun({
      ...params,
      sl: params.sl / 100,
      tp: params.tp / 100,
      posSize: params.posSize / 100,
      fee: params.fee / 100,
    })
  }

  const reset = () => setParams({ ...DEFAULTS })

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Configuration</h2>

      {/* Date Range */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Date Range</label>
        <div className="grid grid-cols-2 gap-2">
          <DatePicker
            selected={new Date(params.startDate + 'T12:00:00')}
            onChange={(date: Date | null) => date && setParams(p => ({ ...p, startDate: date.toISOString().slice(0, 10) }))}
            dateFormat="yyyy-MM-dd"
            minDate={new Date('2021-01-01T12:00:00')}
            maxDate={new Date(params.endDate + 'T12:00:00')}
            showMonthDropdown
            showYearDropdown
            scrollableYearDropdown
            yearDropdownItemNumber={10}
            dropdownMode="select"
            className="input text-xs w-full"
            calendarClassName="dark-datepicker"
            placeholderText="Start date"
          />
          <DatePicker
            selected={new Date(params.endDate + 'T12:00:00')}
            onChange={(date: Date | null) => date && setParams(p => ({ ...p, endDate: date.toISOString().slice(0, 10) }))}
            dateFormat="yyyy-MM-dd"
            minDate={new Date(params.startDate + 'T12:00:00')}
            maxDate={new Date('2026-02-28T12:00:00')}
            showMonthDropdown
            showYearDropdown
            scrollableYearDropdown
            yearDropdownItemNumber={10}
            dropdownMode="select"
            className="input text-xs w-full"
            calendarClassName="dark-datepicker"
            placeholderText="End date"
          />
        </div>
      </div>

      {/* Strategy Parameters */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Strategy Parameters</label>
        {([
          ['lookback', 'Lookback Periods', 1, 100, 1],
          ['volMult', 'Volume Multiplier', 0.5, 10, 0.1],
          ['sl', 'Stop Loss %', 0.5, 20, 0.5],
          ['tp', 'Take Profit %', 0.5, 50, 0.5],
          ['posSize', 'Position Size %', 5, 100, 5],
          ['leverage', 'Leverage', 1, 50, 1],
          ['initialBalance', 'Initial Balance $', 1000, 1000000, 1000],
          ['fee', 'Fee %', 0, 1, 0.01],
        ] as const).map(([key, label, min, max, step]) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
            <input type="number" value={params[key]} onChange={e => set(key, e.target.value)}
              min={min} max={max} step={step}
              className="input text-xs w-24 text-right" />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button onClick={handleRun} disabled={loading}
          className="btn-primary flex-1 flex items-center justify-center gap-2">
          <Play className="w-4 h-4" />
          {loading ? 'Running...' : 'Run Simulation'}
        </button>
        <button onClick={reset} className="btn-secondary px-3" title="Reset defaults">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
