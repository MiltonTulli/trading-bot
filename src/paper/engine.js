/**
 * Paper Trading Engine Module - FIXED VERSION
 * Virtual portfolio management and trade execution with corrected position sizing
 */

import fs from 'fs/promises';

class PaperTradingEngine {
    constructor(config) {
        this.config = config;
        this.initialBalance = config.paperBalance || 10000;
        this.riskPerTrade = config.riskPerTrade || 0.01;
        this.maxPortfolioHeat = config.maxPortfolioHeat || 0.03;
        this.fees = config.fees || 0.001;
        this.maxPositionSize = config.maxPositionSize || 0.25; // Maximum 25% of equity per position
        this.stateFile = './data/state.json';
        
        // Initialize portfolio state
        this.portfolio = {
            balance: this.initialBalance,
            equity: this.initialBalance,
            positions: {},
            closedTrades: [],
            openTrades: {},
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalProfit: 0,
            totalLoss: 0,
            maxDrawdown: 0,
            peakEquity: this.initialBalance,
            lastUpdated: new Date()
        };

        this.loadState();
    }

    /**
     * Load portfolio state from file
     */
    async loadState() {
        try {
            const stateData = await fs.readFile(this.stateFile, 'utf8');
            const savedState = JSON.parse(stateData);
            
            // Merge saved state with default structure
            this.portfolio = {
                ...this.portfolio,
                ...savedState,
                lastUpdated: new Date(savedState.lastUpdated)
            };

            console.log('Portfolio state loaded successfully');
        } catch (error) {
            console.log('No existing state found, starting with fresh portfolio');
            await this.saveState();
        }
    }

    /**
     * Save portfolio state to file
     */
    async saveState() {
        try {
            await fs.mkdir('./data', { recursive: true });
            await fs.writeFile(this.stateFile, JSON.stringify(this.portfolio, null, 2));
        } catch (error) {
            console.error('Error saving state:', error);
        }
    }

