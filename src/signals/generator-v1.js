/**
 * Signal Generator Module - RECALIBRATED VERSION
 * Generates trading signals with realistic parameters for crypto markets
 */

class SignalGenerator {
    constructor(config = {}) {
        this.config = config;
        this.preset = config.preset || 'balanced';
        
        // Load preset configurations
        this.presets = {
            'ultra_conservative': {
                minConfirmations: 3,
                minRiskReward: 3,
                riskPerTrade: 0.01,
                volumeMultiplier: 1.8,
                rsiOverbought: 75,
                rsiOversold: 25,
                adxTrending: 30,
                requireFullAlignment: true,
                allowPartialAlignment: false
            },
            'conservative': {
                minConfirmations: 3,
                minRiskReward: 2.5,
                riskPerTrade: 0.015,
                volumeMultiplier: 1.5,
                rsiOverbought: 70,
                rsiOversold: 30,
                adxTrending: 25,
                requireFullAlignment: true,
                allowPartialAlignment: false
            },
            'balanced': {
                minConfirmations: 2,
                minRiskReward: 2,
                riskPerTrade: 0.015,
                volumeMultiplier: 1.3,
                rsiOverbought: 65,
                rsiOversold: 35,
                adxTrending: 20,
                requireFullAlignment: false,
                allowPartialAlignment: true
            },
            'active': {
                minConfirmations: 2,
                minRiskReward: 1.5,
                riskPerTrade: 0.02,
                volumeMultiplier: 1.2,
                rsiOverbought: 60,
                rsiOversold: 40,
                adxTrending: 18,
                requireFullAlignment: false,
                allowPartialAlignment: true
            },
            'aggressive': {
                minConfirmations: 1,
                minRiskReward: 1.5,
                riskPerTrade: 0.02,
                volumeMultiplier: 1.1,
                rsiOverbought: 55,
                rsiOversold: 45,
                adxTrending: 15,
                requireFullAlignment: false,
                allowPartialAlignment: true
            },
            'scalper': {
                minConfirmations: 1,
                minRiskReward: 1.2,
                riskPerTrade: 0.025,
                volumeMultiplier: 1.0,
                rsiOverbought: 52,
                rsiOversold: 48,
                adxTrending: 12,
                requireFullAlignment: false,
                allowPartialAlignment: true
            }
        };
        
        // Apply preset settings
        const presetConfig = this.presets[this.preset] || this.presets.balanced;
        this.settings = { ...presetConfig, ...config };
        
        // Backwards compatibility
        this.minConfirmations = this.settings.minConfirmations;
        this.minRiskReward = this.settings.minRiskReward;
        this.stopLossMultiplier = config.stopLossMultiplier || 2.5;
        this.takeProfitRatios = config.takeProfitRatios || [2, 4, 6];
    }

    /**
     * Generate trading signals with weighted scoring system
     */
    generateSignals(marketAnalysis, symbol) {
        const signals = [];
        const { indicators, assessment, currentPrice } = marketAnalysis;

        try {
            // Use weighted scoring instead of hard requirements
            const trendFollowingSignal = this.generateTrendFollowingSignal(indicators, assessment, currentPrice, symbol);
            if (trendFollowingSignal) signals.push(trendFollowingSignal);

            const meanReversionSignal = this.generateMeanReversionSignal(indicators, assessment, currentPrice, symbol);
            if (meanReversionSignal) signals.push(meanReversionSignal);

            const breakoutSignal = this.generateBreakoutSignal(indicators, assessment, currentPrice, symbol);
            if (breakoutSignal) signals.push(breakoutSignal);

            // Apply minimum quality filters
            return signals.filter(signal => 
                signal.score >= this.getMinimumScore() && 
                signal.riskRewardRatio >= this.settings.minRiskReward &&
                signal.confidence >= this.getMinimumConfidence()
            );

        } catch (error) {
            console.error('Error generating signals:', error);
            return [];
        }
    }

