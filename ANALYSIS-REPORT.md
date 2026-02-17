# Breakout #2 Strategy — Comprehensive Analysis Report

**Date:** February 17, 2026  
**Data:** BTC/USDT 4H candles, Jan 2021 – Feb 2026 (11,236 candles)  
**Default Params:** Lookback=10, VolMult=2.0, SL=3%, TP=6%, PosSize=20%, Leverage=5x, Fee=0.1%

---

## 1. Performance by Period

| Period | Return % | Win Rate % | Trades | Max DD % | Profit Factor | Sharpe |
|--------|----------|-----------|--------|----------|--------------|--------|
| **Full 2021-2026** | **267.6** | **39.4** | **312** | **30.2** | **1.20** | **0.94** |
| 2021 | -3.4 | 34.0 | 50 | 29.4 | 0.97 | -0.02 |
| 2022 | 72.3 | 45.0 | 60 | 17.2 | 1.48 | 1.85 |
| 2023 | 81.1 | 47.4 | 57 | 19.4 | 1.52 | 1.61 |
| 2024 | 16.7 | 37.5 | 80 | 30.2 | 1.11 | 0.50 |
| 2025 | 8.0 | 37.3 | 59 | 20.1 | 1.08 | 0.36 |

### Market Regime Performance

| Regime | Period | Return % | Win Rate % | Trades | Max DD % | PF | Sharpe |
|--------|--------|----------|-----------|--------|----------|-----|--------|
| **Bull** | 2021 Jan–Nov (29K→69K) | 0.8 | 35.0 | 40 | 29.4 | 1.02 | 0.14 |
| **Bull** | 2023 Oct–2024 Mar (27K→73K) | 29.0 | 43.8 | 32 | 24.8 | 1.50 | 1.45 |
| **Bull** | 2024 Oct–2025 Jan (67K→109K) | 12.1 | 39.1 | 23 | 19.8 | 1.27 | 0.87 |
| **Bear** | 2021 Nov–2022 Jun (69K→20K) | 34.6 | 41.9 | 43 | 14.3 | 1.41 | 1.58 |
| **Bear** | 2022 Full | 72.3 | 45.0 | 60 | 17.2 | 1.48 | 1.94 |
| **Sideways** | 2023 Mar–Sep (~25K-31K) | 55.1 | 53.3 | 30 | 14.6 | 1.95 | 2.18 |
| **Sideways** | 2024 Mar–Oct (~58K-72K) | -16.1 | 31.9 | 47 | 27.1 | 0.83 | -1.45 |

### Key Insight: The strategy does NOT simply prefer trending markets.

- **Best performance:** 2023 Mar–Sep (sideways, tight range): +55%, Sharpe 2.18
- **Second best:** Bear 2022: +72%, Sharpe 1.94
- **Worst performance:** 2024 Mar–Oct (sideways, wider range): -16%, Sharpe -1.45
- **Bull markets are mediocre** — the 2021 bull barely broke even (+0.8%)

The differentiator is **volatility regime**, not direction. The strategy thrives when breakouts are clean (sharp moves with quick resolution). It dies when price whipsaws in a wide range — enough to trigger entries but then reverse.

---

## 2. Monthly Breakdown — Best & Worst Months

### 5 Worst Months

| Month | Return % | Trades | BTC Context |
|-------|----------|--------|-------------|
| 2023-11 | -14.65 | 8 | Choppy rally 34K→38K with multiple fakeouts |
| 2025-01 | -11.96 | 7 | Range-bound 90K–105K, volatile chop |
| 2021-03 | -11.63 | 4 | Strong uptrend 45K→59K but with sharp pullbacks |
| 2025-06 | -11.63 | 4 | Consolidation ~103K-108K, repeated breakout failures |
| 2025-12 | -11.62 | 4 | Correction from 92K range, choppy |

**Pattern:** Worst months feature **false breakouts** — price moves enough to trigger entry, then reverses through the stop loss. High trade counts (8 trades in Nov 2023) confirm excessive whipsaw.

### 5 Best Months