    /**
     * Calculate position size based on risk management rules - FIXED VERSION
     */
    calculatePositionSize(signal, currentPrice) {
        const accountValue = this.portfolio.equity;
        const riskAmount = accountValue * this.riskPerTrade;
        const stopDistance = Math.abs(currentPrice - signal.stopLoss);
        
        console.log(`📊 Position Sizing Debug:`);
        console.log(`   Account Value: $${accountValue.toFixed(2)}`);
        console.log(`   Risk Per Trade: ${(this.riskPerTrade * 100).toFixed(1)}%`);
        console.log(`   Risk Amount: $${riskAmount.toFixed(2)}`);
        console.log(`   Current Price: $${currentPrice.toFixed(2)}`);
        console.log(`   Stop Loss: $${signal.stopLoss.toFixed(2)}`);
        console.log(`   Stop Distance: $${stopDistance.toFixed(2)}`);
        
        if (stopDistance === 0 || stopDistance < currentPrice * 0.001) {
            console.warn('⚠️  Invalid stop loss distance - too close to entry');
            return 0;
        }

        // Risk-based position size calculation
        const riskBasedSize = riskAmount / stopDistance;
        console.log(`   Risk-based Size: ${riskBasedSize.toFixed(4)} units`);
        
        // Check current portfolio heat
        const currentHeat = this.calculateCurrentPortfolioHeat();
        const availableHeat = this.maxPortfolioHeat - currentHeat;
        
        console.log(`   Current Portfolio Heat: ${(currentHeat * 100).toFixed(2)}%`);
        console.log(`   Available Heat: ${(availableHeat * 100).toFixed(2)}%`);
        
        if (availableHeat <= 0) {
            console.log('❌ Portfolio heat limit reached, no new positions allowed');
            return 0;
        }

        // Adjust position size based on available heat
        const heatAdjustment = Math.min(availableHeat / this.riskPerTrade, 1);
        let adjustedSize = riskBasedSize * heatAdjustment;
        console.log(`   Heat Adjustment: ${heatAdjustment.toFixed(3)}`);
        console.log(`   Heat-adjusted Size: ${adjustedSize.toFixed(4)} units`);

        // CRITICAL FIX: Ensure position doesn't exceed maximum position size
        const maxAllowedValue = accountValue * this.maxPositionSize;
        const maxAllowedShares = maxAllowedValue / currentPrice;
        
        if (adjustedSize > maxAllowedShares) {
            console.log(`⚠️  Position size capped by max position limit`);
            console.log(`   Max Position Value: $${maxAllowedValue.toFixed(2)} (${(this.maxPositionSize * 100).toFixed(1)}%)`);
            console.log(`   Max Shares: ${maxAllowedShares.toFixed(4)}`);
            adjustedSize = maxAllowedShares;
        }

        // CRITICAL FIX: Check available balance PROPERLY
        const requiredCapital = adjustedSize * currentPrice;
        const availableBalance = this.portfolio.balance;
        
        console.log(`   Required Capital: $${requiredCapital.toFixed(2)}`);
        console.log(`   Available Balance: $${availableBalance.toFixed(2)}`);
        
        if (requiredCapital > availableBalance) {
            // OLD BUGGY CODE: return availableBalance / currentPrice * 0.95;
            // NEW FIXED CODE: Respect risk management even if we don't have enough capital
            console.warn('❌ Insufficient balance for risk-based position size');
            console.log(`   Would need $${requiredCapital.toFixed(2)} but only have $${availableBalance.toFixed(2)}`);
            
            // Calculate what position size we can afford while maintaining the same risk
            const affordableSize = (availableBalance * 0.95) / currentPrice; // 5% buffer for fees
            const affordableRisk = affordableSize * stopDistance;
            const riskPercent = affordableRisk / accountValue;
            
            console.log(`   Affordable Size: ${affordableSize.toFixed(4)} units`);
            console.log(`   Resulting Risk: $${affordableRisk.toFixed(2)} (${(riskPercent * 100).toFixed(2)}%)`);
            
            // Only take the position if the actual risk is reasonable
            if (riskPercent <= this.riskPerTrade * 1.5) { // Allow 50% more risk than intended if necessary
                adjustedSize = affordableSize;
                console.log(`✅ Position acceptable with ${(riskPercent * 100).toFixed(2)}% risk`);
            } else {
                console.log(`❌ Position would risk ${(riskPercent * 100).toFixed(2)}%, exceeding limits`);
                return 0;
            }
        }

        // Final validation
        const finalRequiredCapital = adjustedSize * currentPrice;
        const finalRisk = adjustedSize * stopDistance;
        const finalRiskPercent = finalRisk / accountValue;
        
        console.log(`📈 Final Position:`);
        console.log(`   Size: ${adjustedSize.toFixed(4)} units`);
        console.log(`   Value: $${finalRequiredCapital.toFixed(2)}`);
        console.log(`   Risk: $${finalRisk.toFixed(2)} (${(finalRiskPercent * 100).toFixed(2)}%)`);
        
        // Sanity checks
        if (adjustedSize <= 0) {
            console.log('❌ Invalid position size');
            return 0;
        }
        
        if (finalRiskPercent > this.riskPerTrade * 2) {
            console.log('❌ Risk too high, rejecting position');
            return 0;
        }

        return adjustedSize;
    }

    /**
     * Calculate current portfolio heat (total risk) - IMPROVED VERSION
     */
    calculateCurrentPortfolioHeat() {
        let totalRisk = 0;
        let totalPositionValue = 0;
        
        Object.values(this.portfolio.openTrades).forEach(trade => {
            const currentPositionValue = trade.quantity * (trade.currentPrice || trade.entryPrice);
            const riskPerShare = Math.abs(trade.entryPrice - trade.stopLoss);
            const positionRisk = riskPerShare * trade.quantity;
            
            totalRisk += positionRisk;
            totalPositionValue += currentPositionValue;
        });

        const heatByRisk = totalRisk / this.portfolio.equity;
        const heatByPosition = totalPositionValue / this.portfolio.equity;
        
        // Use the higher of the two heat calculations
        return Math.max(heatByRisk, heatByPosition * 0.1); // Assume 10% adverse move for position heat
    }