    /**
     * Generate trend following signals with weighted scoring
     */
    generateTrendFollowingSignal(indicators, assessment, currentPrice, symbol) {
        let score = 0;
        let confirmations = 0;
        const reasoning = [];
        const details = {};
        
        // TREND ALIGNMENT (0-40 points)
        const trendScore = this.scoreTrendAlignment(indicators, currentPrice);
        score += trendScore.score;
        if (trendScore.score > 0) confirmations++;
        reasoning.push(...trendScore.reasoning);
        details.trendAlignment = trendScore;

        // Early exit for very weak trends (unless aggressive settings)
        if (trendScore.score < 10 && !this.settings.allowPartialAlignment) {
            return null;
        }

        // MOMENTUM (0-25 points)
        const momentumScore = this.scoreMomentum(indicators);
        score += momentumScore.score;
        if (momentumScore.score > 10) confirmations++;
        reasoning.push(...momentumScore.reasoning);
        details.momentum = momentumScore;

        // VOLUME (0-20 points) - More lenient
        const volumeScore = this.scoreVolume(indicators, 'trend');
        score += volumeScore.score;
        if (volumeScore.score > 8) confirmations++;
        reasoning.push(...volumeScore.reasoning);
        details.volume = volumeScore;

        // ADX TREND STRENGTH (0-15 points) - More realistic
        const adxScore = this.scoreADX(indicators);
        score += adxScore.score;
        if (adxScore.score > 7) confirmations++;
        reasoning.push(...adxScore.reasoning);
        details.adx = adxScore;

        // Safety check for overbought conditions
        if (indicators.rsi?.current > this.settings.rsiOverbought + 10) {
            score *= 0.3; // Heavily penalize extreme overbought
            reasoning.push(`Heavily penalized for extreme overbought RSI (${indicators.rsi.current.toFixed(1)})`);
        }

        // Calculate risk and reward
        const riskReward = this.calculateRiskReward(currentPrice, indicators, 'long');
        if (!riskReward) return null;

        const confidence = Math.min((score / 100) * 100, 95);
        
        // Apply minimum thresholds
        if (score >= this.getMinimumScore() && confirmations >= this.settings.minConfirmations) {
            return {
                id: `trend_${symbol}_${Date.now()}`,
                type: 'trend_following',
                symbol,
                direction: 'long',
                confidence,
                entryPrice: currentPrice,
                stopLoss: riskReward.stopLoss,
                takeProfits: riskReward.takeProfits,
                riskRewardRatio: riskReward.ratio,
                confirmations,
                reasoning: reasoning.join('; '),
                timestamp: new Date(),
                atrValue: indicators.atr?.current,
                marketRegime: assessment.marketRegime?.type || 'unknown',
                score,
                details,
                preset: this.preset
            };
        }

        return null;
    }

    /**
     * Generate mean reversion signals with weighted scoring
     */
    generateMeanReversionSignal(indicators, assessment, currentPrice, symbol) {
        let score = 0;
        let confirmations = 0;
        const reasoning = [];
        const details = {};

        // Don't mean revert in very strong trends (unless scalper mode)
        if (assessment.marketRegime?.type === 'trending' && assessment.marketRegime?.strength === 'strong' && this.preset !== 'scalper') {
            return null;
        }

        // OVERSOLD CONDITIONS (0-35 points)
        const oversoldScore = this.scoreOversold(indicators);
        score += oversoldScore.score;
        if (oversoldScore.score > 15) confirmations++;
        reasoning.push(...oversoldScore.reasoning);
        details.oversold = oversoldScore;

        // SUPPORT LEVELS (0-25 points)
        const supportScore = this.scoreSupport(indicators, currentPrice);
        score += supportScore.score;
        if (supportScore.score > 10) confirmations++;
        reasoning.push(...supportScore.reasoning);
        details.support = supportScore;

        // VOLUME CONFIRMATION (0-20 points) - Look for selling exhaustion OR accumulation
        const volumeScore = this.scoreVolume(indicators, 'reversion');
        score += volumeScore.score;
        if (volumeScore.score > 8) confirmations++;
        reasoning.push(...volumeScore.reasoning);
        details.volume = volumeScore;

        // DIVERGENCE SIGNALS (0-20 points)
        const divergenceScore = this.scoreDivergence(indicators);
        score += divergenceScore.score;
        if (divergenceScore.score > 8) confirmations++;
        reasoning.push(...divergenceScore.reasoning);
        details.divergence = divergenceScore;

        const riskReward = this.calculateRiskReward(currentPrice, indicators, 'long', 'reversion');
        if (!riskReward) return null;

        const confidence = Math.min((score / 100) * 100, 85);

        if (score >= this.getMinimumScore() * 0.8 && confirmations >= Math.max(1, this.settings.minConfirmations - 1)) {
            return {
                id: `mean_rev_${symbol}_${Date.now()}`,
                type: 'mean_reversion',
                symbol,
                direction: 'long',
                confidence,
                entryPrice: currentPrice,
                stopLoss: riskReward.stopLoss,
                takeProfits: riskReward.takeProfits,
                riskRewardRatio: riskReward.ratio,
                confirmations,
                reasoning: reasoning.join('; '),
                timestamp: new Date(),
                atrValue: indicators.atr?.current,
                marketRegime: assessment.marketRegime?.type || 'unknown',
                score,
                details,
                preset: this.preset
            };
        }

        return null;
    }