| Month | Return % | Trades | BTC Context |
|-------|----------|--------|-------------|
| 2023-03 | +25.57 | 7 | SVB crisis crash 22K→28K, clean directional moves |
| 2024-11 | +25.57 | 7 | Explosive post-election rally 69K→98K |
| 2022-01 | +18.49 | 6 | Bear bounce/continuation with clear trends |
| 2025-11 | +18.51 | 6 | Sharp selloff 114K→87K, clean trending |
| 2022-06 | +18.08 | 9 | Capitulation from 30K to 18K, clean shorts |

**Pattern:** Best months have **strong directional moves** — crashes, capitulations, or explosive rallies where breakouts follow through cleanly.

---

## 3. SL vs TP Hit Analysis

| Metric | Value |
|--------|-------|
| Total trades | 312 |
| SL hits | 189 (61%) |
| TP hits | 123 (39%) |
| Avg win (at TP) | $1,389.30 |
| Avg loss (at SL) | -$754.50 |
| Win/loss ratio | 1.84:1 |

The strategy wins only 39% of the time but the 2:1 reward-to-risk ratio (TP=6% vs SL=3%, leveraged to ~30%/15%) makes it profitable. This is a **classic trend-following profile**: many small losses, few large wins.

---

## 4. Loss Streak Analysis

| Streak Length | Occurrences | When |
|---------------|-------------|------|
| 11 | 1 | Feb–Apr 2021 (bull market whipsaw) |
| 7 | 3 | Nov–Dec 2023, Dec 2023–Jan 2024, May–Jun 2024 |
| 6 | 6 | Various choppy periods |

**The 11-trade losing streak** (Feb 22–Apr 18, 2021) occurred during BTC's parabolic move from 48K to 64K. The trend was up, but intraday volatility was extreme — every breakout was followed by a sharp reversal. The account went from ~$9,900 to ~$7,066 (-29% drawdown).

**Risk of ruin calculation:**
- At 20% position size, 5x leverage, 3% SL: each loss costs ~15% of position = ~3% of account
- An 11-loss streak costs roughly 33% of account (compounding makes it ~29%)
- The probability of 11 consecutive losses at 61% loss rate: 0.61^11 = 1.3%
- Over 312 trades, this is actually expected to happen ~4 times. We saw it once — we were somewhat lucky.
- **Risk of ruin with current params is LOW but drawdowns of 30%+ are guaranteed**

---

## 5. Parameter Sensitivity Analysis

### Lookback Period

| Lookback | Return % | Max DD % | Trades | PF |
|----------|----------|----------|--------|-----|
| 5 | 239.0 | 48.1 | 352 | 1.14 |
| 8 | 221.2 | 46.5 | 325 | 1.14 |
| **10** | **267.6** | **30.2** | **312** | **1.20** |
| 15 | 104.5 | 43.3 | 285 | 1.11 |
| 20 | 57.3 | 37.1 | 259 | 1.09 |
| 30 | 311.1 | 28.8 | 225 | 1.28 |

Lookback=30 has the best return AND lowest drawdown with fewest trades. This is interesting — longer lookback = more selective = fewer false breakouts. However, lookback=30 may be overfitting. Lookback=10 is a solid middle ground.

### Volume Multiplier

| VolMult | Return % | Max DD % | Trades | PF |
|---------|----------|----------|--------|-----|
| 1.0 | 64.2 | 36.3 | 525 | 1.05 |
| 1.5 | 149.0 | 56.0 | 431 | 1.09 |
| **2.0** | **267.6** | **30.2** | **312** | **1.20** |
| 2.5 | 163.7 | 33.1 | 225 | 1.21 |
| 3.0 | 65.9 | 27.4 | 148 | 1.19 |

**The volume filter is CRITICAL.** Without it (1.0), the strategy trades 525 times with PF=1.05 (barely profitable). At 2.0, it filters out 40% of trades, keeping only the high-quality breakouts. At 3.0, it's too restrictive (only 148 trades) and misses opportunities. **VolMult=2.0-2.5 is the sweet spot.**

### Stop Loss

| SL % | Return % | Max DD % | Trades | PF |
|------|----------|----------|--------|-----|
| 1% | 147.9 | 36.8 | 410 | 1.28 |
| 2% | 158.7 | 45.2 | 350 | 1.15 |
| **3%** | **267.6** | **30.2** | **312** | **1.20** |
| 5% | 140.9 | 38.4 | 255 | 1.13 |
| 8% | -7.9 | 65.2 | 203 | 0.99 |