    /**
     * Execute a paper trade based on a signal - ENHANCED VERSION
     */
    async executeTrade(signal, currentPrice) {
        try {
            console.log(`\n🎯 Executing Trade for ${signal.symbol}`);
            
            // Validate signal
            if (!signal || !signal.symbol || !signal.direction) {
                throw new Error('Invalid signal provided');
            }

            // Calculate position size with improved logic
            const quantity = this.calculatePositionSize(signal, currentPrice);
            
            if (quantity <= 0) {
                console.log(`❌ Skipping trade for ${signal.symbol}: invalid position size`);
                return null;
            }

            // Check for existing position
            if (this.portfolio.openTrades[signal.symbol]) {
                console.log(`❌ Position already exists for ${signal.symbol}`);
                return null;
            }

            // Calculate trade costs
            const tradeValue = quantity * currentPrice;
            const entryFee = tradeValue * this.fees;
            const totalCost = tradeValue + entryFee;

            // Final balance check (should be redundant now)
            if (totalCost > this.portfolio.balance) {
                console.log(`❌ Final check: Insufficient balance for ${signal.symbol} trade`);
                return null;
            }

            // Create trade object
            const trade = {
                id: `${signal.symbol}_${Date.now()}`,
                symbol: signal.symbol,
                direction: signal.direction,
                entryPrice: currentPrice,
                quantity: quantity,
                stopLoss: signal.stopLoss,
                takeProfits: signal.takeProfits,
                entryTime: new Date(),
                entryFee: entryFee,
                signal: {
                    type: signal.type,
                    confidence: signal.confidence,
                    reasoning: signal.reasoning,
                    riskRewardRatio: signal.riskRewardRatio,
                    score: signal.score,
                    preset: signal.preset
                },
                status: 'open',
                currentPrice: currentPrice,
                unrealizedPnL: 0,
                maxFavorableExcursion: 0,
                maxAdverseExcursion: 0
            };

            // Execute trade
            this.portfolio.openTrades[signal.symbol] = trade;
            this.portfolio.balance -= totalCost;
            this.portfolio.totalTrades++;

            // Calculate actual risk
            const actualRisk = quantity * Math.abs(currentPrice - signal.stopLoss);
            const riskPercent = actualRisk / this.portfolio.equity;

            console.log(`\n✅ Paper trade executed successfully:`);
            console.log(`   ${signal.direction.toUpperCase()} ${quantity.toFixed(4)} ${signal.symbol} @ $${currentPrice.toFixed(2)}`);
            console.log(`   Position Value: $${tradeValue.toFixed(2)}`);
            console.log(`   Entry Fee: $${entryFee.toFixed(2)}`);
            console.log(`   Actual Risk: $${actualRisk.toFixed(2)} (${(riskPercent * 100).toFixed(2)}%)`);
            console.log(`   Stop Loss: $${signal.stopLoss.toFixed(2)}`);
            console.log(`   Risk/Reward: ${signal.riskRewardRatio.toFixed(2)}`);
            console.log(`   Signal Score: ${signal.score}/100`);

            // Save state
            await this.saveState();

            return trade;

        } catch (error) {
            console.error('❌ Error executing paper trade:', error);
            return null;
        }
    }

    /**
     * Update open positions with current prices
     */
    async updatePositions(marketData) {
        const updates = [];

        for (const symbol in this.portfolio.openTrades) {
            const trade = this.portfolio.openTrades[symbol];
            
            // Get current price for the symbol
            let currentPrice = null;
            for (const timeframe in marketData[symbol] || {}) {
                if (marketData[symbol][timeframe] && marketData[symbol][timeframe].currentPrice) {
                    currentPrice = marketData[symbol][timeframe].currentPrice;
                    break;
                }
            }

            if (currentPrice) {
                const update = await this.updatePosition(trade, currentPrice);
                if (update) {
                    updates.push(update);
                }
            }
        }

        // Update portfolio equity
        this.updatePortfolioMetrics();
        await this.saveState();

        return updates;
    }

    /**
     * Update individual position
     */
    async updatePosition(trade, currentPrice) {
        const previousPrice = trade.currentPrice;
        trade.currentPrice = currentPrice;

        // Calculate unrealized P&L
        const priceDiff = trade.direction === 'long' 
            ? currentPrice - trade.entryPrice 
            : trade.entryPrice - currentPrice;
            
        trade.unrealizedPnL = priceDiff * trade.quantity;

        // Track maximum favorable and adverse excursions
        if (trade.unrealizedPnL > trade.maxFavorableExcursion) {
            trade.maxFavorableExcursion = trade.unrealizedPnL;
        }

        if (trade.unrealizedPnL < trade.maxAdverseExcursion) {
            trade.maxAdverseExcursion = trade.unrealizedPnL;
        }

        // Check for exit conditions
        const exitReason = this.checkExitConditions(trade, currentPrice);
        if (exitReason) {
            return await this.closePosition(trade, currentPrice, exitReason);
        }

        return {
            symbol: trade.symbol,
            action: 'update',
            unrealizedPnL: trade.unrealizedPnL,
            currentPrice: currentPrice
        };
    }

    /**
     * Check exit conditions for a position
     */
    checkExitConditions(trade, currentPrice) {
        // Stop loss check
        if (trade.direction === 'long' && currentPrice <= trade.stopLoss) {
            return 'stop_loss';
        } else if (trade.direction === 'short' && currentPrice >= trade.stopLoss) {
            return 'stop_loss';
        }

        // Take profit checks
        if (trade.takeProfits && trade.takeProfits.length > 0) {
            for (const tp of trade.takeProfits) {
                if (trade.direction === 'long' && currentPrice >= tp.price) {
                    return `take_profit_${tp.ratio}`;
                } else if (trade.direction === 'short' && currentPrice <= tp.price) {
                    return `take_profit_${tp.ratio}`;
                }
            }
        }

        return null;
    }