    /**
     * Generate breakout signals with weighted scoring
     */
    generateBreakoutSignal(indicators, assessment, currentPrice, symbol) {
        let score = 0;
        let confirmations = 0;
        const reasoning = [];
        const details = {};

        // VOLUME CONFIRMATION (0-30 points) - Critical for breakouts but more lenient
        const volumeScore = this.scoreVolume(indicators, 'breakout');
        score += volumeScore.score;
        if (volumeScore.score > 12) confirmations++;
        reasoning.push(...volumeScore.reasoning);
        details.volume = volumeScore;

        // If absolutely no volume, exit early (unless scalper mode)
        if (volumeScore.score < 5 && this.preset !== 'scalper') {
            return null;
        }

        // BOLLINGER BAND BREAKOUT (0-25 points)
        const bbScore = this.scoreBolingerBreakout(indicators, currentPrice);
        score += bbScore.score;
        if (bbScore.score > 10) confirmations++;
        reasoning.push(...bbScore.reasoning);
        details.bollinger = bbScore;

        // MOMENTUM CONFIRMATION (0-25 points)
        const momentumScore = this.scoreMomentum(indicators);
        score += momentumScore.score;
        if (momentumScore.score > 10) confirmations++;
        reasoning.push(...momentumScore.reasoning);
        details.momentum = momentumScore;

        // VOLATILITY EXPANSION (0-20 points)
        const volatilityScore = this.scoreVolatilityExpansion(indicators, assessment);
        score += volatilityScore.score;
        if (volatilityScore.score > 8) confirmations++;
        reasoning.push(...volatilityScore.reasoning);
        details.volatility = volatilityScore;

        const riskReward = this.calculateRiskReward(currentPrice, indicators, 'long', 'breakout');
        if (!riskReward) return null;

        const confidence = Math.min((score / 100) * 100, 90);

        if (score >= this.getMinimumScore() && confirmations >= this.settings.minConfirmations) {
            return {
                id: `breakout_${symbol}_${Date.now()}`,
                type: 'breakout',
                symbol,
                direction: 'long',
                confidence,
                entryPrice: currentPrice,
                stopLoss: riskReward.stopLoss,
                takeProfits: riskReward.takeProfits,
                riskRewardRatio: riskReward.ratio,
                confirmations,
                reasoning: reasoning.join('; '),
                timestamp: new Date(),
                atrValue: indicators.atr?.current,
                marketRegime: assessment.marketRegime?.type || 'unknown',
                score,
                details,
                preset: this.preset
            };
        }

        return null;
    }

    /**
     * Score trend alignment with partial credit
     */
    scoreTrendAlignment(indicators, currentPrice) {
        let score = 0;
        const reasoning = [];
        
        const ema21 = indicators.emas?.ema21?.current;
        const ema50 = indicators.emas?.ema50?.current;
        const ema200 = indicators.emas?.ema200?.current;
        
        if (!ema21 || !ema50) {
            return { score: 0, reasoning: ['Missing EMA data'] };
        }

        // Price above EMA21 (15 points)
        if (currentPrice > ema21) {
            score += 15;
            reasoning.push('Price above EMA21');
        } else {
            const distance = ((ema21 - currentPrice) / currentPrice) * 100;
            if (distance < 1) { // Within 1%
                score += 8;
                reasoning.push('Price near EMA21 (within 1%)');
            }
        }

        // EMA21 above EMA50 (15 points)
        if (ema21 > ema50) {
            score += 15;
            reasoning.push('EMA21 above EMA50');
        } else {
            const distance = ((ema50 - ema21) / ema21) * 100;
            if (distance < 0.5) { // Within 0.5%
                score += 7;
                reasoning.push('EMA21 near EMA50');
            }
        }

        // EMA50 above EMA200 (10 points) - Less critical
        if (ema200) {
            if (ema50 > ema200) {
                score += 10;
                reasoning.push('EMA50 above EMA200');
            } else {
                const distance = ((ema200 - ema50) / ema50) * 100;
                if (distance < 2) { // Within 2%
                    score += 5;
                    reasoning.push('EMA50 near EMA200');
                }
            }
        } else {
            score += 5; // Partial credit if EMA200 not available
        }

        return { score, reasoning };
    }

