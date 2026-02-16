/**
 * Approach 1: Trend Following Only (Simplified)
 * 
 * Entry: Price crosses above EMA50 AND EMA50 > SMA200 (golden cross area), confirmed by RSI > 50
 * Exit: Price crosses below EMA50 OR trailing stop at 2x ATR
 * Only long in uptrends, only short (or stay flat) in downtrends
 */

class TrendFollowingStrategy {
    constructor(config = {}) {
        this.config = {
            riskPerTrade: config.riskPerTrade || 0.01,
            atrMultiplier: 2.0,
            rsiConfirmation: 50,
            ...config
        };
    }

    /**
     * Calculate indicators for trend following strategy
     */
    calculateIndicators(candles) {
        const indicators = {};
        
        // EMA 50
        indicators.ema50 = this.calculateEMA(candles, 50);
        
        // SMA 200
        indicators.sma200 = this.calculateSMA(candles, 200);
        
        // RSI 14
        indicators.rsi = this.calculateRSI(candles, 14);
        
        // ATR for stops
        indicators.atr = this.calculateATR(candles, 14);
        
        return indicators;
    }

    /**
     * Generate signals based on trend following logic
     */
    generateSignals(candles, config = {}) {
        if (candles.length < 250) {
            return []; // Need enough data for SMA200
        }

        const effectiveConfig = { ...this.config, ...config };
        const indicators = this.calculateIndicators(candles);
        const signals = [];

        for (let i = 200; i < candles.length - 1; i++) {
            const current = candles[i];
            const previous = candles[i - 1];
            const next = candles[i + 1];

            const currentEma50 = indicators.ema50[i];
            const previousEma50 = indicators.ema50[i - 1];
            const currentSma200 = indicators.sma200[i];
            const currentRsi = indicators.rsi[i];
            const currentAtr = indicators.atr[i];

            if (!currentEma50 || !previousEma50 || !currentSma200 || !currentRsi || !currentAtr) {
                continue;
            }

            // LONG ENTRY CONDITIONS
            // 1. Price crosses above EMA50
            // 2. EMA50 > SMA200 (uptrend)
            // 3. RSI > 50 (momentum confirmation)
            if (previous.close <= previousEma50 && 
                current.close > currentEma50 && 
                currentEma50 > currentSma200 && 
                currentRsi > this.config.rsiConfirmation) {
                
                const entry = next.open;
                const stop = entry - (currentAtr * this.config.atrMultiplier);
                const risk = entry - stop;
                const positionSize = (effectiveConfig.riskPerTrade * 10000) / risk;

                signals.push({
                    timestamp: next.timestamp,
                    type: 'LONG',
                    entry: entry,
                    stop: stop,
                    target: null, // Use trailing stop instead
                    positionSize: positionSize,
                    risk: risk,
                    confidence: this.calculateConfidence(indicators, i),
                    reason: 'Trend following: Price crosses above EMA50, uptrend confirmed'
                });
            }

            // SHORT ENTRY CONDITIONS (for downtrends)
            // 1. Price crosses below EMA50
            // 2. EMA50 < SMA200 (downtrend)
            // 3. RSI < 50
            if (previous.close >= previousEma50 && 
                current.close < currentEma50 && 
                currentEma50 < currentSma200 && 
                currentRsi < (100 - this.config.rsiConfirmation)) {
                
                const entry = next.open;
                const stop = entry + (currentAtr * this.config.atrMultiplier);
                const risk = stop - entry;
                const positionSize = (effectiveConfig.riskPerTrade * 10000) / risk;

                signals.push({
                    timestamp: next.timestamp,
                    type: 'SHORT',
                    entry: entry,
                    stop: stop,
                    target: null, // Use trailing stop instead
                    positionSize: positionSize,
                    risk: risk,
                    confidence: this.calculateConfidence(indicators, i),
                    reason: 'Trend following: Price crosses below EMA50, downtrend confirmed'
                });
            }
        }

        return signals;
    }

    calculateConfidence(indicators, index) {
        // Simple confidence based on trend strength
        const ema50 = indicators.ema50[index];
        const sma200 = indicators.sma200[index];
        const rsi = indicators.rsi[index];

        let confidence = 50;

        // Trend strength
        const trendStrength = Math.abs((ema50 - sma200) / sma200) * 100;
        confidence += Math.min(trendStrength * 2, 30);

        // RSI momentum
        if ((rsi > 50 && ema50 > sma200) || (rsi < 50 && ema50 < sma200)) {
            confidence += 10;
        }

        return Math.min(confidence, 100);
    }

    // Technical indicator calculations
    calculateEMA(candles, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);
        
        // Start with SMA for first value
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += candles[i].close;
        }
        ema[period - 1] = sum / period;

        // Calculate EMA for remaining values
        for (let i = period; i < candles.length; i++) {
            ema[i] = (candles[i].close - ema[i - 1]) * multiplier + ema[i - 1];
        }

        return ema;
    }

    calculateSMA(candles, period) {
        const sma = [];
        for (let i = period - 1; i < candles.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += candles[i - j].close;
            }
            sma[i] = sum / period;
        }
        return sma;
    }

    calculateRSI(candles, period) {
        const rsi = [];
        const gains = [];
        const losses = [];

        for (let i = 1; i < candles.length; i++) {
            const change = candles[i].close - candles[i - 1].close;
            gains[i] = change > 0 ? change : 0;
            losses[i] = change < 0 ? -change : 0;
        }

        let avgGain = 0;
        let avgLoss = 0;

        // Initial average
        for (let i = 1; i <= period; i++) {
            avgGain += gains[i] || 0;
            avgLoss += losses[i] || 0;
        }
        avgGain /= period;
        avgLoss /= period;

        if (avgLoss === 0) {
            rsi[period] = 100;
        } else {
            const rs = avgGain / avgLoss;
            rsi[period] = 100 - (100 / (1 + rs));
        }

        // Subsequent RSI values
        for (let i = period + 1; i < candles.length; i++) {
            avgGain = ((avgGain * (period - 1)) + (gains[i] || 0)) / period;
            avgLoss = ((avgLoss * (period - 1)) + (losses[i] || 0)) / period;

            if (avgLoss === 0) {
                rsi[i] = 100;
            } else {
                const rs = avgGain / avgLoss;
                rsi[i] = 100 - (100 / (1 + rs));
            }
        }

        return rsi;
    }

    calculateATR(candles, period) {
        const tr = [];
        const atr = [];

        // Calculate True Range
        for (let i = 1; i < candles.length; i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevClose = candles[i - 1].close;

            tr[i] = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
        }

        // Calculate initial ATR (SMA of TR)
        let sum = 0;
        for (let i = 1; i <= period; i++) {
            sum += tr[i];
        }
        atr[period] = sum / period;

        // Calculate subsequent ATR values (smoothed)
        for (let i = period + 1; i < candles.length; i++) {
            atr[i] = ((atr[i - 1] * (period - 1)) + tr[i]) / period;
        }

        return atr;
    }
}

export default TrendFollowingStrategy;