    /**
     * Close a position - ENHANCED VERSION
     */
    async closePosition(trade, exitPrice, exitReason) {
        try {
            // Calculate final P&L
            const priceDiff = trade.direction === 'long' 
                ? exitPrice - trade.entryPrice 
                : trade.entryPrice - exitPrice;
                
            const grossPnL = priceDiff * trade.quantity;
            const exitFee = trade.quantity * exitPrice * this.fees;
            const netPnL = grossPnL - trade.entryFee - exitFee;

            // Create closed trade record
            const closedTrade = {
                ...trade,
                exitPrice,
                exitTime: new Date(),
                exitFee,
                grossPnL,
                netPnL,
                exitReason,
                holdingPeriod: new Date() - trade.entryTime,
                status: 'closed'
            };

            // Update portfolio
            this.portfolio.balance += (trade.quantity * exitPrice) - exitFee;
            this.portfolio.closedTrades.push(closedTrade);
            delete this.portfolio.openTrades[trade.symbol];

            // Update statistics
            if (netPnL > 0) {
                this.portfolio.winningTrades++;
                this.portfolio.totalProfit += netPnL;
            } else {
                this.portfolio.losingTrades++;
                this.portfolio.totalLoss += Math.abs(netPnL);
            }

            const returnPct = (netPnL / (trade.entryPrice * trade.quantity)) * 100;
            const riskPct = (Math.abs(trade.entryPrice - trade.stopLoss) * trade.quantity) / this.portfolio.equity * 100;
            
            console.log(`🔄 Position closed: ${trade.symbol} ${exitReason}`);
            console.log(`   P&L: $${netPnL.toFixed(2)} (${returnPct.toFixed(2)}%)`);
            console.log(`   Risk taken: ${riskPct.toFixed(2)}% of portfolio`);
            console.log(`   Hold time: ${Math.round((closedTrade.holdingPeriod) / (1000 * 60 * 60))} hours`);

            return {
                symbol: trade.symbol,
                action: 'close',
                exitReason,
                netPnL,
                returnPct,
                holdingPeriod: closedTrade.holdingPeriod
            };

        } catch (error) {
            console.error('Error closing position:', error);
            return null;
        }
    }

    /**
     * Update portfolio-level metrics
     */
    updatePortfolioMetrics() {
        // Calculate total equity (balance + unrealized P&L)
        let totalUnrealizedPnL = 0;
        Object.values(this.portfolio.openTrades).forEach(trade => {
            totalUnrealizedPnL += trade.unrealizedPnL || 0;
        });

        this.portfolio.equity = this.portfolio.balance + totalUnrealizedPnL;

        // Update peak equity and drawdown
        if (this.portfolio.equity > this.portfolio.peakEquity) {
            this.portfolio.peakEquity = this.portfolio.equity;
        }

        const currentDrawdown = (this.portfolio.peakEquity - this.portfolio.equity) / this.portfolio.peakEquity;
        if (currentDrawdown > this.portfolio.maxDrawdown) {
            this.portfolio.maxDrawdown = currentDrawdown;
        }

        this.portfolio.lastUpdated = new Date();
    }