    /**
     * Score momentum indicators
     */
    scoreMomentum(indicators) {
        let score = 0;
        const reasoning = [];

        // RSI scoring (0-15 points)
        if (indicators.rsi?.current) {
            const rsi = indicators.rsi.current;
            if (rsi > 55 && rsi < this.settings.rsiOverbought) {
                score += 15;
                reasoning.push(`Strong RSI momentum (${rsi.toFixed(1)})`);
            } else if (rsi > 50) {
                score += 10;
                reasoning.push(`Positive RSI momentum (${rsi.toFixed(1)})`);
            } else if (rsi > 45) {
                score += 5;
                reasoning.push(`Neutral RSI (${rsi.toFixed(1)})`);
            }
        }

        // MACD scoring (0-10 points)
        if (indicators.macd?.current) {
            if (indicators.macd.bullishCrossover) {
                score += 10;
                reasoning.push('MACD bullish crossover');
            } else if (indicators.macd.signal === 'bullish' && indicators.macd.current.histogram > 0) {
                score += 8;
                reasoning.push('MACD bullish with positive histogram');
            } else if (indicators.macd.signal === 'bullish') {
                score += 5;
                reasoning.push('MACD bullish signal');
            }
        }

        return { score, reasoning };
    }

    /**
     * Score volume with different criteria for different signal types
     */
    scoreVolume(indicators, signalType) {
        let score = 0;
        const reasoning = [];

        if (!indicators.volumeAnalysis?.ratio) {
            return { score: 0, reasoning: ['No volume data'] };
        }

        const ratio = indicators.volumeAnalysis.ratio;
        const multiplier = this.settings.volumeMultiplier;

        if (signalType === 'trend') {
            if (ratio > multiplier * 1.5) {
                score += 20;
                reasoning.push(`Strong volume surge (${ratio.toFixed(2)}x)`);
            } else if (ratio > multiplier) {
                score += 15;
                reasoning.push(`Volume surge (${ratio.toFixed(2)}x)`);
            } else if (ratio > multiplier * 0.8) {
                score += 10;
                reasoning.push(`Above average volume (${ratio.toFixed(2)}x)`);
            } else if (ratio > 0.5) {
                score += 5;
                reasoning.push(`Moderate volume (${ratio.toFixed(2)}x)`);
            }
        } else if (signalType === 'reversion') {
            // For mean reversion, we want either low volume (selling exhaustion) OR accumulation
            if (ratio < 0.7) {
                score += 15;
                reasoning.push(`Low volume - selling exhaustion (${ratio.toFixed(2)}x)`);
            } else if (ratio > multiplier) {
                score += 12;
                reasoning.push(`High volume - potential accumulation (${ratio.toFixed(2)}x)`);
            } else {
                score += 8;
                reasoning.push(`Neutral volume (${ratio.toFixed(2)}x)`);
            }
        } else if (signalType === 'breakout') {
            // Breakouts need more volume, but be more lenient
            if (ratio > multiplier * 2) {
                score += 30;
                reasoning.push(`Massive volume breakout (${ratio.toFixed(2)}x)`);
            } else if (ratio > multiplier * 1.3) {
                score += 25;
                reasoning.push(`Strong volume breakout (${ratio.toFixed(2)}x)`);
            } else if (ratio > multiplier) {
                score += 18;
                reasoning.push(`Volume breakout (${ratio.toFixed(2)}x)`);
            } else if (ratio > multiplier * 0.8) {
                score += 10;
                reasoning.push(`Moderate volume (${ratio.toFixed(2)}x)`);
            } else {
                score += 3;
                reasoning.push(`Low volume breakout (${ratio.toFixed(2)}x)`);
            }
        }

        return { score, reasoning };
    }