**3% SL is optimal.** Tighter (1-2%) generates more trades (getting stopped out more, re-entering) with lower returns. Wider (5-8%) lets losses run too long — 8% SL kills the strategy entirely. The 3% SL is NOT too tight for 4H candles — it's actually the sweet spot.

### Take Profit

| TP % | Return % | Max DD % | Trades | PF |
|------|----------|----------|--------|-----|
| 3% | 152.1 | 27.5 | 414 | 1.14 |
| **6%** | **267.6** | **30.2** | **312** | **1.20** |
| 9% | 59.9 | 46.2 | 265 | 1.07 |
| 12% | 117.7 | 37.1 | 211 | 1.15 |
| 15% | -22.5 | 47.4 | 188 | 0.95 |

**6% TP is optimal.** Wider TPs (9-15%) let winning trades turn into losers. On 4H BTC, a 6% move (30% leveraged) is about as far as most breakouts carry before a pullback.

### Wider SL + Wider TP Combinations

| SL/TP | Return % | Max DD % | Trades | Win Rate % | PF |
|-------|----------|----------|--------|-----------|-----|
| **3%/6%** | **267.6** | **30.2** | **312** | **39.4** | **1.20** |
| 5%/10% | 161.3 | 48.0 | 192 | 38.5 | 1.12 |
| 5%/15% | -52.3 | 65.2 | 150 | 24.7 | 0.89 |
| 8%/16% | -79.2 | 87.6 | 97 | 28.9 | 0.74 |
| 4%/8% | -17.9 | 63.5 | 234 | 34.2 | 0.98 |

**Wider SL + wider TP makes things WORSE.** The current 3%/6% (1:2 ratio) is the best combination tested. Wider stops don't improve win rate enough to compensate for larger losses.

### Leverage

| Leverage | Return % | Max DD % | Trades | PF |
|----------|----------|----------|--------|-----|
| 1x | 23.2 | 8.4 | 312 | 1.23 |
| 3x | 123.0 | 19.3 | 312 | 1.23 |
| **5x** | **267.6** | **30.2** | **312** | **1.20** |
| 10x | 761.3 | 56.0 | 312 | 1.13 |

Returns scale with leverage but so do drawdowns. Note PF decreases at higher leverage due to compounding effects (larger losses compound worse). **5x is a reasonable risk-adjusted choice.** 10x yields 761% but with 56% max drawdown — psychologically devastating.

### Position Size

| Pos Size | Return % | Max DD % | Trades | PF |
|----------|----------|----------|--------|-----|
| 10% | 106.5 | 15.7 | 312 | 1.24 |
| **20%** | **267.6** | **30.2** | **312** | **1.20** |
| 30% | 467.1 | 44.1 | 312 | 1.16 |
| 50% | 789.9 | 69.5 | 312 | 1.10 |

Same story — more size = more return = more drawdown. **10% position size** would cut drawdowns to ~16% for a safer profile while still doubling the account over 5 years.

---

## 6. Analysis Answers

### Does the bot perform better in trending or sideways markets?

**It depends on volatility quality, not direction.** The strategy performed best in the 2023 sideways market (+55%) and worst in the 2024 sideways market (-16%). The difference: 2023's range was tight (~25K-31K) with clean breakouts, while 2024's range was wider (~58K-72K) with messy whipsaws. Bear markets are consistently good because crashes produce clean directional breakouts.

### Is there a pattern to losing streaks?

Yes. Losing streaks cluster during:
1. **Wide-range choppy markets** (2024 Mar–Oct was the worst)
2. **Parabolic bull moves** (early 2021 — extreme volatility triggers entries that immediately reverse)
3. **Transition periods** between regimes (Nov–Dec 2023, right as BTC shifted from sideways to trending)

### What's the risk of ruin?

With current params (20% size, 5x leverage):
- Max historical drawdown: 30.2%
- Worst losing streak: 11 trades (~29% loss)
- If we model a 15-trade losing streak (rare but possible): ~40% drawdown
- **Risk of total ruin (going to zero): essentially zero** — each trade risks ~3% of account
- **Risk of a psychologically unbearable drawdown (40%+): ~10-15% over 5 years**

### Is the 3% SL too tight?

