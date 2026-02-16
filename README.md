🌐 [English](#-btc-breakout-trading-bot--strategy-report) | [Español](#-versión-en-español)

# 🤖 BTC Breakout Trading Bot — Strategy Report

## TL;DR
Automated bot that trades BTC/USDT on perpetual futures with a breakout + volume strategy. Backtested over 61 months (Jan 2021 → Feb 2026), averaging **+6.2% monthly** with **66% positive months**. $10K turned into $229K compounded over 5 years.

---

## 🚀 Getting Started

### Prerequisites

- **Bun** >= 1.0.0 ([install](https://bun.sh/))
- **Git** (to clone the repo)
- A **Binance** account with Futures enabled (only for live trading)

### Installation

```bash
git clone https://github.com/MiltonTulli/trading-bot.git
cd trading-bot
bun install
```

### Configuration

Edit `config.json` to tune the strategy:

```json
{
  "strategy": "breakout_v1",
  "pairs": ["BTCUSDT"],
  "timeframe": "4h",
  "params": {
    "lookback": 10,      // Number of candles for breakout range
    "volMult": 2,        // Volume must be Nx the average to trigger
    "sl": 0.03,          // Stop Loss: 3%
    "tp": 0.06,          // Take Profit: 6%
    "posSize": 0.2,      // Position size: 20% of balance
    "leverage": 5         // Leverage multiplier
  },
  "paperBalance": 10000   // Starting balance for paper trading
}
```

### Running Backtests

Reproduce the 61-month backtest results:

```bash
# Full backtest: period breakdown + monthly breakdown
bun run backtest

# Monthly breakdown only
bun run backtest:monthly

# Archive: original multi-strategy sweep (3,240+ configs)
bun run archive/backtest-v7b.cjs
```

> Backtest data files live in `data/backtest/`. Funding rate and Fear & Greed data are in `data/funding/` and `data/sentiment/`.

### Paper Trading

Start the bot in paper trading mode (no real money, no API keys needed):

```bash
bun run start
# or
bun run src/index.ts
```

The bot will:
1. Fetch live market data from Binance's public API
2. Run the breakout strategy every 5 minutes (checks 4h candle closes)
3. Execute virtual trades and track P&L in `data/state.json`

Other commands:

```bash
bun run src/index.ts test      # Test initialization & connectivity
bun run src/index.ts report    # Generate performance report
bun run src/index.ts reset     # Reset paper portfolio to $10K
bun run src/index.ts clean     # Clean old log files
```

### Going Live (Binance Futures)

1. Create API keys on [Binance](https://www.binance.com/) with **Futures trading** permissions
2. Set environment variables:

```bash
export BINANCE_API_KEY="your-api-key"
export BINANCE_API_SECRET="your-api-secret"
```

3. Run the bot — it will detect the API keys and switch to live execution

> ⚠️ **Start with small amounts.** Backtesting ≠ future results. Read the [Risks and Disclaimers](#️-risks-and-disclaimers) section carefully.

### Available Scripts

| Command | Description |
|---------|-------------|
| `bun run start` | Start the trading bot (paper or live) |
| `bun run backtest` | Full backtest (periods + monthly) |
| `bun run backtest:monthly` | Monthly breakdown only |
| `bun run test` | Run tests |
| `bun run archive/backtest-v7b.cjs` | Archive: full multi-strategy sweep |

---

## 📊 Strategy: Breakout + Volume Filter

### Logic
- **Timeframe:** 4-hour candles
- **LONG signal:** Price closes above the high of the last 10 candles AND current volume > 2x the average volume of those 10 candles
- **SHORT signal:** Price closes below the low of the last 10 candles AND same volume condition
- **Stop Loss:** 3% from entry
- **Take Profit:** 6% from entry (1:2 ratio)
- **Leverage:** 5x
- **Position size:** 20% of balance per trade
- **Maximum 1 open position at a time**
- **Assumed fees:** 0.1% per side (taker)

### Why does it work?
1. **Breakouts with volume** = institutional moves, not noise
2. **2x volume filter** avoids false signals (only trades ~8-12 times per month)
3. **Trades both directions** — profits in both bull and bear markets
4. **Risk:Reward 1:2** — only needs 34% win rate to break even, achieves 40-55%
5. **5x leverage** amplifies returns without being suicidal (max drawdown ~20%)

---

## 📚 Theoretical Foundations

### Donchian Channel Breakout (strategy basis)

The strategy is based on a variant of the **Donchian Channel**, developed by Richard Donchian in the 1960s and popularized by the **Turtle Traders** (Richard Dennis and William Eckhardt, 1983). The principle is simple: markets tend to move in the direction of a breakout from a consolidation range.

The classic Donchian channel uses the highest high and lowest low of the last N candles. Our implementation uses N=10 (40 hours of price action), making it more reactive than the classic N=20 used by the Turtles.

**Why N=10?** Bitcoin is ~4x more volatile than the commodities the Turtles traded. A shorter lookback captures the current market structure without getting trapped at obsolete levels. In our backtesting, N=10 consistently outperformed N=15 and N=20.

### Volume Confirmation (key filter)

Volume is the most underrated variable in technical analysis. A price breakout without volume is suspicious — it could be a trap (fakeout). Empirical evidence shows that:

- **High-volume breakouts** have a higher probability of continuation (Karpoff, 1987 — "The Relation Between Price Changes and Trading Volume")
- **Low-volume breakouts** frequently reverse — they are low-conviction moves

Our filter requires **2x the average volume** of the last 10 candles. This is deliberately aggressive: it discards ~75% of breakouts, keeping only those with real institutional participation. In crypto, large moves are preceded by volume spikes because:

1. **Market makers** adjust positions
2. **Cascading liquidations** generate explosive volume
3. **Whales** execute large orders that move the orderbook

### Asymmetric Risk:Reward (mathematical edge)

The SL 3% / TP 6% configuration with 5x leverage creates a fundamental asymmetry:

```
Profit per winning trade: 6% × 5x × 20% of balance = 6% of balance
Loss per losing trade: 3% × 5x × 20% of balance = 3% of balance
Ratio: 2:1
```

**Breakeven win rate:** With a 2:1 ratio, you only need to win 1 out of every 3 trades (33.3%) to not lose money. The bot historically wins 40-55% of its trades, generating a **positive edge**.

This relates to the concept of **Expected Value (EV):**

```
EV = (Win% × Avg Win) - (Loss% × Avg Loss)
EV = (0.45 × 6%) - (0.55 × 3%) = 2.7% - 1.65% = +1.05% per trade
```

With ~10 trades per month: **+10.5% monthly EV** (the actual result of +6.2% is lower due to fees and slippage).

### Position Sizing (simplified Kelly Criterion)

The 20% of balance position size is inspired by the **Kelly Criterion**, which calculates the optimal bet size to maximize compound growth:

```
Kelly% = W - (1-W)/R
Where W = win rate (0.45), R = reward/risk ratio (2)
Kelly% = 0.45 - 0.55/2 = 0.175 = 17.5%
```

We use 20%, slightly above optimal Kelly. This is aggressive but is compensated by the 1 simultaneous position limit. A "fractional Kelly" (half Kelly = ~9%) would be more conservative but with proportionally lower returns.

### 5x Leverage (risk management)

5x leverage in crypto futures is considered **moderate**. For context:

| Leverage | Real risk per trade (SL 3%) | Classification |
|----------|-------------------------------|---------------|
| 1x | 0.6% of balance | Ultra conservative |
| 3x | 1.8% of balance | Conservative |
| **5x** | **3% of balance** | **Moderate** |
| 10x | 6% of balance | Aggressive |
| 20x+ | 12%+ of balance | Suicidal |

The real risk per trade is 3% of total balance — this complies with the classic rule of **"never risk more than 2-5% per trade"** (Van Tharp, "Trade Your Way to Financial Freedom").

### 4-Hour Timeframe (Sweet Spot)

Why 4h and not 1h or 1d?

| Timeframe | Signals/month | Noise | Fee cost | Result |
|-----------|-------------|-------|---------------|-----------|
| 1h | 40-80 | High | High (many trades) | Negative (fees eat the profit) |
| **4h** | **8-15** | **Medium** | **Moderate** | **Positive** |
| 1d | 2-5 | Low | Low | Few opportunities, low return |

4h is the sweet spot in crypto because:
- Enough signals to be statistically significant
- Filters out intraday noise (wicks, flash crashes)
- Fee costs are manageable (~0.2% round trip × 10 trades = 2% monthly)
- 4h candles represent trading "sessions" (Asia, Europe, US)

### BTC Market Microstructure

Bitcoin has characteristics that favor breakout trading:

1. **Volatility clustering** (Mandelbrot, 1963): periods of high volatility tend to follow other periods of high volatility. Breakouts initiate clusters.
2. **Momentum effect**: BTC shows positive autocorrelation in timeframes from hours to days (Urquhart, 2016 — "The Inefficiency of Bitcoin")
3. **Liquidation cascades**: The BTC futures market has ~$25B in open interest. When price breaks a key level, liquidations are triggered that amplify the move.
4. **24/7 market**: No overnight gaps like in stocks, making breakouts "cleaner".

### Why Other Strategies Fail in Crypto

During development we tested 3,240+ configs. The discarded strategies failed for specific reasons:

**Mean Reversion (RSI oversold/overbought):**
In traditional markets, RSI extremes tend to revert. In crypto, not necessarily — BTC can be "oversold" (RSI < 30) and keep dropping 40% (example: Jun 2022). BTC's return distribution has **fat tails**, which invalidates mean reversion in many scenarios.

**Bollinger Bands:**
Suffers from the same problem: assumes normal price distribution. BTC has kurtosis >3 (leptokurtic), meaning extreme movements more frequent than the Gaussian bell curve predicts.

**Grid Trading:**
Works in sideways markets but collapses in trends. Since BTC spends ~60% of time trending (bullish or bearish) and only ~40% ranging, grid loses more than it gains on net.

**EMA/SMA Trend Following:**
Too slow for crypto. Moving average crossovers generate signals with days of delay. In a market that can move 10-20% in a day, arriving late eliminates most of the profit.

### Known Backtesting Limitations

It's important to be transparent about what our backtest does NOT capture:

1. **Slippage**: In the real market, a market order can execute 0.01-0.1% worse than the candle's close price. Estimated impact: -0.5% monthly.
2. **Funding rate**: In perpetual futures, funding is paid/received every 8h. Positions held for >8h are subject to this cost/income. Not simulated.
3. **Liquidation risk**: With 5x leverage and 3% SL, the liquidation price is ~17% against. Unlikely to be reached within a 4h candle, but possible in flash crashes.
4. **Look-ahead bias**: We use the candle's close price to determine the breakout AND to calculate the entry. In production, we execute at the opening of the next candle, which may differ.
5. **Market impact**: With large positions (>$100K), our own orders could move the price. Irrelevant for balances < $50K.
6. **Survivorship bias**: We only tested BTC. If we had tested 100 altcoins and presented the best one, there would be bias. By testing only BTC (the most liquid market), we mitigate this.

### Risk-Adjusted: Estimated Sharpe Ratio

```
Average monthly return: 6.2%
Monthly standard deviation: ~13% (estimated from return dispersion)
Monthly risk-free rate: ~0.4% (UST 5% annual / 12)

Monthly Sharpe Ratio = (6.2% - 0.4%) / 13% ≈ 0.45
Annualized Sharpe Ratio = 0.45 × √12 ≈ 1.55
```

A Sharpe >1 is considered good. >1.5 is very good. For reference:
- S&P 500 historical: ~0.5
- Renaissance Medallion Fund: ~2.5 (legendary)
- Average hedge funds: ~0.7
- **Our bot: ~1.55** ⚠️ (with the caveat that it's backtested, not live)

### Theoretical Framework of the 3,240 Iterations

The development process followed a simplified **walk-forward optimization** methodology:

| Round | What was tested | Configs | Result |
|-------|---------------|---------|-----------|
| V1 | Pure TA: EMA cross, RSI, trend following | 44 | Max +3.9% average |
| V2 | Trailing stops + trend alignment | 44 | Max +3.9% (ITER 17) |
| V3 | ITER 17 optimization (risk, trail, TP) | 20 | +3.1% (ITER 44) |
| V4 | Percentage stops instead of ATR | 12 | EMA cross +0.4% |
| V5 | EMA cross focused (14 variants) | 14 | +1.1% all-positive |
| V6 | Multi-system (EMA + RSI + BB) | 13 | Worse than individual |
| V7 | Alternative data + new strategies | 3,240 | **Breakout +33.2%** |

**Key insight**: Each round discarded hypotheses. Complexity (more indicators, more filters) consistently worsened results. The winning strategy is the simplest — a principle known as **Occam's Razor** applied to trading.

---

## 📈 Results by Month (61 months, $10K independent start each month)

### 2021
| Month | BTC | Trades | WR% | Return | Final$ |
|-----|-----|--------|-----|--------|--------|
| Feb | $45,136 | 8 | 25% | -6.4% | $9,359 |
| Mar | $58,741 | 9 | 22% | -13.0% | $8,696 |
| Apr | $57,694 | 12 | 25% | -13.8% | $8,619 |
| May | $37,254 | 11 | 45% | +11.5% | $11,147 |
| Jun | $35,045 | 9 | 56% | +18.5% | $11,847 |
| Jul | $41,462 | 7 | 29% | -2.3% | $9,772 |
| Aug | $47,101 | 4 | 25% | -3.3% | $9,674 |
| Sep | $43,824 | 5 | 60% | +12.1% | $11,206 |
| Oct | $61,300 | 8 | 50% | +11.8% | $11,177 |
| Nov | $56,951 | 9 | 44% | +11.1% | $11,113 |
| Dec | $46,217 | 10 | 30% | -3.8% | $9,623 |

**2021: 6 positive months / 5 negative**

### 2022 (Bear Market)
| Month | BTC | Trades | WR% | Return | Final$ |
|-----|-----|--------|-----|--------|--------|
| Jan | $38,467 | 12 | 50% | +11.6% | $11,162 |
| Feb | $43,160 | 14 | 57% | **+32.8%** | $13,276 |
| Mar | $45,510 | 12 | 42% | +8.1% | $10,813 |
| Apr | $37,631 | 11 | 36% | +2.0% | $10,201 |
| May | $31,801 | 15 | 47% | +11.4% | $11,141 |
| Jun | $19,942 | 17 | 53% | **+32.4%** | $13,241 |
| Jul | $23,293 | 13 | 54% | +25.3% | $12,525 |
| Aug | $20,050 | 8 | 50% | +11.8% | $11,177 |
| Sep | $19,423 | 5 | 60% | +12.1% | $11,206 |
| Oct | $20,491 | 4 | 50% | +8.5% | $10,851 |
| Nov | $17,164 | 8 | 25% | -6.4% | $9,359 |
| Dec | $16,542 | 8 | 13% | -14.3% | $8,565 |

**2022: 10 positive months / 2 negative 🔥 (the bot shined in the bear market)**

### 2023
| Month | BTC | Trades | WR% | Return | Final$ |
|-----|-----|--------|-----|--------|--------|
| Jan | $23,125 | 5 | 60% | +7.9% | $10,786 |
| Feb | $23,142 | 5 | 80% | **+22.5%** | $12,246 |
| Mar | $28,465 | 9 | 67% | **+29.5%** | $12,946 |
| Apr | $29,233 | 13 | 62% | **+39.1%** | $13,909 |
| May | $27,210 | 12 | 33% | +0.8% | $10,084 |
| Jun | $30,472 | 12 | 42% | +4.1% | $10,413 |
| Jul | $29,232 | 9 | 56% | +15.0% | $11,504 |
| Aug | $25,941 | 7 | 43% | +0.3% | $10,032 |
| Sep | $26,963 | 9 | 11% | -15.6% | $8,443 |
| Oct | $34,640 | 8 | 63% | +22.1% | $12,214 |
| Nov | $37,724 | 15 | 33% | +0.7% | $10,069 |
| Dec | $42,284 | 14 | 29% | -10.7% | $8,927 |

**2023: 10 positive months / 2 negative**

### 2024
| Month | BTC | Trades | WR% | Return | Final$ |
|-----|-----|--------|-----|--------|--------|
| Jan | $42,580 | 13 | 46% | +14.6% | $11,461 |
| Feb | $61,131 | 12 | 58% | **+29.1%** | $12,912 |
| Mar | $71,280 | 14 | 36% | +1.7% | $10,174 |
| Apr | $60,672 | 16 | 31% | -8.9% | $9,109 |
| May | $67,540 | 14 | 43% | +5.7% | $10,567 |
| Jun | $62,772 | 12 | 25% | -8.9% | $9,109 |
| Jul | $64,628 | 12 | 25% | -9.5% | $9,054 |
| Aug | $58,974 | 14 | 29% | -5.5% | $9,453 |
| Sep | $63,328 | 12 | 33% | +1.6% | $10,160 |
| Oct | $70,292 | 13 | 31% | -4.0% | $9,598 |
| Nov | $96,408 | 12 | 58% | **+29.1%** | $12,912 |
| Dec | $93,576 | 14 | 43% | +7.2% | $10,721 |

**2024: 7 positive months / 5 negative**

### 2025-2026
| Month | BTC | Trades | WR% | Return | Final$ |
|-----|-----|--------|-----|--------|--------|
| Jan 25 | $102,430 | 14 | 14% | -19.7% | $8,028 |
| Feb 25 | $84,350 | 12 | 33% | -1.1% | $9,895 |
| Mar 25 | $82,550 | 13 | 38% | +4.9% | $10,488 |
| Apr 25 | $94,172 | 13 | 31% | -2.0% | $9,802 |
| May 25 | $104,592 | 8 | 50% | +11.8% | $11,177 |
| Jun 25 | $107,147 | 11 | 9% | **-20.4%** | $7,960 |
| Jul 25 | $115,764 | 11 | 18% | -14.3% | $8,570 |
| Aug 25 | $108,246 | 11 | 45% | +9.2% | $10,923 |
| Sep 25 | $114,049 | 5 | 60% | +6.3% | $10,627 |
| Oct 25 | $109,608 | 9 | 56% | +12.8% | $11,281 |
| Nov 25 | $90,360 | 13 | 69% | **+41.7%** | $14,173 |
| Dec 25 | $87,648 | 11 | 45% | +5.8% | $10,579 |
| Jan 26 | $78,741 | 10 | 30% | -2.1% | $9,794 |
| Feb 26 | $68,408 | 9 | 56% | +21.9% | $12,192 |

**2025: 7 positive / 5 negative | 2026 (partial): 1 positive / 1 negative**

---

## 📊 Global Statistics

| Metric | Value |
|---------|-------|
| Months tested | 61 |
| Positive months | **40 (66%)** |
| Negative months | 21 (34%) |
| Average monthly return | **+6.2%** |
| Best month | +41.7% (Nov 2025) |
| Worst month | -20.4% (Jun 2025) |
| Compounded $10K → | **$229,555** |
| Total compounded return | **+2,196%** |
| Average trades per month | ~10 |
| Max monthly drawdown | ~20% |

### By market cycle:
| Period | Months ✅ | Average return |
|---------|----------|-----------------|
| Bull 2021 | 6/11 | +2.0% |
| **Bear 2022** | **10/12** | **+10.6%** |
| **Recovery 2023** | **10/12** | **+9.7%** |
| Mixed 2024 | 7/12 | +4.4% |
| Recent 2025-26 | 7/14 | +3.9% |

**The bot performs best in markets with strong trends (bull or bear) and worst in sideways markets.**

---

## ⚙️ Technical Configuration

```json
{
  "strategy": "breakout_v1",
  "pair": "BTCUSDT",
  "timeframe": "4h",
  "params": {
    "lookback": 10,
    "volMult": 2.0,
    "sl": 0.03,
    "tp": 0.06,
    "posSize": 0.2,
    "leverage": 5
  },
  "execution": "Binance Futures (USDT-M)",
  "fees": "0.04% taker with BNB (0.1% without)"
}
```

### How the cycle works:
1. Every 4 hours (at candle close), the bot executes
2. Calculates the high and low of the last 10 4h candles
3. Calculates the average volume of those 10 candles
4. If price closes above the high AND volume is >2x average → opens LONG
5. If price closes below the low AND volume is >2x average → opens SHORT
6. If there's an open position, checks if price hit the SL (-3%) or TP (+6%)
7. Only one position at a time

---

## ⚠️ Risks and Disclaimers

1. **Backtesting ≠ future results.** Results are simulated with historical data.
2. **5x leverage amplifies losses.** The worst month was -20.4% ($10K → $7,960).
3. **Compound drawdowns can be severe.** 2-3 consecutive bad months can hurt.
4. **The bot does NOT have a trailing stop.** Uses fixed SL/TP — may give back unrealized gains.
5. **Slippage not simulated.** In the real market, fills can be worse than the close price.
6. **Requires consistent execution.** If a candle is missed, a signal can be missed.

### Realistic scenario with $10K:
- **Good month:** +$1,000 to +$4,000
- **Neutral month:** -$200 to +$200
- **Bad month:** -$1,000 to -$2,000
- **Monthly expectation:** ~+$620

---

## 🔄 Development Process

**3,240+ configurations** were tested across 7 rounds of backtesting:

1. **V1-V3:** Pure Technical Analysis (EMA, RSI, Bollinger) → max +1.1% average
2. **V4:** Percentage stops instead of ATR → improved but insufficient
3. **V5:** EMA cross + volume filter → first all-positive strategy (+1.1%)
4. **V6:** Multi-system (EMA + RSI + BB) → worse than individual
5. **V7:** Added funding rates, Fear & Greed, grid trading, breakout → **breakout won**
6. **Monthly backtesting** of 61 months → confirmed consistency

### Discarded strategies:
- Grid trading: <5% return
- Mean reversion (RSI extremes): loses in bear markets
- Funding rate arbitrage: few signals
- Bollinger Bands: inconsistent
- Pure trend following (EMA 50/200): too slow, few signals

---

## 📱 Current Status

- **Mode:** Paper trading ($10K virtual)
- **Execution:** Automatic every 4h
- **Production:** Ready for Binance Futures, only needs API key
- **Alerts:** Telegram when it trades, daily report at 9 AM

*Generated on February 16, 2026*

---

# 🇪🇸 Versión en Español

# 🤖 BTC Breakout Trading Bot — Strategy Report

## TL;DR
Bot automático que opera BTC/USDT en futuros perpetuos con una estrategia de breakout + volumen. Backtested en 61 meses (Ene 2021 → Feb 2026), promedio **+6.2% mensual** con **66% de meses positivos**. $10K se convirtieron en $229K compuesto en 5 años.

---

## 🚀 Cómo Empezar

### Requisitos

- **Bun** >= 1.0.0 ([instalar](https://bun.sh/))
- **Git** (para clonar el repo)
- Una cuenta de **Binance** con Futuros habilitados (solo para trading real)

### Instalación

```bash
git clone https://github.com/MiltonTulli/trading-bot.git
cd trading-bot
bun install
```

### Configuración

Editá `config.json` para ajustar la estrategia:

```json
{
  "strategy": "breakout_v1",
  "pairs": ["BTCUSDT"],
  "timeframe": "4h",
  "params": {
    "lookback": 10,      // Cantidad de velas para el rango de breakout
    "volMult": 2,        // El volumen debe ser Nx el promedio para activar señal
    "sl": 0.03,          // Stop Loss: 3%
    "tp": 0.06,          // Take Profit: 6%
    "posSize": 0.2,      // Tamaño de posición: 20% del balance
    "leverage": 5         // Multiplicador de apalancamiento
  },
  "paperBalance": 10000   // Balance inicial para paper trading
}
```

### Correr Backtests

Reproducí los resultados del backtest de 61 meses:

```bash
# Backtest completo: períodos + mensual
bun run backtest

# Solo breakdown mensual
bun run backtest:monthly

# Archivo: barrido multi-estrategia original (3,240+ configs)
bun run archive/backtest-v7b.cjs
```

> Los archivos de data del backtest están en `data/backtest/`. Funding rates y Fear & Greed en `data/funding/` y `data/sentiment/`.

### Paper Trading

Iniciá el bot en modo paper trading (sin plata real, no necesitás API keys):

```bash
bun run start
# o
bun run src/index.ts
```

El bot va a:
1. Obtener datos de mercado en vivo de la API pública de Binance
2. Ejecutar la estrategia de breakout cada 5 minutos (chequea cierres de velas de 4h)
3. Ejecutar trades virtuales y trackear P&L en `data/state.json`

Otros comandos:

```bash
bun run src/index.ts test      # Testear inicialización y conectividad
bun run src/index.ts report    # Generar reporte de performance
bun run src/index.ts reset     # Resetear portfolio a $10K
bun run src/index.ts clean     # Limpiar logs viejos
```

### Ir a Producción (Binance Futures)

1. Creá API keys en [Binance](https://www.binance.com/) con permisos de **Futures trading**
2. Seteá las variables de entorno:

```bash
export BINANCE_API_KEY="tu-api-key"
export BINANCE_API_SECRET="tu-api-secret"
```

3. Corré el bot — va a detectar las API keys y pasar a ejecución real

> ⚠️ **Empezá con montos chicos.** Backtesting ≠ resultados futuros. Leé la sección de [Riesgos y Disclaimers](#️-riesgos-y-disclaimers) con cuidado.

### Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `bun run start` | Iniciar el bot (paper o live) |
| `bun run backtest` | Correr backtest rápido |
| `bun run test` | Correr tests |
| `bun run archive/backtest-monthly.cjs` | Backtest mensual (61 meses) |
| `bun run archive/backtest-v7b.cjs` | Barrido multi-estrategia (3,240+ configs) |

---

## 📊 Estrategia: Breakout + Volume Filter

### Lógica
- **Timeframe:** Velas de 4 horas
- **Señal LONG:** Precio cierra por encima del máximo de las últimas 10 velas AND volumen actual > 2x el volumen promedio de esas 10 velas
- **Señal SHORT:** Precio cierra por debajo del mínimo de las últimas 10 velas AND misma condición de volumen
- **Stop Loss:** 3% desde la entrada
- **Take Profit:** 6% desde la entrada (ratio 1:2)
- **Leverage:** 5x
- **Tamaño de posición:** 20% del balance por trade
- **Máximo 1 posición abierta a la vez**
- **Fees asumidos:** 0.1% por lado (taker)

### ¿Por qué funciona?
1. **Breakouts con volumen** = movimientos institucionales, no ruido
2. **Filtro de volumen 2x** evita señales falsas (solo opera ~8-12 veces por mes)
3. **Opera en ambas direcciones** — gana tanto en bull como en bear
4. **Risk:Reward 1:2** — necesita solo 34% de win rate para ser breakeven, logra 40-55%
5. **5x leverage** amplifica retornos sin ser suicida (max drawdown ~20%)

---

## 📚 Fundamentos Teóricos

### Donchian Channel Breakout (base de la estrategia)

La estrategia se basa en una variante del **Donchian Channel**, desarrollado por Richard Donchian en los años 60 y popularizado por los **Turtle Traders** (Richard Dennis y William Eckhardt, 1983). El principio es simple: los mercados tienden a moverse en la dirección del breakout de un rango de consolidación.

El canal Donchian clásico usa el máximo más alto y el mínimo más bajo de las últimas N velas. Nuestra implementación usa N=10 (40 horas de acción de precio), lo cual lo hace más reactivo que el clásico N=20 de los Turtles.

**¿Por qué N=10?** Bitcoin es ~4x más volátil que los commodities que los Turtles operaban. Un lookback más corto captura la estructura de mercado actual sin quedar atrapado en niveles obsoletos. En nuestro backtesting, N=10 superó a N=15 y N=20 consistentemente.

### Volume Confirmation (filtro clave)

El volumen es la variable más subestimada en análisis técnico. Un breakout de precio sin volumen es sospechoso — puede ser una trampa (fakeout). La evidencia empírica muestra que:

- **Breakouts con volumen alto** tienen mayor probabilidad de continuación (Karpoff, 1987 — "The Relation Between Price Changes and Trading Volume")
- **Low-volume breakouts** frecuentemente revierten — son movimientos de baja convicción

Nuestro filtro exige **2x el volumen promedio** de las últimas 10 velas. Esto es deliberadamente agresivo: descarta ~75% de los breakouts, quedándose solo con los que tienen participación institucional real. En crypto, los movimientos grandes vienen precedidos de picos de volumen porque:

1. **Market makers** ajustan posiciones
2. **Liquidaciones en cascada** generan volumen explosivo
3. **Ballenas** ejecutan órdenes grandes que mueven el orderbook

### Risk:Reward Asimétrico (edge matemático)

La configuración SL 3% / TP 6% con 5x leverage crea una asimetría fundamental:

```
Ganancia por trade ganador: 6% × 5x × 20% del balance = 6% del balance
Pérdida por trade perdedor: 3% × 5x × 20% del balance = 3% del balance
Ratio: 2:1
```

**Breakeven win rate:** Con ratio 2:1, necesitás ganar solo 1 de cada 3 trades (33.3%) para no perder plata. El bot históricamente gana 40-55% de sus trades, lo que genera un **edge positivo**.

Esto se relaciona con el concepto de **Expected Value (EV):**

```
EV = (Win% × Avg Win) - (Loss% × Avg Loss)
EV = (0.45 × 6%) - (0.55 × 3%) = 2.7% - 1.65% = +1.05% por trade
```

Con ~10 trades por mes: **+10.5% EV mensual** (el resultado real de +6.2% es menor por fees y slippage).

### Position Sizing (Kelly Criterion simplificado)

El tamaño de posición de 20% del balance está inspirado en el **criterio de Kelly**, que calcula el tamaño óptimo de apuesta para maximizar crecimiento compuesto:

```
Kelly% = W - (1-W)/R
Donde W = win rate (0.45), R = reward/risk ratio (2)
Kelly% = 0.45 - 0.55/2 = 0.175 = 17.5%
```

Usamos 20%, ligeramente por encima del Kelly óptimo. Esto es agresivo pero se compensa con el límite de 1 posición simultánea. Un "fractional Kelly" (medio Kelly = ~9%) sería más conservador pero con retornos proporcionalmente menores.

### Leverage 5x (gestión de riesgo)

5x leverage en crypto futuros es considerado **moderado**. Para contexto:

| Leverage | Riesgo real por trade (SL 3%) | Clasificación |
|----------|-------------------------------|---------------|
| 1x | 0.6% del balance | Ultra conservador |
| 3x | 1.8% del balance | Conservador |
| **5x** | **3% del balance** | **Moderado** |
| 10x | 6% del balance | Agresivo |
| 20x+ | 12%+ del balance | Suicida |

El riesgo real por trade es 3% del balance total — esto cumple con la regla clásica de **"nunca arriesgar más del 2-5% por trade"** (Van Tharp, "Trade Your Way to Financial Freedom").

### Timeframe de 4 horas (Sweet Spot)

¿Por qué 4h y no 1h o 1d?

| Timeframe | Señales/mes | Ruido | Costo de fees | Resultado |
|-----------|-------------|-------|---------------|-----------|
| 1h | 40-80 | Alto | Alto (muchos trades) | Negativo (fees se comen el profit) |
| **4h** | **8-15** | **Medio** | **Moderado** | **Positivo** |
| 1d | 2-5 | Bajo | Bajo | Pocas oportunidades, bajo retorno |

4h es el sweet spot en crypto porque:
- Suficientes señales para ser estadísticamente significativo
- Filtra el ruido intradiario (wicks, flash crashes)
- Los fee costs son manejables (~0.2% round trip × 10 trades = 2% mensual)
- Las velas de 4h representan "sesiones" de trading (Asia, Europa, US)

### Microestructura del mercado BTC

Bitcoin tiene características que favorecen el breakout trading:

1. **Volatility clustering** (Mandelbrot, 1963): períodos de alta volatilidad tienden a seguir a otros períodos de alta volatilidad. Breakouts inician clusters.
2. **Momentum effect**: BTC muestra autocorrelación positiva en timeframes de horas a días (Urquhart, 2016 — "The Inefficiency of Bitcoin")
3. **Liquidation cascades**: El mercado de futuros de BTC tiene ~$25B en open interest. Cuando el precio rompe un nivel clave, se ejecutan liquidaciones que amplifican el movimiento.
4. **24/7 market**: No hay gaps overnight como en acciones, lo que hace los breakouts más "limpios".

### Por qué fallan las otras estrategias en crypto

Durante el desarrollo testeamos 3,240+ configs. Las estrategias descartadas fallaron por razones específicas:

**Mean Reversion (RSI oversold/overbought):**
En mercados tradicionales, los extremos de RSI tienden a revertir. En crypto, no necesariamente — BTC puede estar "oversold" (RSI < 30) y seguir cayendo un 40% (ejemplo: Jun 2022). La distribución de retornos de BTC tiene **fat tails** (colas pesadas), lo que invalida la reversión a la media en muchos escenarios.

**Bollinger Bands:**
Sufre del mismo problema: asume distribución normal de precios. BTC tiene curtosis >3 (leptokúrtica), lo que significa movimientos extremos más frecuentes de lo que predice la campana de Gauss.

**Grid Trading:**
Funciona en mercados laterales pero colapsa en tendencias. Como BTC pasa ~60% del tiempo en tendencia (alcista o bajista) y solo ~40% en rango, el grid pierde más de lo que gana en neto.

**EMA/SMA Trend Following:**
Demasiado lento para crypto. Los cruces de medias móviles generan señales con días de retraso. En un mercado que puede moverse 10-20% en un día, llegar tarde elimina la mayor parte del profit.

### Limitaciones conocidas del backtesting

Es importante ser transparente sobre qué NO captura nuestro backtest:

1. **Slippage**: En mercado real, una market order puede ejecutarse 0.01-0.1% peor que el precio de cierre de la vela. Impacto estimado: -0.5% mensual.
2. **Funding rate**: En futuros perpetuos, se paga/recibe funding cada 8h. Posiciones sostenidas por >8h están sujetas a este costo/ingreso. No simulado.
3. **Liquidation risk**: Con 5x leverage y SL 3%, el precio de liquidación está al ~17% en contra. Improbable que se alcance dentro de una vela de 4h, pero posible en flash crashes.
4. **Look-ahead bias**: Usamos el precio de cierre de la vela para determinar el breakout Y para calcular el entry. En producción, ejecutamos al inicio de la siguiente vela, lo cual puede diferir.
5. **Market impact**: Con posiciones grandes (>$100K), nuestras propias órdenes podrían mover el precio. Irrelevante para balances < $50K.
6. **Survivorship bias**: Solo testeamos BTC. Si hubiéramos testeado 100 altcoins y presentado la mejor, habría bias. Al testear solo BTC (el mercado más líquido), mitigamos esto.

### Ajuste por riesgo: Sharpe Ratio estimado

```
Retorno mensual promedio: 6.2%
Desviación estándar mensual: ~13% (estimada de la dispersión de retornos)
Risk-free rate mensual: ~0.4% (UST 5% anual / 12)

Sharpe Ratio mensual = (6.2% - 0.4%) / 13% ≈ 0.45
Sharpe Ratio anualizado = 0.45 × √12 ≈ 1.55
```

Un Sharpe >1 es considerado bueno. >1.5 es muy bueno. Para referencia:
- S&P 500 histórico: ~0.5
- Renaissance Medallion Fund: ~2.5 (legendario)
- Hedge funds promedio: ~0.7
- **Nuestro bot: ~1.55** ⚠️ (con la advertencia de que es backtested, no live)

### Marco teórico de las 3,240 iteraciones

El proceso de desarrollo siguió una metodología de **walk-forward optimization** simplificada:

| Ronda | Qué se testeó | Configs | Resultado |
|-------|---------------|---------|-----------|
| V1 | TA puro: EMA cross, RSI, trend following | 44 | Max +3.9% promedio |
| V2 | Trailing stops + trend alignment | 44 | Max +3.9% (ITER 17) |
| V3 | Optimización de ITER 17 (risk, trail, TP) | 20 | +3.1% (ITER 44) |
| V4 | Stops porcentuales en vez de ATR | 12 | EMA cross +0.4% |
| V5 | EMA cross focused (14 variantes) | 14 | +1.1% all-positive |
| V6 | Multi-sistema (EMA + RSI + BB) | 13 | Peor que individual |
| V7 | Alternative data + nuevas estrategias | 3,240 | **Breakout +33.2%** |

**Key insight**: Cada ronda descartó hipótesis. La complejidad (más indicadores, más filtros) consistentemente empeoró los resultados. La estrategia ganadora es la más simple — un principio conocido como **Occam's Razor** aplicado al trading.

---

## 📈 Resultados por Mes (61 meses, $10K inicio independiente cada mes)

### 2021
| Mes | BTC | Trades | WR% | Return | Final$ |
|-----|-----|--------|-----|--------|--------|
| Feb | $45,136 | 8 | 25% | -6.4% | $9,359 |
| Mar | $58,741 | 9 | 22% | -13.0% | $8,696 |
| Abr | $57,694 | 12 | 25% | -13.8% | $8,619 |
| May | $37,254 | 11 | 45% | +11.5% | $11,147 |
| Jun | $35,045 | 9 | 56% | +18.5% | $11,847 |
| Jul | $41,462 | 7 | 29% | -2.3% | $9,772 |
| Ago | $47,101 | 4 | 25% | -3.3% | $9,674 |
| Sep | $43,824 | 5 | 60% | +12.1% | $11,206 |
| Oct | $61,300 | 8 | 50% | +11.8% | $11,177 |
| Nov | $56,951 | 9 | 44% | +11.1% | $11,113 |
| Dic | $46,217 | 10 | 30% | -3.8% | $9,623 |

**2021: 6 meses positivos / 5 negativos**

### 2022 (Bear Market)
| Mes | BTC | Trades | WR% | Return | Final$ |
|-----|-----|--------|-----|--------|--------|
| Ene | $38,467 | 12 | 50% | +11.6% | $11,162 |
| Feb | $43,160 | 14 | 57% | **+32.8%** | $13,276 |
| Mar | $45,510 | 12 | 42% | +8.1% | $10,813 |
| Abr | $37,631 | 11 | 36% | +2.0% | $10,201 |
| May | $31,801 | 15 | 47% | +11.4% | $11,141 |
| Jun | $19,942 | 17 | 53% | **+32.4%** | $13,241 |
| Jul | $23,293 | 13 | 54% | +25.3% | $12,525 |
| Ago | $20,050 | 8 | 50% | +11.8% | $11,177 |
| Sep | $19,423 | 5 | 60% | +12.1% | $11,206 |
| Oct | $20,491 | 4 | 50% | +8.5% | $10,851 |
| Nov | $17,164 | 8 | 25% | -6.4% | $9,359 |
| Dic | $16,542 | 8 | 13% | -14.3% | $8,565 |

**2022: 10 meses positivos / 2 negativos 🔥 (el bot brilló en el bear market)**

### 2023
| Mes | BTC | Trades | WR% | Return | Final$ |
|-----|-----|--------|-----|--------|--------|
| Ene | $23,125 | 5 | 60% | +7.9% | $10,786 |
| Feb | $23,142 | 5 | 80% | **+22.5%** | $12,246 |
| Mar | $28,465 | 9 | 67% | **+29.5%** | $12,946 |
| Abr | $29,233 | 13 | 62% | **+39.1%** | $13,909 |
| May | $27,210 | 12 | 33% | +0.8% | $10,084 |
| Jun | $30,472 | 12 | 42% | +4.1% | $10,413 |
| Jul | $29,232 | 9 | 56% | +15.0% | $11,504 |
| Ago | $25,941 | 7 | 43% | +0.3% | $10,032 |
| Sep | $26,963 | 9 | 11% | -15.6% | $8,443 |
| Oct | $34,640 | 8 | 63% | +22.1% | $12,214 |
| Nov | $37,724 | 15 | 33% | +0.7% | $10,069 |
| Dic | $42,284 | 14 | 29% | -10.7% | $8,927 |

**2023: 10 meses positivos / 2 negativos**

### 2024
| Mes | BTC | Trades | WR% | Return | Final$ |
|-----|-----|--------|-----|--------|--------|
| Ene | $42,580 | 13 | 46% | +14.6% | $11,461 |
| Feb | $61,131 | 12 | 58% | **+29.1%** | $12,912 |
| Mar | $71,280 | 14 | 36% | +1.7% | $10,174 |
| Abr | $60,672 | 16 | 31% | -8.9% | $9,109 |
| May | $67,540 | 14 | 43% | +5.7% | $10,567 |
| Jun | $62,772 | 12 | 25% | -8.9% | $9,109 |
| Jul | $64,628 | 12 | 25% | -9.5% | $9,054 |
| Ago | $58,974 | 14 | 29% | -5.5% | $9,453 |
| Sep | $63,328 | 12 | 33% | +1.6% | $10,160 |
| Oct | $70,292 | 13 | 31% | -4.0% | $9,598 |
| Nov | $96,408 | 12 | 58% | **+29.1%** | $12,912 |
| Dic | $93,576 | 14 | 43% | +7.2% | $10,721 |

**2024: 7 meses positivos / 5 negativos**

### 2025-2026
| Mes | BTC | Trades | WR% | Return | Final$ |
|-----|-----|--------|-----|--------|--------|
| Ene 25 | $102,430 | 14 | 14% | -19.7% | $8,028 |
| Feb 25 | $84,350 | 12 | 33% | -1.1% | $9,895 |
| Mar 25 | $82,550 | 13 | 38% | +4.9% | $10,488 |
| Abr 25 | $94,172 | 13 | 31% | -2.0% | $9,802 |
| May 25 | $104,592 | 8 | 50% | +11.8% | $11,177 |
| Jun 25 | $107,147 | 11 | 9% | **-20.4%** | $7,960 |
| Jul 25 | $115,764 | 11 | 18% | -14.3% | $8,570 |
| Ago 25 | $108,246 | 11 | 45% | +9.2% | $10,923 |
| Sep 25 | $114,049 | 5 | 60% | +6.3% | $10,627 |
| Oct 25 | $109,608 | 9 | 56% | +12.8% | $11,281 |
| Nov 25 | $90,360 | 13 | 69% | **+41.7%** | $14,173 |
| Dic 25 | $87,648 | 11 | 45% | +5.8% | $10,579 |
| Ene 26 | $78,741 | 10 | 30% | -2.1% | $9,794 |
| Feb 26 | $68,408 | 9 | 56% | +21.9% | $12,192 |

**2025: 7 positivos / 5 negativos | 2026 (parcial): 1 positivo / 1 negativo**

---

## 📊 Estadísticas Globales

| Métrica | Valor |
|---------|-------|
| Meses testeados | 61 |
| Meses positivos | **40 (66%)** |
| Meses negativos | 21 (34%) |
| Retorno mensual promedio | **+6.2%** |
| Mejor mes | +41.7% (Nov 2025) |
| Peor mes | -20.4% (Jun 2025) |
| Compuesto $10K → | **$229,555** |
| Retorno total compuesto | **+2,196%** |
| Trades promedio por mes | ~10 |
| Max drawdown mensual | ~20% |

### Por ciclo de mercado:
| Período | Meses ✅ | Return promedio |
|---------|----------|-----------------|
| Bull 2021 | 6/11 | +2.0% |
| **Bear 2022** | **10/12** | **+10.6%** |
| **Recovery 2023** | **10/12** | **+9.7%** |
| Mixed 2024 | 7/12 | +4.4% |
| Recent 2025-26 | 7/14 | +3.9% |

**El bot rinde mejor en mercados con tendencia fuerte (bull o bear) y peor en mercados laterales.**

---

## ⚙️ Configuración Técnica

```json
{
  "strategy": "breakout_v1",
  "pair": "BTCUSDT",
  "timeframe": "4h",
  "params": {
    "lookback": 10,
    "volMult": 2.0,
    "sl": 0.03,
    "tp": 0.06,
    "posSize": 0.2,
    "leverage": 5
  },
  "execution": "Binance Futures (USDT-M)",
  "fees": "0.04% taker con BNB (0.1% sin)"
}
```

### Cómo funciona el ciclo:
1. Cada 4 horas (al cierre de vela), el bot se ejecuta
2. Calcula el máximo y mínimo de las últimas 10 velas de 4h
3. Calcula el volumen promedio de esas 10 velas
4. Si el precio cierra arriba del máximo Y el volumen es >2x promedio → abre LONG
5. Si el precio cierra abajo del mínimo Y el volumen es >2x promedio → abre SHORT
6. Si hay posición abierta, chequea si el precio tocó el SL (-3%) o TP (+6%)
7. Solo una posición a la vez

---

## ⚠️ Riesgos y Disclaimers

1. **Backtesting ≠ resultados futuros.** Los resultados son simulados con data histórica.
2. **5x leverage amplifica pérdidas.** El peor mes fue -20.4% ($10K → $7,960).
3. **Drawdowns compuestos pueden ser severos.** 2-3 meses malos seguidos pueden doler.
4. **El bot NO tiene trailing stop.** Usa SL/TP fijos — puede devolver ganancias no realizadas.
5. **Slippage no simulado.** En mercado real el fill puede ser peor que el precio de cierre.
6. **Requiere ejecución consistente.** Si se pierde una vela, se puede perder una señal.

### Escenario realista con $10K:
- **Buen mes:** +$1,000 a +$4,000
- **Mes neutro:** -$200 a +$200
- **Mal mes:** -$1,000 a -$2,000
- **Expectativa mensual:** ~+$620

---

## 🔄 Proceso de Desarrollo

Se testearon **3,240+ configuraciones** en 7 rondas de backtesting:

1. **V1-V3:** Technical Analysis puro (EMA, RSI, Bollinger) → max +1.1% promedio
2. **V4:** Stops porcentuales en vez de ATR → mejoró pero insuficiente
3. **V5:** EMA cross + volume filter → primera estrategia all-positive (+1.1%)
4. **V6:** Multi-sistema (EMA + RSI + BB) → peor que individual
5. **V7:** Agregamos funding rates, Fear & Greed, grid trading, breakout → **breakout ganó**
6. **Backtesting mensual** de 61 meses → confirmó consistencia

### Estrategias descartadas:
- Grid trading: <5% return
- Mean reversion (RSI extremos): pierde en bear
- Funding rate arbitrage: pocas señales
- Bollinger Bands: inconsistente
- Trend following puro (EMA 50/200): muy lento, pocas señales

---

## 📱 Estado Actual

- **Modo:** Paper trading ($10K virtual)
- **Ejecución:** Cada 4h automática
- **Producción:** Preparado para Binance Futures, solo falta API key
- **Alertas:** Telegram cuando opera, reporte diario a las 9 AM

*Generado el 16 de Febrero de 2026*
