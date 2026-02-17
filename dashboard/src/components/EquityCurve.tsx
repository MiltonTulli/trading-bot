import { useEffect, useRef } from 'react'
import { createChart, type IChartApi } from 'lightweight-charts'
import type { EquityPoint } from '../types'

interface Props {
  data: EquityPoint[]
}

export default function EquityCurve({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return

    if (chartRef.current) chartRef.current.remove()

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 300,
      layout: { background: { color: 'transparent' }, textColor: '#a1a1aa', fontSize: 11 },
      grid: { vertLines: { color: '#1a1a2e' }, horzLines: { color: '#1a1a2e' } },
      timeScale: { timeVisible: false },
      rightPriceScale: { borderColor: '#1a1a2e' },
    })
    chartRef.current = chart

    const series = chart.addAreaSeries({
      lineColor: '#3b82f6',
      topColor: 'rgba(59,130,246,0.3)',
      bottomColor: 'rgba(59,130,246,0.02)',
      lineWidth: 2,
    })

    series.setData(data.map(d => ({
      time: d.time.slice(0, 10) as string,
      value: d.balance,
    })))

    chart.timeScale().fitContent()

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)

    return () => { ro.disconnect(); chart.remove() }
  }, [data])

  return <div ref={containerRef} />
}
