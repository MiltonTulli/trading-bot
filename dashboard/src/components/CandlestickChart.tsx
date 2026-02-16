import { useEffect, useRef } from 'react'
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts'
import { useCandles, useTrades } from '../hooks/useApi'
import { TrendingUp } from 'lucide-react'

export function CandlestickChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  
  const { data: candles } = useCandles()
  const { data: trades } = useTrades()

  useEffect(() => {
    if (!chartContainerRef.current) return

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#12121a' },
        textColor: '#ffffff',
      },
      grid: {
        vertLines: { color: '#1a1a2e' },
        horzLines: { color: '#1a1a2e' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#1a1a2e',
      },
      timeScale: {
        borderColor: '#1a1a2e',
        timeVisible: true,
        secondsVisible: false,
      },
      watermark: {
        color: '#1a1a2e',
        visible: true,
        text: 'BTC/USDT 4H',
        fontSize: 24,
        horzAlign: 'left',
        vertAlign: 'top',
      },
    })

    // Create candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    // Create volume series
    const volumeSeries = chart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    })

    // Configure volume price scale
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !candles) return

    // Transform candle data
    const candleData = candles.map(candle => ({
      time: candle.time as any,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }))

    const volumeData = candles.map(candle => ({
      time: candle.time as any,
      value: candle.volume,
      color: candle.close >= candle.open ? '#22c55e40' : '#ef444440',
    }))

    candleSeriesRef.current.setData(candleData)
    volumeSeriesRef.current.setData(volumeData)
  }, [candles])

  useEffect(() => {
    if (!candleSeriesRef.current || !trades) return

    // Add trade markers
    const markers = trades.map(trade => ({
      time: new Date(trade.entryTime).getTime() / 1000 as any,
      position: trade.direction === 'LONG' ? 'belowBar' : 'aboveBar' as any,
      color: trade.direction === 'LONG' ? '#22c55e' : '#ef4444',
      shape: trade.direction === 'LONG' ? 'arrowUp' : 'arrowDown' as any,
      text: `${trade.direction} @ $${trade.entryPrice}`,
    }))

    candleSeriesRef.current.setMarkers(markers)
  }, [trades])

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-primary" />
          BTC/USDT 4H Chart
        </h3>
      </div>
      <div className="card-content">
        <div 
          ref={chartContainerRef} 
          className="w-full h-96 rounded-md"
        />
      </div>
    </div>
  )
}