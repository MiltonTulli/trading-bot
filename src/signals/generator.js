/**
 * Signal Generator v2 - CRYPTO RECALIBRATED
 * Realistic parameters based on actual crypto market behavior
 */

class SignalGenerator {
    constructor(config = {}) {
        this.config = config;
        this.preset = config.preset || 'balanced';
        
        // RECALIBRATED PRESETS - Much more realistic for crypto
        this.presets = {
            'ultra_conservative': {
                minConfirmations: 3,
                minRiskReward: 3,
                riskPerTrade: 0.01,
                volumeMultiplier: 0.8,  // FIXED: Lower threshold
                rsiOverbought: 65,      // FIXED: From 75
                rsiOversold: 35,        // FIXED: From 25
                adxTrending: 15,        // FIXED: From 30
                requireFullAlignment: false, // FIXED: Allow partial
                allowPartialAlignment: true,
                minScore: 70,
                minConfidence: 75
            },
            'conservative': {
                minConfirmations: 3,
                minRiskReward: 2.5,
                riskPerTrade: 0.015,
                volumeMultiplier: 0.7,  // FIXED: Lower threshold
                rsiOverbought: 65,      // FIXED: From 70
                rsiOversold: 35,        // FIXED: From 30
                adxTrending: 12,        // FIXED: From 25
                requireFullAlignment: false, // FIXED: Allow partial
                allowPartialAlignment: true,
                minScore: 60,
                minConfidence: 65
            },
            'balanced': {
                minConfirmations: 2,
                minRiskReward: 2,
                riskPerTrade: 0.015,
                volumeMultiplier: 0.6,  // FIXED: Much lower
                rsiOverbought: 65,      // FIXED: More sensitive
                rsiOversold: 35,        // FIXED: More sensitive
                adxTrending: 10,        // FIXED: Very low for crypto
                requireFullAlignment: false,
                allowPartialAlignment: true,
                minScore: 45,           // FIXED: Lower threshold
                minConfidence: 50
            },
            'active': {
                minConfirmations: 2,
                minRiskReward: 1.5,
                riskPerTrade: 0.02,
                volumeMultiplier: 0.5,  // FIXED: Even lower
                rsiOverbought: 65,      
                rsiOversold: 35,        
                adxTrending: 8,         // FIXED: Very low
                requireFullAlignment: false,
                allowPartialAlignment: true,
                minScore: 35,           // FIXED: Lower threshold
                minConfidence: 40
            },
            'aggressive': {
                minConfirmations: 1,
                minRiskReward: 1.5,
                riskPerTrade: 0.02,
                volumeMultiplier: 0.4,  // FIXED: Very low
                rsiOverbought: 60,      // FIXED: More sensitive
                rsiOversold: 40,        // FIXED: More sensitive
                adxTrending: 6,         // FIXED: Extremely low
                requireFullAlignment: false,
                allowPartialAlignment: true,
                minScore: 25,           // FIXED: Much lower
                minConfidence: 30
            },
            'scalper': {
                minConfirmations: 1,
                minRiskReward: 1.2,
                riskPerTrade: 0.025,
                volumeMultiplier: 0.3,  // FIXED: Accept low volume
                rsiOverbought: 58,      // FIXED: Very sensitive
                rsiOversold: 42,        // FIXED: Very sensitive
                adxTrending: 5,         // FIXED: Almost no requirement
                requireFullAlignment: false,
                allowPartialAlignment: true,
                minScore: 20,           // FIXED: Very low threshold
                minConfidence: 25
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

        console.log(`📊 Signal Generator v2 initialized with preset: ${this.preset.toUpperCase()}`);
        console.log(`   Min Score: ${this.settings.minScore}, Min Confidence: ${this.settings.minConfidence}%`);
        console.log(`   ADX Threshold: ${this.settings.adxTrending}, Volume Multiplier: ${this.settings.volumeMultiplier}`);
    }

    /**
     * Generate trading signals with WEIGHTED SCORING SYSTEM
     */
    generateSignals(marketAnalysis, symbol) {
        const signals = [];
        const { indicators, assessment, currentPrice } = marketAnalysis;

        try {
            // Generate signals with weighted scoring (not hard confirmations)
            const trendFollowingSignal = this.generateTrendFollowingSignal(indicators, assessment, currentPrice, symbol);
            if (trendFollowingSignal) signals.push(trendFollowingSignal);

            const meanReversionSignal = this.generateMeanReversionSignal(indicators, assessment, currentPrice, symbol);
            if (meanReversionSignal) signals.push(meanReversionSignal);

            const breakoutSignal = this.generateBreakoutSignal(indicators, assessment, currentPrice, symbol);
            if (breakoutSignal) signals.push(breakoutSignal);

            // Apply WEIGHTED quality filters instead of hard requirements
            const qualitySignals = signals.filter(signal => {
                const passesScore = signal.score >= this.settings.minScore;
                const passesConfidence = signal.confidence >= this.settings.minConfidence;
                const passesRiskReward = signal.riskRewardRatio >= this.settings.minRiskReward;
                
                // Use WEIGHTED confirmations - not hard count
                const weightedConfirmations = this.calculateWeightedConfirmations(signal);
                const passesConfirmations = weightedConfirmations >= this.settings.minConfirmations;
                
                return passesScore && passesConfidence && passesRiskReward && passesConfirmations;
            });

            return qualitySignals;

        } catch (error) {
            console.error('Error generating signals:', error);
            return [];
        }
    }

    /**
     * Calculate weighted confirmations instead of hard count
     */
    calculateWeightedConfirmations(signal) {
        let weight = 0;

        // Each component contributes based on its strength
        if (signal.details?.trendAlignment?.score >= 15) weight += 1.0;
        else if (signal.details?.trendAlignment?.score >= 8) weight += 0.7;
        else if (signal.details?.trendAlignment?.score >= 3) weight += 0.3;

        if (signal.details?.momentum?.score >= 12) weight += 1.0;
        else if (signal.details?.momentum?.score >= 8) weight += 0.7;
        else if (signal.details?.momentum?.score >= 4) weight += 0.3;

        if (signal.details?.volume?.score >= 15) weight += 1.0;
        else if (signal.details?.volume?.score >= 10) weight += 0.7;
        else if (signal.details?.volume?.score >= 5) weight += 0.3;

        if (signal.details?.adx?.score >= 10) weight += 1.0;
        else if (signal.details?.adx?.score >= 7) weight += 0.7;
        else if (signal.details?.adx?.score >= 3) weight += 0.3;

        return weight;
    }

    /**
     * TREND FOLLOWING with realistic crypto parameters
     */
    generateTrendFollowingSignal(indicators, assessment, currentPrice, symbol) {
        let score = 0;
        let confirmations = 0;
        const reasoning = [];
        const details = {};
        
        // TREND ALIGNMENT (0-40 points) - More lenient
        const trendScore = this.scoreTrendAlignment(indicators, currentPrice);
        score += trendScore.score;
        reasoning.push(...trendScore.reasoning);
        details.trendAlignment = trendScore;

        // MOMENTUM (0-30 points) - Increased weight
        const momentumScore = this.scoreMomentum(indicators);
        score += momentumScore.score;
        reasoning.push(...momentumScore.reasoning);
        details.momentum = momentumScore;

        // VOLUME (0-20 points) - Much more lenient
        const volumeScore = this.scoreVolume(indicators, 'trend');
        score += volumeScore.score;
        reasoning.push(...volumeScore.reasoning);
        details.volume = volumeScore;

        // ADX STRENGTH (0-10 points) - Reduced importance, realistic thresholds
        const adxScore = this.scoreADX(indicators);
        score += adxScore.score;
        reasoning.push(...adxScore.reasoning);
        details.adx = adxScore;

        // CONSOLIDATION BONUS (NEW) - Crypto often moves in consolidation
        if (assessment.marketRegime?.type === 'consolidation' && score >= 30) {
            score += 10;
            reasoning.push('Consolidation breakout potential');
        }

        // Calculate risk and reward
        const riskReward = this.calculateRiskReward(currentPrice, indicators, 'long');
        if (!riskReward) return null;

        const confidence = Math.min((score / 100) * 100, 95);
        
        // Apply minimum thresholds
        if (score >= this.settings.minScore && confidence >= this.settings.minConfidence) {
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
                confirmations: this.calculateWeightedConfirmations({ details }),
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
     * MEAN REVERSION with crypto-friendly parameters
     */
    generateMeanReversionSignal(indicators, assessment, currentPrice, symbol) {
        let score = 0;
        const reasoning = [];
        const details = {};

        // OVERSOLD CONDITIONS (0-40 points) - Increased importance
        const oversoldScore = this.scoreOversold(indicators);
        score += oversoldScore.score;
        reasoning.push(...oversoldScore.reasoning);
        details.oversold = oversoldScore;

        // SUPPORT LEVELS (0-25 points)
        const supportScore = this.scoreSupport(indicators, currentPrice);
        score += supportScore.score;
        reasoning.push(...supportScore.reasoning);
        details.support = supportScore;

        // VOLUME (0-20 points) - Look for selling exhaustion
        const volumeScore = this.scoreVolume(indicators, 'reversion');
        score += volumeScore.score;
        reasoning.push(...volumeScore.reasoning);
        details.volume = volumeScore;

        // DIVERGENCE (0-15 points)
        const divergenceScore = this.scoreDivergence(indicators);
        score += divergenceScore.score;
        reasoning.push(...divergenceScore.reasoning);
        details.divergence = divergenceScore;

        // RANGING MARKET BONUS (NEW) - Mean reversion works better in ranging markets
        if (assessment.marketRegime?.type === 'consolidation' || assessment.marketRegime?.type === 'ranging') {
            score += 10;
            reasoning.push('Ranging market - mean reversion favorable');
        }

        const riskReward = this.calculateRiskReward(currentPrice, indicators, 'long', 'reversion');
        if (!riskReward) return null;

        const confidence = Math.min((score / 100) * 100, 85);

        // More lenient thresholds for mean reversion
        if (score >= this.settings.minScore * 0.9 && confidence >= this.settings.minConfidence * 0.9) {
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
                confirmations: this.calculateWeightedConfirmations({ details }),
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
     * BREAKOUT with realistic volume requirements
     */
    generateBreakoutSignal(indicators, assessment, currentPrice, symbol) {
        let score = 0;
        const reasoning = [];
        const details = {};

        // PRICE ACTION (0-30 points) - Bollinger, support/resistance
        const priceActionScore = this.scorePriceAction(indicators, currentPrice);
        score += priceActionScore.score;
        reasoning.push(...priceActionScore.reasoning);
        details.priceAction = priceActionScore;

        // MOMENTUM (0-25 points)
        const momentumScore = this.scoreMomentum(indicators);
        score += momentumScore.score;
        reasoning.push(...momentumScore.reasoning);
        details.momentum = momentumScore;

        // VOLUME (0-25 points) - Still important but more lenient
        const volumeScore = this.scoreVolume(indicators, 'breakout');
        score += volumeScore.score;
        reasoning.push(...volumeScore.reasoning);
        details.volume = volumeScore;

        // VOLATILITY (0-20 points)
        const volatilityScore = this.scoreVolatility(indicators, assessment);
        score += volatilityScore.score;
        reasoning.push(...volatilityScore.reasoning);
        details.volatility = volatilityScore;

        const riskReward = this.calculateRiskReward(currentPrice, indicators, 'long', 'breakout');
        if (!riskReward) return null;

        const confidence = Math.min((score / 100) * 100, 90);

        if (score >= this.settings.minScore && confidence >= this.settings.minConfidence) {
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
                confirmations: this.calculateWeightedConfirmations({ details }),
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
     * Score trend alignment - ALLOW PARTIAL ALIGNMENT (2 of 3)
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

        // More generous scoring - PARTIAL ALIGNMENT OK
        
        // Price vs EMA21 (0-15 points)
        if (currentPrice > ema21) {
            score += 15;
            reasoning.push('Price above EMA21');
        } else {
            const distance = ((ema21 - currentPrice) / currentPrice) * 100;
            if (distance < 2) { // INCREASED: from 1% to 2%
                score += 10;
                reasoning.push('Price near EMA21');
            } else if (distance < 4) {
                score += 5;
                reasoning.push('Price close to EMA21');
            }
        }

        // EMA21 vs EMA50 (0-15 points)
        if (ema21 > ema50) {
            score += 15;
            reasoning.push('EMA21 above EMA50');
        } else {
            const distance = ((ema50 - ema21) / ema21) * 100;
            if (distance < 1) { // INCREASED: tolerance
                score += 10;
                reasoning.push('EMA21 near EMA50');
            } else if (distance < 3) {
                score += 5;
                reasoning.push('EMA21 close to EMA50');
            }
        }

        // EMA50 vs EMA200 (0-10 points) - Less important
        if (ema200) {
            if (ema50 > ema200) {
                score += 10;
                reasoning.push('EMA50 above EMA200');
            } else {
                const distance = ((ema200 - ema50) / ema50) * 100;
                if (distance < 3) { // INCREASED: tolerance
                    score += 7;
                    reasoning.push('EMA50 near EMA200');
                } else if (distance < 6) {
                    score += 4;
                    reasoning.push('EMA50 approaching EMA200');
                }
            }
        } else {
            score += 5; // Give some credit if EMA200 not available
        }

        return { score, reasoning };
    }

    /**
     * Score momentum with adjusted RSI levels
     */
    scoreMomentum(indicators) {
        let score = 0;
        const reasoning = [];

        // RSI scoring (0-20 points) - More sensitive
        if (indicators.rsi?.current) {
            const rsi = indicators.rsi.current;
            if (rsi > 60 && rsi < this.settings.rsiOverbought) {
                score += 20;
                reasoning.push(`Strong bullish RSI (${rsi.toFixed(1)})`);
            } else if (rsi > 52) {
                score += 15;
                reasoning.push(`Bullish RSI momentum (${rsi.toFixed(1)})`);
            } else if (rsi > 48) {
                score += 10;
                reasoning.push(`Positive RSI (${rsi.toFixed(1)})`);
            } else if (rsi > 42) {
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
     * Score volume - MUCH MORE LENIENT for crypto
     */
    scoreVolume(indicators, signalType) {
        let score = 0;
        const reasoning = [];

        if (!indicators.volumeAnalysis?.ratio) {
            // Don't penalize missing volume as much
            score += 8;
            reasoning.push('Volume data unavailable - partial credit');
            return { score, reasoning };
        }

        const ratio = indicators.volumeAnalysis.ratio;
        const multiplier = this.settings.volumeMultiplier;

        if (signalType === 'trend') {
            if (ratio > multiplier * 3) {
                score += 20;
                reasoning.push(`Massive volume surge (${ratio.toFixed(2)}x)`);
            } else if (ratio > multiplier * 2) {
                score += 15;
                reasoning.push(`Strong volume (${ratio.toFixed(2)}x)`);
            } else if (ratio > multiplier) {
                score += 12;
                reasoning.push(`Above average volume (${ratio.toFixed(2)}x)`);
            } else if (ratio > multiplier * 0.7) { // MUCH LOWER threshold
                score += 10;
                reasoning.push(`Decent volume (${ratio.toFixed(2)}x)`);
            } else if (ratio > 0.3) {
                score += 6;
                reasoning.push(`Low volume (${ratio.toFixed(2)}x)`);
            } else {
                score += 3; // Still give some credit
                reasoning.push(`Very low volume (${ratio.toFixed(2)}x)`);
            }
        } else if (signalType === 'reversion') {
            if (ratio < 0.4) {
                score += 15;
                reasoning.push(`Low volume - selling exhaustion (${ratio.toFixed(2)}x)`);
            } else if (ratio > multiplier * 2) {
                score += 12;
                reasoning.push(`High volume - accumulation (${ratio.toFixed(2)}x)`);
            } else {
                score += 10; // Always give decent credit for mean reversion
                reasoning.push(`Moderate volume (${ratio.toFixed(2)}x)`);
            }
        } else if (signalType === 'breakout') {
            if (ratio > multiplier * 2.5) {
                score += 25;
                reasoning.push(`Strong breakout volume (${ratio.toFixed(2)}x)`);
            } else if (ratio > multiplier * 1.5) {
                score += 20;
                reasoning.push(`Good breakout volume (${ratio.toFixed(2)}x)`);
            } else if (ratio > multiplier) {
                score += 15;
                reasoning.push(`Moderate breakout volume (${ratio.toFixed(2)}x)`);
            } else {
                score += 8; // Be lenient for breakouts too
                reasoning.push(`Low volume breakout (${ratio.toFixed(2)}x)`);
            }
        }

        return { score, reasoning };
    }

    /**
     * Score ADX with much lower thresholds for crypto
     */
    scoreADX(indicators) {
        let score = 0;
        const reasoning = [];

        if (!indicators.adx?.current?.adx) {
            score += 5; // Give partial credit
            reasoning.push('ADX unavailable - partial credit');
            return { score, reasoning };
        }

        const adx = indicators.adx.current.adx;
        const threshold = this.settings.adxTrending;

        if (adx > threshold * 2) {
            score += 10;
            reasoning.push(`Strong trend (ADX: ${adx.toFixed(1)})`);
        } else if (adx > threshold) {
            score += 8;
            reasoning.push(`Trending market (ADX: ${adx.toFixed(1)})`);
        } else if (adx > threshold * 0.7) {
            score += 6;
            reasoning.push(`Developing trend (ADX: ${adx.toFixed(1)})`);
        } else {
            score += 4; // Always give some credit in crypto
            reasoning.push(`Consolidation (ADX: ${adx.toFixed(1)})`);
        }

        return { score, reasoning };
    }

    /**
     * Score oversold conditions - adjusted for crypto volatility
     */
    scoreOversold(indicators) {
        let score = 0;
        const reasoning = [];

        // RSI oversold - more sensitive
        if (indicators.rsi?.current) {
            const rsi = indicators.rsi.current;
            if (rsi < this.settings.rsiOversold - 10) {
                score += 25;
                reasoning.push(`Very oversold RSI (${rsi.toFixed(1)})`);
            } else if (rsi < this.settings.rsiOversold) {
                score += 20;
                reasoning.push(`Oversold RSI (${rsi.toFixed(1)})`);
            } else if (rsi < 45) {
                score += 12;
                reasoning.push(`Weak RSI (${rsi.toFixed(1)})`);
            } else if (rsi < 50) {
                score += 6;
                reasoning.push(`Below neutral RSI (${rsi.toFixed(1)})`);
            }
        }

        // StochRSI
        if (indicators.stochRsi?.oversold) {
            score += 8;
            reasoning.push('StochRSI oversold');
        }

        // Price position vs Bollinger
        if (indicators.bollinger?.position === 'below_lower') {
            score += 12;
            reasoning.push('Price below Bollinger lower band');
        }

        return { score, reasoning };
    }

    /**
     * Score support levels
     */
    scoreSupport(indicators, currentPrice) {
        let score = 0;
        const reasoning = [];

        // Bollinger lower band as support
        if (indicators.bollinger?.current) {
            const lowerBand = indicators.bollinger.current.lower;
            const distance = Math.abs(currentPrice - lowerBand) / currentPrice;
            
            if (distance < 0.015) { // Within 1.5%
                score += 15;
                reasoning.push('Price at strong support (Bollinger)');
            } else if (distance < 0.03) {
                score += 10;
                reasoning.push('Price near support level');
            } else if (distance < 0.06) {
                score += 5;
                reasoning.push('Price approaching support');
            }
        }

        // EMA support
        const ema50 = indicators.emas?.ema50?.current;
        if (ema50) {
            const distance = Math.abs(currentPrice - ema50) / currentPrice;
            if (distance < 0.02 && currentPrice >= ema50 * 0.98) {
                score += 8;
                reasoning.push('EMA50 support level');
            }
        }

        return { score, reasoning };
    }

    /**
     * Score divergence signals
     */
    scoreDivergence(indicators) {
        let score = 0;
        const reasoning = [];

        // Simple divergence detection
        if (indicators.obv?.trend === 'bullish' && indicators.rsi?.current < 45) {
            score += 8;
            reasoning.push('Potential bullish divergence (OBV vs price)');
        }

        if (indicators.macd?.current?.histogram > 0 && indicators.rsi?.current < 45) {
            score += 6;
            reasoning.push('MACD showing divergence potential');
        }

        return { score, reasoning };
    }

    /**
     * Score price action for breakouts
     */
    scorePriceAction(indicators, currentPrice) {
        let score = 0;
        const reasoning = [];

        // Bollinger Band breakouts
        if (indicators.bollinger?.upperBreakout) {
            score += 20;
            reasoning.push('Bollinger upper band breakout');
        } else if (indicators.bollinger?.current) {
            const bb = indicators.bollinger.current;
            const upperDistance = (currentPrice - bb.upper) / bb.upper;
            
            if (upperDistance > -0.01) { // Within 1%
                score += 12;
                reasoning.push('Price near Bollinger upper');
            } else if (upperDistance > -0.03) {
                score += 6;
                reasoning.push('Price approaching Bollinger upper');
            }
        }

        // EMA breakouts
        const ema21 = indicators.emas?.ema21?.current;
        if (ema21 && currentPrice > ema21 * 1.005) { // 0.5% above EMA21
            score += 8;
            reasoning.push('EMA21 breakout');
        }

        return { score, reasoning };
    }

    /**
     * Score volatility expansion
     */
    scoreVolatility(indicators, assessment) {
        let score = 0;
        const reasoning = [];

        if (indicators.bollinger?.squeeze) {
            score += 8;
            reasoning.push('Coming out of Bollinger squeeze');
        }

        if (assessment.volatility?.expansion) {
            score += 10;
            reasoning.push('Volatility expansion');
        }

        if (indicators.atr?.volatility === 'high') {
            score += 6;
            reasoning.push('High volatility');
        } else if (indicators.atr?.volatility === 'elevated') {
            score += 4;
            reasoning.push('Elevated volatility');
        } else {
            score += 2; // Give some credit even for normal volatility
            reasoning.push('Normal volatility');
        }

        return { score, reasoning };
    }

    /**
     * Calculate risk/reward - same logic but adjusted for crypto volatility
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
            stopLossMultiplier *= 0.8; // Tighter stops
            takeProfitRatios = [1.5, 2.5]; // Lower targets
        } else if (signalType === 'breakout') {
            stopLossMultiplier *= 1.1; // Wider stops
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