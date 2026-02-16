/**
 * Technical Indicators Module
 * Implements key indicators from the trading framework using technicalindicators package
 */

import { 
    RSI, 
    MACD, 
    EMA, 
    SMA, 
    BollingerBands, 
    ATR, 
    ADX,
    StochasticRSI,
    OBV
} from 'technicalindicators';

class TechnicalIndicators {
    constructor() {
        // Default periods based on trading framework
        this.periods = {
            rsi: 14,
            macd: { fast: 12, slow: 26, signal: 9 },
            ema: [21, 50, 200],
            sma: [50, 200],
            bb: { period: 20, stdDev: 2 },
            atr: 14,
            adx: 14,
            stochRsi: { rsiPeriod: 14, stochPeriod: 14, kPeriod: 3, dPeriod: 3 }
        };
    }

    /**
     * Calculate RSI (Relative Strength Index)
     */
    calculateRSI(closes, period = this.periods.rsi) {
        try {
            if (closes.length < period + 1) {
                return { current: null, values: [], signal: 'neutral' };
            }

            const rsiValues = RSI.calculate({
                values: closes,
                period: period
            });

            const current = rsiValues[rsiValues.length - 1];
            
            // Generate signal
            let signal = 'neutral';
            if (current > 70) signal = 'overbought';
            else if (current < 30) signal = 'oversold';
            else if (current > 50) signal = 'bullish';
            else signal = 'bearish';

            return {
                current,
                values: rsiValues,
                signal,
                overbought: current > 70,
                oversold: current < 30
            };
        } catch (error) {
            console.error('Error calculating RSI:', error);
            return { current: null, values: [], signal: 'neutral' };
        }
    }

    /**
     * Calculate MACD (Moving Average Convergence Divergence)
     */
    calculateMACD(closes) {
        try {
            if (closes.length < this.periods.macd.slow + this.periods.macd.signal) {
                return { current: null, values: [], signal: 'neutral' };
            }

            const macdValues = MACD.calculate({
                values: closes,
                fastPeriod: this.periods.macd.fast,
                slowPeriod: this.periods.macd.slow,
                signalPeriod: this.periods.macd.signal,
                SimpleMAOscillator: false,
                SimpleMASignal: false
            });

            if (macdValues.length === 0) {
                return { current: null, values: [], signal: 'neutral' };
            }

            const current = macdValues[macdValues.length - 1];
            const previous = macdValues[macdValues.length - 2] || current;
            
            // Generate signal
            let signal = 'neutral';
            if (current.MACD > current.signal) {
                signal = previous.MACD <= previous.signal ? 'bullish_crossover' : 'bullish';
            } else {
                signal = previous.MACD >= previous.signal ? 'bearish_crossover' : 'bearish';
            }

            return {
                current,
                values: macdValues,
                signal,
                histogram: current.histogram,
                bullishCrossover: current.MACD > current.signal && previous.MACD <= previous.signal,
                bearishCrossover: current.MACD < current.signal && previous.MACD >= previous.signal
            };
        } catch (error) {
            console.error('Error calculating MACD:', error);
            return { current: null, values: [], signal: 'neutral' };
        }
    }

    /**
     * Calculate EMAs (Exponential Moving Averages)
     */
    calculateEMAs(closes) {
        const emas = {};
        
        for (const period of this.periods.ema) {
            try {
                if (closes.length >= period) {
                    const emaValues = EMA.calculate({
                        values: closes,
                        period: period
                    });
                    
                    emas[`ema${period}`] = {
                        current: emaValues[emaValues.length - 1],
                        values: emaValues
                    };
                }
            } catch (error) {
                console.error(`Error calculating EMA${period}:`, error);
                emas[`ema${period}`] = { current: null, values: [] };
            }
        }

        // Check trend alignment: Price > EMA21 > EMA50 > SMA200
        const currentPrice = closes[closes.length - 1];
        const trendAlignment = this.checkTrendAlignment(currentPrice, emas);

        return { ...emas, trendAlignment };
    }

