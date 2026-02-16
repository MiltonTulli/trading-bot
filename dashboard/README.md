# Trading Bot Dashboard 🚀

A spectacular web dashboard for monitoring and controlling your cryptocurrency trading bot. Built with modern technologies for a premium trading terminal experience.

![Dashboard Preview](https://img.shields.io/badge/Status-Ready-success)

## 🎯 Features

### 📊 Real-time Monitoring
- **Bot Status**: Live/Paper/Stopped status indicator
- **Current BTC Price**: Real-time price display
- **Balance & Equity**: Portfolio value tracking
- **Position Monitoring**: Current open positions with P&L

### 📈 Analytics & Charts
- **TradingView Candlestick Chart**: Professional 4h BTC/USDT chart with trade markers
- **Equity Curve**: Portfolio growth visualization with drawdown overlay
- **Monthly Heatmap**: GitHub-style returns calendar
- **Performance Stats**: Win rate, Sharpe ratio, max drawdown, and more

### 🛠 Bot Controls
- **Start/Stop Bot**: Switch between paper and live trading
- **Position Management**: View current trades and P&L
- **Trade History**: Sortable table with detailed trade information
- **Backtest Engine**: Run historical backtests with visual results

## 🚀 Getting Started

### Prerequisites
- Bun runtime installed
- Trading bot setup in parent directory

### Installation & Setup

1. **Navigate to the trading bot directory:**
   ```bash
   cd /Users/milton/.openclaw/workspace/trading-bot
   ```

2. **Install dashboard dependencies:**
   ```bash
   cd dashboard
   bun install
   ```

3. **Build the frontend:**
   ```bash
   bun run build
   ```

4. **Start the dashboard server:**
   ```bash
   cd ..
   bun run dashboard
   ```

5. **Access the dashboard:**
   Open http://localhost:3000 in your browser

## 📁 Project Structure

```
dashboard/
├── src/
│   ├── components/          # React components
│   │   ├── Dashboard.tsx    # Main dashboard layout
│   │   ├── StatsCards.tsx   # Performance metrics
│   │   ├── CandlestickChart.tsx  # TradingView chart
│   │   ├── EquityCurve.tsx  # Portfolio growth chart
│   │   ├── TradesTable.tsx  # Trade history table
│   │   ├── MonthlyHeatmap.tsx   # Returns calendar
│   │   ├── BotControls.tsx  # Start/stop controls
│   │   ├── PositionCard.tsx # Current position
│   │   └── BacktestPanel.tsx    # Backtesting interface
│   ├── hooks/
│   │   └── useApi.ts        # API hooks and state management
│   ├── server/              # Hono API server
│   │   ├── index.ts         # Main server entry
│   │   └── routes/          # API endpoints
│   │       ├── bot.ts       # Bot control endpoints
│   │       ├── trades.ts    # Trade data endpoints
│   │       ├── backtest.ts  # Backtesting endpoints
│   │       └── candles.ts   # Market data endpoints
│   └── types.ts             # TypeScript definitions
├── dist/                    # Built frontend assets
└── package.json
```

## 🎨 Technology Stack

### Frontend
- **React 18**: Modern UI framework
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **TradingView Lightweight Charts**: Professional candlestick charts
- **Recharts**: Statistical charts and visualizations
- **Lucide React**: Beautiful icons

### Backend  
- **Hono**: Ultra-fast web framework
- **Bun**: Modern JavaScript runtime
- **File-based Data**: JSON data persistence

### Design System
- **Dark Theme**: Trading terminal aesthetic
- **Color Scheme**: 
  - Background: `#0a0a0f`
  - Cards: `#12121a` 
  - Success: `#22c55e`
  - Error: `#ef4444`
  - Primary: `#3b82f6`

## 📊 API Endpoints

### Bot Control
- `GET /api/status` - Get bot status and balance
- `POST /api/bot/start` - Start bot (paper/live mode)
- `POST /api/bot/stop` - Stop bot

### Trading Data
- `GET /api/trades` - Get trade history
- `GET /api/trades/open` - Get current open position
- `GET /api/stats` - Get aggregated statistics
- `GET /api/equity` - Get equity curve data
- `GET /api/monthly` - Get monthly returns

### Market Data
- `GET /api/candles` - Get recent 4h candlestick data

### Backtesting
- `GET /api/backtest` - Run backtest and get results

## 🎯 Key Components Explained

### CandlestickChart
Uses TradingView Lightweight Charts library to display professional-grade candlestick charts with:
- 4-hour BTC/USDT data
- Volume bars
- Trade entry/exit markers
- Dark theme integration

### EquityCurve  
Displays portfolio growth over time with:
- Equity line chart
- Drawdown visualization
- Performance statistics

### MonthlyHeatmap
GitHub-style calendar showing monthly returns:
- Color-coded performance
- Interactive tooltips
- Multi-year view

### TradesTable
Comprehensive trade history with:
- Sortable columns
- Filtering by direction (LONG/SHORT)
- P&L color coding
- Summary statistics

## 🚀 Deployment

### Development Mode
```bash
bun run dashboard
```

### Production Mode
1. Build the frontend:
   ```bash
   cd dashboard && bun run build
   ```

2. Start the server:
   ```bash
   bun run dashboard
   ```

The server will serve both the API and the built React app on port 3000.

## 🛠 Configuration

### Environment Variables
- `PORT`: Server port (default: 3000)

### Data Sources
The dashboard reads from:
- `data/state.json`: Current bot state and balance
- `data/breakout-trades.json`: Historical trades
- `data/backtest/BTCUSDT_4h_full.json`: Candle data
- `config.json`: Bot configuration

## 🎨 Customization

### Styling
The dashboard uses Tailwind CSS with a custom dark theme. Colors can be customized in `tailwind.config.ts`.

### Charts
Chart configurations can be modified in the respective component files:
- `CandlestickChart.tsx` for price charts
- `EquityCurve.tsx` for performance charts

## 📝 Development

### Adding New Features
1. Create new components in `src/components/`
2. Add API endpoints in `src/server/routes/`
3. Update types in `src/types.ts`
4. Add hooks in `src/hooks/useApi.ts`

### Hot Reload
The Vite dev server supports hot reload during development:
```bash
cd dashboard && bun run dev
```

## 🐛 Troubleshooting

### Common Issues

**Dashboard not loading:**
- Ensure the build completed successfully
- Check server logs for errors
- Verify port 3000 is available

**No data showing:**
- Ensure bot has generated data files
- Check file permissions in `data/` directory
- Verify API endpoints are responding

**Charts not rendering:**
- Clear browser cache
- Check browser console for errors
- Ensure lightweight-charts library loaded correctly

## 📈 Performance

The dashboard is optimized for:
- Fast loading with code splitting
- Efficient data fetching with hooks
- Smooth animations and transitions
- Real-time updates every 30 seconds

## 🔮 Future Enhancements

Planned features:
- [ ] WebSocket real-time updates
- [ ] Multiple timeframe charts
- [ ] Advanced backtesting parameters
- [ ] Trade execution from dashboard
- [ ] Performance alerts
- [ ] Export functionality
- [ ] Mobile responsive design

---

**Built with ❤️ for professional cryptocurrency trading**

*Ready to trade like a pro? Start the dashboard and watch your bot perform!* 🚀📈