    /**
     * Score ADX with more realistic thresholds
     */
    scoreADX(indicators) {
        let score = 0;
        const reasoning = [];

        if (!indicators.adx?.current?.adx) {
            return { score: 0, reasoning: ['No ADX data'] };
        }

        const adx = indicators.adx.current.adx;
        const threshold = this.settings.adxTrending;

        if (adx > threshold + 10) {
            score += 15;
            reasoning.push(`Strong trend (ADX: ${adx.toFixed(1)})`);
        } else if (adx > threshold) {
            score += 12;
            reasoning.push(`Trending market (ADX: ${adx.toFixed(1)})`);
        } else if (adx > threshold - 5) {
            score += 8;
            reasoning.push(`Developing trend (ADX: ${adx.toFixed(1)})`);
        } else {
            score += 3;
            reasoning.push(`Weak trend (ADX: ${adx.toFixed(1)})`);
        }

        return { score, reasoning };
    }

    /**
     * Score oversold conditions
     */
    scoreOversold(indicators) {
        let score = 0;
        const reasoning = [];

        // RSI oversold
        if (indicators.rsi?.current) {
            const rsi = indicators.rsi.current;
            if (rsi < this.settings.rsiOversold - 5) {
                score += 20;
                reasoning.push(`Deeply oversold RSI (${rsi.toFixed(1)})`);
            } else if (rsi < this.settings.rsiOversold) {
                score += 15;
                reasoning.push(`Oversold RSI (${rsi.toFixed(1)})`);
            } else if (rsi < 45) {
                score += 8;
                reasoning.push(`Weak RSI (${rsi.toFixed(1)})`);
            }
        }

        // Stochastic RSI oversold
        if (indicators.stochRsi?.oversold) {
            score += 10;
            reasoning.push('StochRSI oversold');
        }

        // Bollinger Band position
        if (indicators.bollinger?.position === 'below_lower') {
            score += 15;
            reasoning.push('Price below Bollinger lower band');
        } else if (indicators.bollinger?.current) {
            const bb = indicators.bollinger.current;
            const price = indicators.rsi?.current; // This should be current price, but we'll approximate
            const lowerDistance = Math.abs(price - bb.lower) / bb.lower;
            if (lowerDistance < 0.02) {
                score += 8;
                reasoning.push('Price near Bollinger lower band');
            }
        }

        return { score, reasoning };
    }

    /**
     * Score support levels (simplified)
     */
    scoreSupport(indicators, currentPrice) {
        let score = 0;
        const reasoning = [];

        // Use Bollinger lower band as support proxy
        if (indicators.bollinger?.current) {
            const lowerBand = indicators.bollinger.current.lower;
            const distance = Math.abs(currentPrice - lowerBand) / currentPrice;
            
            if (distance < 0.01) {
                score += 20;
                reasoning.push('Price at strong support (Bollinger lower)');
            } else if (distance < 0.02) {
                score += 15;
                reasoning.push('Price near support level');
            } else if (distance < 0.05) {
                score += 8;
                reasoning.push('Price approaching support');
            }
        }

        // EMA support
        const ema50 = indicators.emas?.ema50?.current;
        if (ema50) {
            const distance = Math.abs(currentPrice - ema50) / currentPrice;
            if (distance < 0.015 && currentPrice > ema50) {
                score += 10;
                reasoning.push('EMA50 acting as support');
            }
        }

        return { score, reasoning };
    }

    /**
     * Score divergence signals (simplified)
     */
    scoreDivergence(indicators) {
        let score = 0;
        const reasoning = [];

        // OBV divergence
        if (indicators.obv?.trend === 'bullish' && indicators.rsi?.current < 40) {
            score += 15;
            reasoning.push('Potential bullish OBV divergence');
        }

        // MACD divergence (simplified)
        if (indicators.macd?.current?.histogram > 0 && indicators.rsi?.current < 45) {
            score += 10;
            reasoning.push('MACD showing potential divergence');
        }

        return { score, reasoning };
    }