    /**
     * Calculate SMAs (Simple Moving Averages)
     */
    calculateSMAs(closes) {
        const smas = {};
        
        for (const period of this.periods.sma) {
            try {
                if (closes.length >= period) {
                    const smaValues = SMA.calculate({
                        values: closes,
                        period: period
                    });
                    
                    smas[`sma${period}`] = {
                        current: smaValues[smaValues.length - 1],
                        values: smaValues
                    };
                }
            } catch (error) {
                console.error(`Error calculating SMA${period}:`, error);
                smas[`sma${period}`] = { current: null, values: [] };
            }
        }

        return smas;
    }

    /**
     * Calculate Bollinger Bands
     */
    calculateBollingerBands(closes) {
        try {
            if (closes.length < this.periods.bb.period) {
                return { current: null, values: [], signal: 'neutral' };
            }

            const bbValues = BollingerBands.calculate({
                values: closes,
                period: this.periods.bb.period,
                stdDev: this.periods.bb.stdDev
            });

            if (bbValues.length === 0) {
                return { current: null, values: [], signal: 'neutral' };
            }

            const current = bbValues[bbValues.length - 1];
            const currentPrice = closes[closes.length - 1];
            
            // Generate signals
            let signal = 'neutral';
            const upperBreakout = currentPrice > current.upper;
            const lowerBreakout = currentPrice < current.lower;
            const squeeze = (current.upper - current.lower) / current.middle < 0.1; // 10% band width

            if (upperBreakout) signal = 'breakout_up';
            else if (lowerBreakout) signal = 'breakout_down';
            else if (squeeze) signal = 'squeeze';

            return {
                current,
                values: bbValues,
                signal,
                squeeze,
                upperBreakout,
                lowerBreakout,
                position: currentPrice > current.upper ? 'above_upper' : 
                         currentPrice < current.lower ? 'below_lower' : 'inside_bands'
            };
        } catch (error) {
            console.error('Error calculating Bollinger Bands:', error);
            return { current: null, values: [], signal: 'neutral' };
        }
    }

    /**
     * Calculate ATR (Average True Range)
     */
    calculateATR(highs, lows, closes) {
        try {
            if (highs.length < this.periods.atr || lows.length < this.periods.atr || closes.length < this.periods.atr) {
                return { current: null, values: [] };
            }

            const atrValues = ATR.calculate({
                high: highs,
                low: lows,
                close: closes,
                period: this.periods.atr
            });

            return {
                current: atrValues[atrValues.length - 1],
                values: atrValues,
                volatility: this.classifyVolatility(atrValues)
            };
        } catch (error) {
            console.error('Error calculating ATR:', error);
            return { current: null, values: [] };
        }
    }

    /**
     * Calculate ADX (Average Directional Index)
     */
    calculateADX(highs, lows, closes) {
        try {
            if (highs.length < this.periods.adx + 1 || lows.length < this.periods.adx + 1 || closes.length < this.periods.adx + 1) {
                return { current: null, values: [], signal: 'neutral', regime: 'ranging' };
            }

            const adxValues = ADX.calculate({
                high: highs,
                low: lows,
                close: closes,
                period: this.periods.adx
            });

            if (adxValues.length === 0) {
                return { current: null, values: [], signal: 'neutral', regime: 'ranging' };
            }

            const current = adxValues[adxValues.length - 1];
            
            // Determine market regime
            let regime = 'ranging';
            let signal = 'neutral';
            
            if (current.adx > 25) {
                regime = 'trending';
                signal = current.pdi > current.mdi ? 'bullish_trend' : 'bearish_trend';
            } else if (current.adx < 20) {
                regime = 'ranging';
                signal = 'sideways';
            } else {
                regime = 'transitional';
            }

            return {
                current,
                values: adxValues,
                signal,
                regime,
                trendStrength: current.adx > 25 ? 'strong' : current.adx > 20 ? 'moderate' : 'weak'
            };
        } catch (error) {
            console.error('Error calculating ADX:', error);
            return { current: null, values: [], signal: 'neutral', regime: 'ranging' };
        }
    }

