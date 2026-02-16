import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'
import botRoutes from './routes/bot'
import tradesRoutes from './routes/trades'
import backtestRoutes from './routes/backtest'
import candlesRoutes from './routes/candles'

const app = new Hono()

// Enable CORS
app.use('*', cors())

// API routes
app.route('/api/bot', botRoutes)
app.route('/api/trades', tradesRoutes) 
app.route('/api', backtestRoutes)
app.route('/api/candles', candlesRoutes)

// Serve static files from the built React app
app.get('/assets/*', serveStatic({ root: './dist' }))
app.get('/favicon.ico', serveStatic({ root: './dist' }))

// Serve the main HTML file for all routes (SPA routing)
app.get('*', serveStatic({ path: './dist/index.html' }))

const port = process.env.PORT || 3000

console.log(`🚀 Trading Bot Dashboard starting on port ${port}`)
console.log(`📊 Dashboard: http://localhost:${port}`)
console.log(`🤖 API: http://localhost:${port}/api/status`)

export default {
  port,
  fetch: app.fetch,
}