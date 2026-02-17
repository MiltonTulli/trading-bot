import { useEffect, useRef } from 'react'
import { createChart, type IChartApi } from 'lightweight-charts'
import type { Trade } from '../types'

interface Props {
  candles: number[][]
  trades: Trade[]
}

export default function CandlestickChart({ candles, trades }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return
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

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    candleSeries.setData(candles.map(c => ({
      time: (c[0] / 1000) as any,
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
    })))

    // Trade markers
    const markers = trades.flatMap(t => {
      const entryTime = (new Date(t.entryTime).getTime() / 1000) as any
      const exitTime = (new Date(t.exitTime).getTime() / 1000) as any
      return [
        {
          time: entryTime,
          position: t.side === 'LONG' ? 'belowBar' as const : 'aboveBar' as const,
          color: t.side === 'LONG' ? '#22c55e' : '#ef4444',
          shape: t.side === 'LONG' ? 'arrowUp' as const : 'arrowDown' as const,
          text: t.side[0],
        },
        {
          time: exitTime,
          position: 'inBar' as const,
          color: t.pnl >= 0 ? '#22c55e' : '#ef4444',
          shape: 'circle' as const,
          text: t.reason,
        },
      ]
    }).sort((a, b) => (a.time as number) - (b.time as number))

    candleSeries.setMarkers(markers)
    chart.timeScale().fitContent()

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)

    return () => { ro.disconnect(); chart.remove() }
  }, [candles, trades])

  return <div ref={containerRef} />
}