    /**
     * Calculate Stochastic RSI
     */
    calculateStochasticRSI(closes) {
        try {
            if (closes.length < this.periods.stochRsi.rsiPeriod + this.periods.stochRsi.stochPeriod) {
                return { current: null, values: [], signal: 'neutral' };
            }

            const stochRsiValues = StochasticRSI.calculate({
                values: closes,
                rsiPeriod: this.periods.stochRsi.rsiPeriod,
                stochasticPeriod: this.periods.stochRsi.stochPeriod,
                kPeriod: this.periods.stochRsi.kPeriod,
                dPeriod: this.periods.stochRsi.dPeriod
            });

            if (stochRsiValues.length === 0) {
                return { current: null, values: [], signal: 'neutral' };
            }

            const current = stochRsiValues[stochRsiValues.length - 1];
            const previous = stochRsiValues[stochRsiValues.length - 2] || current;
            
            // Generate signals
            let signal = 'neutral';
            if (current.k > 80) signal = 'overbought';
            else if (current.k < 20) signal = 'oversold';
            else if (current.k > current.d && previous.k <= previous.d) signal = 'bullish_crossover';
            else if (current.k < current.d && previous.k >= previous.d) signal = 'bearish_crossover';

            return {
                current,
                values: stochRsiValues,
                signal,
                overbought: current.k > 80,
                oversold: current.k < 20
            };
        } catch (error) {
            console.error('Error calculating Stochastic RSI:', error);
            return { current: null, values: [], signal: 'neutral' };
        }
    }

    /**
     * Calculate OBV (On Balance Volume)
     */
    calculateOBV(closes, volumes) {
        try {
            if (closes.length !== volumes.length || closes.length < 2) {
                return { current: null, values: [], signal: 'neutral' };
            }

            const obvValues = OBV.calculate({
                close: closes,
                volume: volumes
            });

            const current = obvValues[obvValues.length - 1];
            
            // Simple trend analysis
            const recentValues = obvValues.slice(-10);
            const firstValue = recentValues[0];
            const trend = current > firstValue ? 'bullish' : current < firstValue ? 'bearish' : 'neutral';

            return {
                current,
                values: obvValues,
                signal: trend,
                trend
            };
        } catch (error) {
            console.error('Error calculating OBV:', error);
            return { current: null, values: [], signal: 'neutral' };
        }
    }

    /**
     * Calculate volume analysis
     */
    calculateVolumeAnalysis(volumes, period = 20) {
        try {
            if (volumes.length < period) {
                return { current: null, average: null, signal: 'neutral' };
            }

            const recentVolumes = volumes.slice(-period);
            const average = recentVolumes.reduce((sum, vol) => sum + vol, 0) / period;
            const current = volumes[volumes.length - 1];
            
            // Volume signals
            let signal = 'neutral';
            const ratio = current / average;
            
            if (ratio > 2.0) signal = 'surge';
            else if (ratio > 1.5) signal = 'high';
            else if (ratio < 0.5) signal = 'low';
            else if (ratio < 0.3) signal = 'dry_up';

            return {
                current,
                average,
                ratio,
                signal,
                aboveAverage: current > average
            };
        } catch (error) {
            console.error('Error calculating volume analysis:', error);
            return { current: null, average: null, signal: 'neutral' };
        }
    }

    /**
     * Check trend alignment (Price > EMA21 > EMA50 > EMA200)
     */
    checkTrendAlignment(price, emas) {
        const ema21 = emas.ema21?.current;
        const ema50 = emas.ema50?.current;
        
        if (!ema21 || !ema50) {
            return { aligned: false, direction: 'neutral', strength: 0 };
        }

        let score = 0;
        let direction = 'neutral';

        // Check alignments
        if (price > ema21) score += 1;
        if (ema21 > ema50) score += 1;
        
        // If we have EMA200
        if (emas.ema200?.current) {
            if (ema50 > emas.ema200.current) score += 1;
            
            if (score === 3) {
                direction = 'strong_bullish';
            } else if (score === 2) {
                direction = 'bullish';
            } else if (score === 1) {
                direction = 'weak_bullish';
            } else {
                direction = 'bearish';
            }
        } else {
            if (score === 2) {
                direction = 'bullish';
            } else if (score === 1) {
                direction = 'weak_bullish';
            } else {
                direction = 'bearish';
            }
        }

        return {
            aligned: score >= 2,
            direction,
            strength: score,
            maxScore: emas.ema200?.current ? 3 : 2
        };
    }

