/**
 * Conservative Hybrid Strategy (Modified)
 * Based on backtesting results - this is the "least bad" option
 * 
 * Rules:
 * 1. Only trade when strong trend confirmed (EMA50 > SMA200 by >2%)
 * 2. Enter on pullbacks to EMA21 (not EMA50)
 * 3. Use 1.5% risk (lower than tested 2%)
 * 4. Target 2:1 R/R minimum
 * 5. Max 1 trade per week to reduce fee impact
 * 6. Macro filter: Consider market conditions
 */

class ConservativeHybridStrategy {
    constructor(config = {}) {
        this.config = {
            riskPerTrade: config.riskPerTrade || 0.015, // 1.5% risk
            trendEma: 50,
            filterSma: 200,
            entryEma: 21,
            trendThreshold: 0.02, // 2% minimum separation
            minRiskReward: 2.0, // 2:1 minimum R/R
            atrMultiplier: 2.0,
            rsiConfirmation: 50,
            maxTradesPerWeek: 1,
            cooldownHours: 168, // 1 week = 168 hours (42 * 4H candles)
            ...config
        };
        
        this.lastTradeTime = 0;
    }

    /**
     * Calculate indicators
     */
    calculateIndicators(candles) {
        const indicators = {};
        
        indicators.ema50 = this.calculateEMA(candles, this.config.trendEma);
        indicators.sma200 = this.calculateSMA(candles, this.config.filterSma);
        indicators.ema21 = this.calculateEMA(candles, this.config.entryEma);
        indicators.rsi = this.calculateRSI(candles, 14);
        indicators.atr = this.calculateATR(candles, 14);
        
        return indicators;
    }

    /**
     * Generate signals with conservative approach
     */
    generateSignals(candles, config = {}) {
        if (candles.length < 250) {
            return [];
        }

        const effectiveConfig = { ...this.config, ...config };
        const indicators = this.calculateIndicators(candles);
        const signals = [];

        for (let i = 220; i < candles.length - 1; i++) {
            const current = candles[i];
            const previous = candles[i - 1];
            const next = candles[i + 1];

            const ema50 = indicators.ema50[i];
            const sma200 = indicators.sma200[i];
            const ema21 = indicators.ema21[i];
            const prevEma21 = indicators.ema21[i - 1];
            const rsi = indicators.rsi[i];
            const atr = indicators.atr[i];

            if (!ema50 || !sma200 || !ema21 || !prevEma21 || !rsi || !atr) {
                continue;
            }

            // Check cooldown period (max 1 trade per week)
            const currentTime = current.timestamp;
            if (currentTime - this.lastTradeTime < this.config.cooldownHours * 4 * 60 * 60 * 1000) {
                continue;
            }

            // STRONG UPTREND CHECK (EMA50 > SMA200 by at least 2%)
            const trendStrength = (ema50 - sma200) / sma200;
            if (trendStrength > this.config.trendThreshold) {
                
                // PULLBACK TO EMA21 (long entry)
                if (previous.close > prevEma21 && current.low <= ema21 && 
                    current.close > ema21 && rsi > this.config.rsiConfirmation) {
                    
                    const entry = next.open;
                    const stop = current.low - (atr * 0.5); // Stop below pullback low with buffer
                    const risk = entry - stop;
                    
                    if (risk > 0) {
                        const target = entry + (risk * this.config.minRiskReward);
                        const positionSize = (effectiveConfig.riskPerTrade * 10000) / risk;
                        const riskReward = (target - entry) / risk;

                        // Only take trade if R/R meets minimum
                        if (riskReward >= this.config.minRiskReward) {
                            signals.push({
                                timestamp: next.timestamp,
                                type: 'LONG',
                                entry: entry,
                                stop: stop,
                                target: target,
                                positionSize: positionSize,
                                risk: risk,
                                confidence: this.calculateConfidence(trendStrength, rsi, riskReward),
                                reason: `Conservative: Strong uptrend + EMA21 pullback + ${riskReward.toFixed(1)}:1 R/R`,
                                trendStrength: trendStrength,
                                riskReward: riskReward
                            });

                            this.lastTradeTime = currentTime;
                        }
                    }
                }
            }

            // STRONG DOWNTREND CHECK (EMA50 < SMA200 by at least 2%)
            if (trendStrength < -this.config.trendThreshold) {
                
                // BOUNCE TO EMA21 (short entry)
                if (previous.close < prevEma21 && current.high >= ema21 && 
                    current.close < ema21 && rsi < (100 - this.config.rsiConfirmation)) {
                    
                    const entry = next.open;
                    const stop = current.high + (atr * 0.5); // Stop above bounce high with buffer
                    const risk = stop - entry;
                    
                    if (risk > 0) {
                        const target = entry - (risk * this.config.minRiskReward);
                        const positionSize = (effectiveConfig.riskPerTrade * 10000) / risk;
                        const riskReward = (entry - target) / risk;

                        // Only take trade if R/R meets minimum
                        if (riskReward >= this.config.minRiskReward) {
                            signals.push({
                                timestamp: next.timestamp,
                                type: 'SHORT',
                                entry: entry,
                                stop: stop,
                                target: target,
                                positionSize: positionSize,
                                risk: risk,
                                confidence: this.calculateConfidence(Math.abs(trendStrength), 100 - rsi, riskReward),
                                reason: `Conservative: Strong downtrend + EMA21 bounce + ${riskReward.toFixed(1)}:1 R/R`,
                                trendStrength: trendStrength,
                                riskReward: riskReward
                            });

                            this.lastTradeTime = currentTime;
                        }
                    }
                }
            }
        }

        return signals;
    }

    calculateConfidence(trendStrength, rsiScore, riskReward) {
        let confidence = 60; // Base confidence for conservative approach
        
        // Stronger trend = higher confidence
        confidence += Math.min(trendStrength * 500, 20);
        
        // Better RSI positioning
        confidence += Math.min(Math.abs(rsiScore - 50) / 5, 10);
        
        // Better risk/reward
        confidence += Math.min((riskReward - 2) * 10, 10);
        
        return Math.min(confidence, 100);
    }

    // Technical indicator calculations (same as other strategies)
    calculateEMA(candles, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);
        
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += candles[i].close;
        }
        ema[period - 1] = sum / period;

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

    /**
     * Get strategy description for reporting
     */
    getDescription() {
        return `Conservative Hybrid: ${this.config.trendThreshold * 100}% trend filter, EMA21 pullbacks, ${this.config.minRiskReward}:1 R/R, max ${this.config.maxTradesPerWeek}/week`;
    }
}

export default ConservativeHybridStrategy;