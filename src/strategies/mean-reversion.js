/**
 * Approach 2: Mean Reversion with Bollinger Bands
 * 
 * Entry long: Price touches lower Bollinger Band (2 std) + RSI < 35 + previous candle was red
 * Entry short: Price touches upper Bollinger Band + RSI > 65 + previous candle was green
 * Exit: Price returns to middle band (SMA20) or stop at 1.5x ATR
 * Works best in ranging markets — detect with ADX < 25
 */

class MeanReversionStrategy {
    constructor(config = {}) {
        this.config = {
            riskPerTrade: config.riskPerTrade || 0.01,
            atrMultiplier: 1.5,
            bbPeriod: 20,
            bbStdDev: 2,
            rsiPeriod: 14,
            rsiOversold: 35,
            rsiOverbought: 65,
            adxPeriod: 14,
            adxRanging: 25, // ADX below this indicates ranging market
            ...config
        };
    }

    /**
     * Calculate indicators for mean reversion strategy
     */
    calculateIndicators(candles) {
        const indicators = {};
        
        // Bollinger Bands
        const bb = this.calculateBollingerBands(candles, this.config.bbPeriod, this.config.bbStdDev);
        indicators.bbUpper = bb.upper;
        indicators.bbMiddle = bb.middle;
        indicators.bbLower = bb.lower;
        
        // RSI
        indicators.rsi = this.calculateRSI(candles, this.config.rsiPeriod);
        
        // ATR for stops
        indicators.atr = this.calculateATR(candles, 14);
        
        // ADX for market regime detection
        indicators.adx = this.calculateADX(candles, this.config.adxPeriod);
        
        return indicators;
    }

    /**
     * Generate signals based on mean reversion logic
     */
    generateSignals(candles, config = {}) {
        if (candles.length < 50) {
            return []; // Need enough data for indicators
        }

        const effectiveConfig = { ...this.config, ...config };
        const indicators = this.calculateIndicators(candles);
        const signals = [];

        for (let i = 30; i < candles.length - 1; i++) {
            const current = candles[i];
            const previous = candles[i - 1];
            const next = candles[i + 1];

            const bbUpper = indicators.bbUpper[i];
            const bbMiddle = indicators.bbMiddle[i];
            const bbLower = indicators.bbLower[i];
            const currentRsi = indicators.rsi[i];
            const currentAtr = indicators.atr[i];
            const currentAdx = indicators.adx[i];

            if (!bbUpper || !bbMiddle || !bbLower || !currentRsi || !currentAtr || !currentAdx) {
                continue;
            }

            // Only trade in ranging markets (ADX < 25)
            if (currentAdx > this.config.adxRanging) {
                continue;
            }

            // LONG ENTRY CONDITIONS (Mean reversion from oversold)
            // 1. Price touches or goes below lower Bollinger Band
            // 2. RSI < 35 (oversold)
            // 3. Previous candle was red (selling pressure)
            if (current.low <= bbLower && 
                currentRsi < this.config.rsiOversold && 
                previous.close < previous.open) {
                
                const entry = next.open;
                const stop = entry - (currentAtr * this.config.atrMultiplier);
                const target = bbMiddle; // Target middle band
                const risk = entry - stop;
                
                if (risk > 0) {
                    const positionSize = (effectiveConfig.riskPerTrade * 10000) / risk;

                    signals.push({
                        timestamp: next.timestamp,
                        type: 'LONG',
                        entry: entry,
                        stop: stop,
                        target: target,
                        positionSize: positionSize,
                        risk: risk,
                        confidence: this.calculateConfidence(indicators, i, 'LONG'),
                        reason: 'Mean reversion: Oversold at lower BB, ranging market'
                    });
                }
            }

            // SHORT ENTRY CONDITIONS (Mean reversion from overbought)
            // 1. Price touches or goes above upper Bollinger Band
            // 2. RSI > 65 (overbought)
            // 3. Previous candle was green (buying pressure)
            if (current.high >= bbUpper && 
                currentRsi > this.config.rsiOverbought && 
                previous.close > previous.open) {
                
                const entry = next.open;
                const stop = entry + (currentAtr * this.config.atrMultiplier);
                const target = bbMiddle; // Target middle band
                const risk = stop - entry;
                
                if (risk > 0) {
                    const positionSize = (effectiveConfig.riskPerTrade * 10000) / risk;

                    signals.push({
                        timestamp: next.timestamp,
                        type: 'SHORT',
                        entry: entry,
                        stop: stop,
                        target: target,
                        positionSize: positionSize,
                        risk: risk,
                        confidence: this.calculateConfidence(indicators, i, 'SHORT'),
                        reason: 'Mean reversion: Overbought at upper BB, ranging market'
                    });
                }
            }
        }

        return signals;
    }