    /**
     * Classify volatility based on ATR
     */
    classifyVolatility(atrValues) {
        if (atrValues.length < 20) return 'unknown';
        
        const recent = atrValues.slice(-10);
        const historical = atrValues.slice(-30, -10);
        
        const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
        const historicalAvg = historical.reduce((sum, val) => sum + val, 0) / historical.length;
        
        const ratio = recentAvg / historicalAvg;
        
        if (ratio > 1.5) return 'high';
        else if (ratio > 1.2) return 'elevated';
        else if (ratio < 0.8) return 'low';
        else if (ratio < 0.6) return 'very_low';
        else return 'normal';
    }

    /**
     * Comprehensive market analysis
     */
    analyzeMarket(candles) {
        try {
            if (!candles || candles.length < 50) {
                throw new Error('Insufficient data for analysis');
            }

            // Extract arrays for calculations
            const closes = candles.map(c => c.close);
            const highs = candles.map(c => c.high);
            const lows = candles.map(c => c.low);
            const volumes = candles.map(c => c.volume);

            // Calculate all indicators
            const rsi = this.calculateRSI(closes);
            const macd = this.calculateMACD(closes);
            const emas = this.calculateEMAs(closes);
            const smas = this.calculateSMAs(closes);
            const bollinger = this.calculateBollingerBands(closes);
            const atr = this.calculateATR(highs, lows, closes);
            const adx = this.calculateADX(highs, lows, closes);
            const stochRsi = this.calculateStochasticRSI(closes);
            const obv = this.calculateOBV(closes, volumes);
            const volumeAnalysis = this.calculateVolumeAnalysis(volumes);

            // Overall market assessment
            const marketRegime = this.determineMarketRegime(adx, emas, bollinger, atr);
            const momentum = this.assessMomentum(rsi, macd, stochRsi);
            const trend = this.assessTrend(emas, smas, adx);
            const volatility = this.assessVolatility(atr, bollinger);
            
            // Calculate overall trend and score
            const overallTrend = this.determineOverallTrend(trend, momentum, marketRegime);
            const score = this.calculateOverallScore(trend, momentum, marketRegime, volatility);

            return {
                timestamp: new Date(),
                currentPrice: closes[closes.length - 1],
                indicators: {
                    rsi,
                    macd,
                    emas,
                    smas,
                    bollinger,
                    atr,
                    adx,
                    stochRsi,
                    obv,
                    volumeAnalysis
                },
                assessment: {
                    marketRegime,
                    momentum,
                    trend,
                    volatility,
                    overallTrend,
                    score
                }
            };
        } catch (error) {
            console.error('Error in market analysis:', error);
            throw error;
        }
    }

    /**
     * Determine market regime
     */
    determineMarketRegime(adx, emas, bollinger, atr) {
        const regime = {
            type: 'ranging',
            strength: 'weak',
            confidence: 0
        };

        // ADX-based regime detection
        if (adx.current?.adx > 25) {
            regime.type = 'trending';
            regime.strength = adx.current.adx > 40 ? 'strong' : 'moderate';
            regime.confidence += 0.4;
        }

        // Trend alignment confirmation
        if (emas.trendAlignment.aligned) {
            regime.confidence += 0.3;
            if (regime.type === 'ranging') regime.type = 'trending';
        }

        // Bollinger Bands confirmation
        if (bollinger.squeeze) {
            regime.type = 'consolidation';
            regime.confidence += 0.2;
        } else if (bollinger.upperBreakout || bollinger.lowerBreakout) {
            regime.type = 'breakout';
            regime.confidence += 0.3;
        }

        // Volatility confirmation
        if (atr.volatility === 'high' && regime.type === 'trending') {
            regime.confidence += 0.1;
        }

        return regime;
    }