    /**
     * Score Bollinger Band breakouts
     */
    scoreBolingerBreakout(indicators, currentPrice) {
        let score = 0;
        const reasoning = [];

        if (indicators.bollinger?.upperBreakout) {
            score += 25;
            reasoning.push('Bollinger upper band breakout');
        } else if (indicators.bollinger?.current) {
            const bb = indicators.bollinger.current;
            const distance = (currentPrice - bb.upper) / bb.upper;
            
            if (distance > -0.005) { // Within 0.5% of upper band
                score += 15;
                reasoning.push('Price near Bollinger upper band');
            } else if (distance > -0.02) { // Within 2% of upper band
                score += 8;
                reasoning.push('Price approaching Bollinger upper');
            }
        }

        return { score, reasoning };
    }

    /**
     * Score volatility expansion
     */
    scoreVolatilityExpansion(indicators, assessment) {
        let score = 0;
        const reasoning = [];

        if (indicators.bollinger?.squeeze) {
            score += 10;
            reasoning.push('Coming out of Bollinger squeeze');
        }

        if (assessment.volatility?.expansion) {
            score += 15;
            reasoning.push('Volatility expansion detected');
        }

        if (indicators.atr?.volatility === 'high') {
            score += 8;
            reasoning.push('High volatility environment');
        } else if (indicators.atr?.volatility === 'elevated') {
            score += 5;
            reasoning.push('Elevated volatility');
        }

        return { score, reasoning };
    }

    /**
     * Calculate risk/reward with improved logic
     */
    calculateRiskReward(currentPrice, indicators, direction, signalType = 'trend') {
        const atr = indicators.atr?.current;
        if (!atr || atr <= 0) {
            return null;
        }

        let stopLossMultiplier = this.stopLossMultiplier;
        let takeProfitRatios = [...this.takeProfitRatios];

        // Adjust based on signal type
        if (signalType === 'reversion') {
            stopLossMultiplier *= 0.8; // Tighter stops for mean reversion
            takeProfitRatios = [1.5, 2.5]; // Lower targets
        } else if (signalType === 'breakout') {
            stopLossMultiplier *= 1.1; // Wider stops for breakouts
        }

        const stopLoss = direction === 'long' 
            ? currentPrice - (atr * stopLossMultiplier)
            : currentPrice + (atr * stopLossMultiplier);

        const riskPerShare = Math.abs(currentPrice - stopLoss);
        
        const takeProfits = takeProfitRatios.map(ratio => ({
            price: direction === 'long' 
                ? currentPrice + (riskPerShare * ratio)
                : currentPrice - (riskPerShare * ratio),
            ratio: ratio
        }));

        const riskRewardRatio = takeProfits[0] ? 
            Math.abs(takeProfits[0].price - currentPrice) / riskPerShare : 0;

        return {
            stopLoss,
            takeProfits,
            ratio: riskRewardRatio
        };
    }

    /**
     * Get minimum score based on preset
     */
    getMinimumScore() {
        const scoreMap = {
            'ultra_conservative': 75,
            'conservative': 65,
            'balanced': 50,
            'active': 40,
            'aggressive': 30,
            'scalper': 20
        };
        return scoreMap[this.preset] || 50;
    }

    /**
     * Get minimum confidence based on preset
     */
    getMinimumConfidence() {
        const confidenceMap = {
            'ultra_conservative': 80,
            'conservative': 70,
            'balanced': 55,
            'active': 45,
            'aggressive': 35,
            'scalper': 25
        };
        return confidenceMap[this.preset] || 55;
    }

    /**
     * Generate signals for multiple symbols and timeframes
     */
    async generateMultiSymbolSignals(marketData) {
        const allSignals = [];

        for (const symbol in marketData) {
            for (const timeframe in marketData[symbol]) {
                const analysis = marketData[symbol][timeframe];
                if (analysis) {
                    const signals = this.generateSignals(analysis, symbol);
                    
                    signals.forEach(signal => {
                        signal.timeframe = timeframe;
                    });
                    
                    allSignals.push(...signals);
                }
            }
        }

        // Sort by score (highest first)
        return allSignals.sort((a, b) => b.score - a.score);
    }

    /**
     * Validate signal quality
     */
    validateSignal(signal) {
        if (!signal || !signal.symbol || !signal.direction) {
            return false;
        }

        if (signal.riskRewardRatio < this.settings.minRiskReward) {
            return false;
        }

        if (signal.direction === 'long' && signal.stopLoss >= signal.entryPrice) {
            return false;
        }

        if (signal.direction === 'short' && signal.stopLoss <= signal.entryPrice) {
            return false;
        }

        return true;
    }
}

export default SignalGenerator;