    /**
     * Get portfolio performance metrics - ENHANCED VERSION
     */
    getPerformanceMetrics() {
        const totalTrades = this.portfolio.totalTrades;
        const winRate = totalTrades > 0 ? (this.portfolio.winningTrades / totalTrades) * 100 : 0;
        const profitFactor = this.portfolio.totalLoss > 0 
            ? this.portfolio.totalProfit / this.portfolio.totalLoss 
            : this.portfolio.totalProfit > 0 ? 99 : 0;
        
        const totalReturn = ((this.portfolio.equity - this.initialBalance) / this.initialBalance) * 100;
        
        // Calculate average win and loss
        const avgWin = this.portfolio.winningTrades > 0 
            ? this.portfolio.totalProfit / this.portfolio.winningTrades 
            : 0;
        const avgLoss = this.portfolio.losingTrades > 0 
            ? this.portfolio.totalLoss / this.portfolio.losingTrades 
            : 0;

        // Calculate expectancy
        const expectancy = totalTrades > 0 
            ? ((avgWin * winRate/100) - (avgLoss * (100-winRate)/100))
            : 0;

        // Simple Sharpe ratio approximation
        const returns = this.portfolio.closedTrades.map(trade => 
            (trade.netPnL / (trade.entryPrice * trade.quantity)) * 100
        );
        const avgReturn = returns.length > 0 
            ? returns.reduce((sum, ret) => sum + ret, 0) / returns.length 
            : 0;
        const returnStdDev = returns.length > 1 
            ? Math.sqrt(returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / (returns.length - 1))
            : 0;
        const sharpeRatio = returnStdDev > 0 ? avgReturn / returnStdDev : 0;

        // Additional risk metrics
        const maxConsecutiveLosses = this.calculateMaxConsecutiveLosses();
        const avgRiskPerTrade = this.calculateAverageRiskPerTrade();

        return {
            totalEquity: this.portfolio.equity,
            totalBalance: this.portfolio.balance,
            totalReturn,
            totalTrades,
            winningTrades: this.portfolio.winningTrades,
            losingTrades: this.portfolio.losingTrades,
            winRate,
            profitFactor,
            avgWin,
            avgLoss,
            expectancy,
            maxDrawdown: this.portfolio.maxDrawdown * 100,
            sharpeRatio,
            openPositions: Object.keys(this.portfolio.openTrades).length,
            portfolioHeat: this.calculateCurrentPortfolioHeat() * 100,
            maxConsecutiveLosses,
            avgRiskPerTrade: avgRiskPerTrade * 100
        };
    }

    /**
     * Calculate maximum consecutive losses
     */
    calculateMaxConsecutiveLosses() {
        let maxLosses = 0;
        let currentLosses = 0;

        this.portfolio.closedTrades.forEach(trade => {
            if (trade.netPnL < 0) {
                currentLosses++;
                maxLosses = Math.max(maxLosses, currentLosses);
            } else {
                currentLosses = 0;
            }
        });

        return maxLosses;
    }

    /**
     * Calculate average risk per trade
     */
    calculateAverageRiskPerTrade() {
        if (this.portfolio.closedTrades.length === 0) return 0;

        let totalRisk = 0;
        this.portfolio.closedTrades.forEach(trade => {
            const riskAmount = Math.abs(trade.entryPrice - trade.stopLoss) * trade.quantity;
            const riskPercent = riskAmount / this.initialBalance; // Use initial balance for consistency
            totalRisk += riskPercent;
        });

        return totalRisk / this.portfolio.closedTrades.length;
    }

    /**
     * Get current positions summary
     */
    getCurrentPositions() {
        return Object.values(this.portfolio.openTrades).map(trade => ({
            symbol: trade.symbol,
            direction: trade.direction,
            quantity: trade.quantity,
            entryPrice: trade.entryPrice,
            currentPrice: trade.currentPrice,
            unrealizedPnL: trade.unrealizedPnL,
            unrealizedPnLPercent: ((trade.unrealizedPnL || 0) / (trade.entryPrice * trade.quantity)) * 100,
            stopLoss: trade.stopLoss,
            entryTime: trade.entryTime,
            holdingPeriod: new Date() - trade.entryTime,
            signalType: trade.signal.type,
            confidence: trade.signal.confidence,
            score: trade.signal.score,
            preset: trade.signal.preset
        }));
    }

    /**
     * Get recent trades
     */
    getRecentTrades(limit = 10) {
        return this.portfolio.closedTrades
            .sort((a, b) => new Date(b.exitTime) - new Date(a.exitTime))
            .slice(0, limit)
            .map(trade => ({
                symbol: trade.symbol,
                direction: trade.direction,
                entryPrice: trade.entryPrice,
                exitPrice: trade.exitPrice,
                quantity: trade.quantity,
                netPnL: trade.netPnL,
                returnPercent: (trade.netPnL / (trade.entryPrice * trade.quantity)) * 100,
                exitReason: trade.exitReason,
                entryTime: trade.entryTime,
                exitTime: trade.exitTime,
                holdingPeriod: trade.holdingPeriod,
                signalScore: trade.signal?.score,
                preset: trade.signal?.preset
            }));
    }

    /**
     * Reset portfolio (for testing)
     */
    async resetPortfolio() {
        this.portfolio = {
            balance: this.initialBalance,
            equity: this.initialBalance,
            positions: {},
            closedTrades: [],
            openTrades: {},
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalProfit: 0,
            totalLoss: 0,
            maxDrawdown: 0,
            peakEquity: this.initialBalance,
            lastUpdated: new Date()
        };

        await this.saveState();
        console.log('✅ Portfolio reset to initial state');
    }
}

export default PaperTradingEngine;