    /**
     * Assess momentum
     */
    assessMomentum(rsi, macd, stochRsi) {
        let bullishSignals = 0;
        let bearishSignals = 0;

        // RSI signals
        if (rsi.signal === 'bullish' || rsi.signal === 'oversold') bullishSignals++;
        if (rsi.signal === 'bearish' || rsi.signal === 'overbought') bearishSignals++;

        // MACD signals
        if (macd.signal.includes('bullish')) bullishSignals++;
        if (macd.signal.includes('bearish')) bearishSignals++;

        // Stochastic RSI signals
        if (stochRsi.signal.includes('bullish') || stochRsi.oversold) bullishSignals++;
        if (stochRsi.signal.includes('bearish') || stochRsi.overbought) bearishSignals++;

        const total = bullishSignals + bearishSignals;
        const netSignal = total > 0 ? (bullishSignals - bearishSignals) / total : 0;

        return {
            direction: netSignal > 0.3 ? 'bullish' : netSignal < -0.3 ? 'bearish' : 'neutral',
            strength: Math.abs(netSignal),
            bullishSignals,
            bearishSignals
        };
    }

    /**
     * Assess trend
     */
    assessTrend(emas, smas, adx) {
        return {
            direction: emas.trendAlignment.direction,
            strength: emas.trendAlignment.strength,
            regime: adx.regime,
            aligned: emas.trendAlignment.aligned
        };
    }

    /**
     * Assess volatility
     */
    assessVolatility(atr, bollinger) {
        return {
            level: atr.volatility,
            squeeze: bollinger.squeeze,
            expansion: bollinger.upperBreakout || bollinger.lowerBreakout
        };
    }
    
    /**
     * Determine overall trend
     */
    determineOverallTrend(trend, momentum, marketRegime) {
        let trendScore = 0;
        let momentumScore = 0;
        
        // Score trend direction
        if (trend.direction === 'strong_bullish') trendScore = 3;
        else if (trend.direction === 'bullish') trendScore = 2;
        else if (trend.direction === 'weak_bullish') trendScore = 1;
        else if (trend.direction === 'bearish') trendScore = -1;
        else trendScore = 0;
        
        // Score momentum
        if (momentum.direction === 'bullish') momentumScore = momentum.strength * 2;
        else if (momentum.direction === 'bearish') momentumScore = -(momentum.strength * 2);
        else momentumScore = 0;
        
        const combinedScore = trendScore + momentumScore;
        
        if (combinedScore > 2) return 'bullish';
        else if (combinedScore < -2) return 'bearish';
        else return 'neutral';
    }
    
    /**
     * Calculate overall score (-100 to 100)
     */
    calculateOverallScore(trend, momentum, marketRegime, volatility) {
        let score = 0;
        
        // Trend component (40 points max)
        if (trend.direction === 'strong_bullish') score += 40;
        else if (trend.direction === 'bullish') score += 25;
        else if (trend.direction === 'weak_bullish') score += 15;
        else if (trend.direction === 'bearish') score -= 25;
        
        // Momentum component (30 points max)
        if (momentum.direction === 'bullish') {
            score += Math.round(momentum.strength * 30);
        } else if (momentum.direction === 'bearish') {
            score -= Math.round(momentum.strength * 30);
        }
        
        // Market regime component (20 points max)
        if (marketRegime.type === 'trending') {
            if (marketRegime.strength === 'strong') score += 20;
            else if (marketRegime.strength === 'moderate') score += 10;
        } else if (marketRegime.type === 'ranging') {
            score -= 10; // Ranging markets are generally harder to trade
        }
        
        // Volatility component (10 points max)
        if (volatility.level === 'high') score += 5; // High volatility can be good for trends
        else if (volatility.level === 'very_low') score -= 5; // Very low volatility limits profit potential
        if (volatility.expansion) score += 5; // Volatility expansion is bullish for breakouts
        
        // Ensure score is within bounds
        return Math.max(-100, Math.min(100, score));
    }
}

export default TechnicalIndicators;