    calculateConfidence(indicators, index, type) {
        const rsi = indicators.rsi[index];
        const adx = indicators.adx[index];
        
        let confidence = 50;

        // Stronger signal when more oversold/overbought
        if (type === 'LONG') {
            confidence += Math.max(0, (35 - rsi) * 1.5); // More oversold = higher confidence
        } else {
            confidence += Math.max(0, (rsi - 65) * 1.5); // More overbought = higher confidence
        }

        // Lower ADX = better for mean reversion
        confidence += Math.max(0, (25 - adx) * 1.2);

        return Math.min(confidence, 100);
    }

    // Technical indicator calculations
    calculateBollingerBands(candles, period, stdDev) {
        const upper = [];
        const middle = [];
        const lower = [];

        for (let i = period - 1; i < candles.length; i++) {
            // Calculate SMA (middle band)
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += candles[i - j].close;
            }
            const sma = sum / period;
            middle[i] = sma;

            // Calculate standard deviation
            let variance = 0;
            for (let j = 0; j < period; j++) {
                variance += Math.pow(candles[i - j].close - sma, 2);
            }
            const std = Math.sqrt(variance / period);

            upper[i] = sma + (std * stdDev);
            lower[i] = sma - (std * stdDev);
        }

        return { upper, middle, lower };
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

        let sum = 0;
        for (let i = 1; i <= period; i++) {
            sum += tr[i];
        }
        atr[period] = sum / period;

        for (let i = period + 1; i < candles.length; i++) {
            atr[i] = ((atr[i - 1] * (period - 1)) + tr[i]) / period;
        }

        return atr;
    }

    calculateADX(candles, period) {
        const adx = [];
        const plusDI = [];
        const minusDI = [];
        const dx = [];

        // Calculate +DI, -DI, and DX
        for (let i = 1; i < candles.length; i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevHigh = candles[i - 1].high;
            const prevLow = candles[i - 1].low;
            const prevClose = candles[i - 1].close;

            const plusDM = (high - prevHigh) > (prevLow - low) ? Math.max(high - prevHigh, 0) : 0;
            const minusDM = (prevLow - low) > (high - prevHigh) ? Math.max(prevLow - low, 0) : 0;
            
            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );

            if (i >= period) {
                let plusDMSum = 0;
                let minusDMSum = 0;
                let trSum = 0;

                for (let j = 0; j < period; j++) {
                    const idx = i - j;
                    const h = candles[idx].high;
                    const l = candles[idx].low;
                    const ph = candles[idx - 1].high;
                    const pl = candles[idx - 1].low;
                    const pc = candles[idx - 1].close;

                    const pdm = (h - ph) > (pl - l) ? Math.max(h - ph, 0) : 0;
                    const mdm = (pl - l) > (h - ph) ? Math.max(pl - l, 0) : 0;
                    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));

                    plusDMSum += pdm;
                    minusDMSum += mdm;
                    trSum += tr;
                }

                plusDI[i] = (plusDMSum / trSum) * 100;
                minusDI[i] = (minusDMSum / trSum) * 100;

                const diSum = plusDI[i] + minusDI[i];
                if (diSum !== 0) {
                    dx[i] = Math.abs(plusDI[i] - minusDI[i]) / diSum * 100;
                } else {
                    dx[i] = 0;
                }
            }
        }

        // Calculate ADX (smoothed DX)
        if (dx.length >= period * 2) {
            let dxSum = 0;
            for (let i = period; i < period * 2; i++) {
                dxSum += dx[i] || 0;
            }
            adx[period * 2 - 1] = dxSum / period;

            for (let i = period * 2; i < candles.length; i++) {
                adx[i] = ((adx[i - 1] * (period - 1)) + (dx[i] || 0)) / period;
            }
        }

        return adx;
    }
}

export default MeanReversionStrategy;