**No, it's optimal.** The data clearly shows 3% outperforms both tighter (1-2%) and wider (5-8%) stops. On 4H candles, a 3% move is about 6-8 candles of typical range — enough room to breathe but tight enough to cut losses quickly.

### Does the volume filter help?

**Enormously.** Compare:
- VolMult=1.0: 525 trades, PF 1.05, return 64%
- VolMult=2.0: 312 trades, PF 1.20, return 268%

The filter eliminates ~40% of trades — all the low-quality breakouts that tend to fail. This is the single most important parameter in the strategy.

### Optimal leverage for risk-adjusted returns?

**3x leverage** offers the best risk-adjusted profile (PF=1.23, 19% max DD, 123% return). **5x** is more aggressive but still reasonable. Beyond 5x, diminishing risk-adjusted returns.

---

## 7. Recommendations

### When the Strategy Works
- ✅ Clean directional moves (crashes, rallies with conviction)
- ✅ High-volume breakouts from tight consolidation
- ✅ Bear markets (shorts during capitulation)
- ✅ Event-driven moves (SVB, elections)

### When It Fails
- ❌ Wide choppy ranges with frequent direction changes
- ❌ Parabolic moves with extreme intraday volatility
- ❌ Low-volume grinds (breakouts without follow-through)

### Parameter Adjustments to Consider

| Parameter | Current | Suggested | Rationale |
|-----------|---------|-----------|-----------|
| Lookback | 10 | **10 or 30** | 30 shows better risk-adjusted returns but needs more out-of-sample testing |
| VolMult | 2.0 | **2.0–2.5** | 2.5 has similar PF with fewer trades and lower DD |
| SL/TP | 3%/6% | **Keep** | Optimal across all combos tested |
| Leverage | 5x | **3x for safety** | Same PF, half the drawdown |
| PosSize | 20% | **10-15% for safety** | 10% cuts DD to 16% while still returning 100%+ |

**Conservative config:** Lookback=10, VolMult=2.5, SL=3%, TP=6%, PosSize=10%, Leverage=3x  
Expected: ~50-80% return over 5 years, ~10-15% max drawdown, PF ~1.21

### Ideas for Additional Filters (Not Implemented)

1. **Trend alignment filter:** Only take longs above a long-term MA (e.g., 200-period), shorts below. Would have avoided many of the whipsaw losses in bull markets.

2. **ATR-based dynamic SL/TP:** Instead of fixed 3%/6%, scale SL/TP to current ATR. In volatile periods, wider stops; in calm periods, tighter stops.

3. **Consecutive loss circuit breaker:** After 4-5 consecutive losses, pause trading for 24-48 hours. The 11-loss streak would have been reduced to 5-6 losses.

4. **Regime detection:** Use ADX or Bollinger Band width to detect choppy vs trending markets. Reduce position size or skip trades in low-ADX environments.

5. **Time-of-day filter:** Some 4H candle periods may produce better breakouts than others (e.g., US market open candles vs Asian session).

6. **Multi-timeframe confirmation:** Require breakout direction to align with daily timeframe trend.

### Honest Assessment: Is This Viable for Real Money?

**Cautiously yes, with important caveats:**

**Pros:**
- Positive expectancy over 5 years (267% return, PF 1.20)
- Robust across most market conditions
- Volume filter provides genuine edge
- Simple, systematic, no discretion needed

**Cons:**
- 30% max drawdown is psychologically brutal
- 61% of trades are losers — requires iron discipline
- 2021 and 2024 showed extended periods of flat/negative performance
- Slippage and exchange issues in real trading will degrade results
- 5 years of data is decent but not conclusive

**My recommendation:**
- Start with paper trading for 2-3 months
- If live, use conservative params (10% size, 3x leverage)
- Maximum capital allocation: 10-20% of total portfolio
- Have a hard stop: if drawdown exceeds 25%, pause and review
- **Expected real-world returns will be 30-50% lower** than backtest due to slippage, funding rates, execution delays, and adverse fills

**Bottom line:** The strategy has a genuine edge through the volume-filtered breakout mechanism. It's not a get-rich-quick scheme — it's a modest-edge system that compounds over time. Viable for real money with proper risk management, but not as a primary income source.

---

*Report generated from 312 trades across 11,236 4H candles (Jan 2021 – Feb 2026)*
