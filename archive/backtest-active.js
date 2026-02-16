#!/usr/bin/env node
/**
 * Backtest Active Preset - Clean implementation with proper position sizing
 * Tests across 4 market periods with the recalibrated active preset
 */

import fs from 'fs/promises';
import TechnicalIndicators from './indicators/index.js';
import SignalGenerator from './signals/generator.js';

const CONFIG = {
    preset: 'active',
    initialBalance: 10000,
    riskPerTrade: 0.02,        // 2% per trade
    maxPortfolioHeat: 0.06,    // 6% max open risk
    fees: 0.001,               // 0.1% taker fee
    stopLossATR: 2,            // 2x ATR for stop loss
    takeProfitRatios: [1.5, 3, 4.5],
    maxOpenPositions: 3,
    minRiskReward: 1.5
};

const PERIODS = [
    { name: 'bull_2021', file: './data/backtest/BTCUSDT_4h_bull_2021.json', desc: 'Bull 2021 (BTC $29K→$65K)' },
    { name: 'bear_2022', file: './data/backtest/BTCUSDT_4h_bear_2022.json', desc: 'Bear 2022 (BTC $47K→$19K)' },
    { name: 'recovery_2023', file: './data/backtest/BTCUSDT_4h_recovery_2023.json', desc: 'Recovery 2023 (BTC $16K→$30K)' },
    { name: 'recent_6m', file: './data/backtest/BTCUSDT_4h_historical.json', desc: 'Recent 6 months' },
];

class SimpleBacktest {
    constructor() {
        this.indicators = new TechnicalIndicators();
        this.sg = new SignalGenerator({ preset: CONFIG.preset, riskPerTrade: CONFIG.riskPerTrade });
    }

    run(candles) {
        let balance = CONFIG.initialBalance;
        let peakBalance = balance;
        let maxDrawdown = 0;
        let positions = [];
        let trades = [];
        let wins = 0, losses = 0;
        let totalProfit = 0, totalLoss = 0;

        const lookback = 200; // need 200 candles for indicators

        for (let i = lookback; i < candles.length; i++) {
            const current = candles[i];
            const price = current.close;
            const high = current.high;
            const low = current.low;

            // 1. Check stops and take profits on open positions
            const closedIds = [];
            for (const pos of positions) {
                let exitPrice = null;
                let exitReason = null;

                if (pos.direction === 'long') {
                    if (low <= pos.stopLoss) {
                        exitPrice = pos.stopLoss;
                        exitReason = 'stop_loss';
                    } else if (high >= pos.takeProfit) {
                        exitPrice = pos.takeProfit;
                        exitReason = 'take_profit';
                    }
                } else {
                    if (high >= pos.stopLoss) {
                        exitPrice = pos.stopLoss;
                        exitReason = 'stop_loss';
                    } else if (low <= pos.takeProfit) {
                        exitPrice = pos.takeProfit;
                        exitReason = 'take_profit';
                    }
                }

                if (exitPrice) {
                    const mult = pos.direction === 'long' ? 1 : -1;
                    const grossPnL = (exitPrice - pos.entryPrice) * pos.quantity * mult;
                    const fees = (pos.entryPrice * pos.quantity + exitPrice * pos.quantity) * CONFIG.fees;
                    const netPnL = grossPnL - fees;

                    balance += (pos.entryPrice * pos.quantity) + netPnL; // return collateral + pnl
                    
                    if (netPnL > 0) { wins++; totalProfit += netPnL; }
                    else { losses++; totalLoss += Math.abs(netPnL); }

                    trades.push({
                        entry: pos.entryPrice, exit: exitPrice, direction: pos.direction,
                        netPnL: +netPnL.toFixed(2), reason: exitReason,
                        returnPct: +((netPnL / (pos.entryPrice * pos.quantity)) * 100).toFixed(2)
                    });
                    closedIds.push(pos.id);
                }
            }
            positions = positions.filter(p => !closedIds.includes(p.id));

            // 2. Update drawdown
            const equity = balance + positions.reduce((sum, p) => {
                const mult = p.direction === 'long' ? 1 : -1;
                return sum + (price - p.entryPrice) * p.quantity * mult;
            }, 0);
            if (equity > peakBalance) peakBalance = equity;
            const dd = (peakBalance - equity) / peakBalance;
            if (dd > maxDrawdown) maxDrawdown = dd;

            // 3. Generate signals (every 4 bars to speed up)
            if (i % 4 !== 0) continue;
            if (positions.length >= CONFIG.maxOpenPositions) continue;
            if (balance < CONFIG.initialBalance * 0.1) continue; // circuit breaker at 90% loss

            try {
                const window = candles.slice(Math.max(0, i - 500), i + 1);
                const analysis = this.indicators.analyzeMarket(window);
                const signals = this.sg.generateSignals(analysis, 'BTCUSDT');

                for (const signal of signals) {
                    if (!this.sg.validateSignal(signal)) continue;
                    if (positions.length >= CONFIG.maxOpenPositions) break;

                    const dir = signal.direction || 'long';
                    const entryPrice = signal.entryPrice || price;
                    const stopLoss = signal.stopLoss || (dir === 'long' ? price * 0.98 : price * 1.02);
                    const stopDist = Math.abs(entryPrice - stopLoss);
                    
                    if (stopDist <= 0) continue;

                    const riskAmount = balance * CONFIG.riskPerTrade;
                    const quantity = riskAmount / stopDist;
                    const positionCost = quantity * entryPrice;

                    // Don't use more than 30% of balance per position
                    if (positionCost > balance * 0.3) continue;
                    if (positionCost > balance) continue;

                    const tpDist = stopDist * CONFIG.takeProfitRatios[0];
                    const takeProfit = dir === 'long' ? entryPrice + tpDist : entryPrice - tpDist;

                    balance -= positionCost; // lock collateral
                    positions.push({
                        id: i,
                        direction: dir,
                        entryPrice: entryPrice,
                        quantity,
                        stopLoss,
                        takeProfit,
                    });
                }
            } catch (e) {
                // skip analysis errors
            }
        }

        // Close remaining positions at last price
        const lastPrice = candles[candles.length - 1].close;
        for (const pos of positions) {
            const mult = pos.direction === 'long' ? 1 : -1;
            const grossPnL = (lastPrice - pos.entryPrice) * pos.quantity * mult;
            const fees = (pos.entryPrice * pos.quantity + lastPrice * pos.quantity) * CONFIG.fees;
            const netPnL = grossPnL - fees;
            balance += (pos.entryPrice * pos.quantity) + netPnL;
            if (netPnL > 0) { wins++; totalProfit += netPnL; }
            else { losses++; totalLoss += Math.abs(netPnL); }
        }

        const totalReturn = ((balance - CONFIG.initialBalance) / CONFIG.initialBalance) * 100;
        const totalTrades = wins + losses;
        const pf = totalLoss > 0 ? totalProfit / totalLoss : (totalProfit > 0 ? 99 : 0);

        return {
            totalTrades, wins, losses,
            winRate: totalTrades > 0 ? (wins / totalTrades * 100) : 0,
            totalReturn: +totalReturn.toFixed(2),
            maxDrawdown: +(maxDrawdown * 100).toFixed(2),
            profitFactor: +pf.toFixed(2),
            finalBalance: +balance.toFixed(2),
            avgWin: wins > 0 ? +(totalProfit / wins).toFixed(2) : 0,
            avgLoss: losses > 0 ? +(totalLoss / losses).toFixed(2) : 0,
            trades: trades.slice(-10) // last 10 trades for inspection
        };
    }
}

// Main
const bt = new SimpleBacktest();
const results = {};

console.log('🎯 BACKTEST: Active Preset across 4 Market Periods');
console.log('Config:', JSON.stringify(CONFIG, null, 2));
console.log('');

for (const period of PERIODS) {
    try {
        const data = JSON.parse(await fs.readFile(period.file, 'utf8'));
        const candles = data.candles;
        console.log(`\n📊 ${period.desc} (${candles.length} candles)`);
        
        const result = bt.run(candles);
        results[period.name] = result;
        
        console.log(`   Trades: ${result.totalTrades} (${result.wins}W/${result.losses}L) | Win Rate: ${result.winRate.toFixed(1)}%`);
        console.log(`   Return: ${result.totalReturn}% | Max DD: ${result.maxDrawdown}% | PF: ${result.profitFactor}`);
        console.log(`   Final Balance: $${result.finalBalance} | Avg Win: $${result.avgWin} | Avg Loss: $${result.avgLoss}`);
    } catch (e) {
        console.error(`   ❌ Error: ${e.message}`);
    }
}

// Summary
console.log('\n' + '='.repeat(70));
console.log('📋 RESUMEN COMPARATIVO');
console.log('='.repeat(70));
console.log('Period'.padEnd(20) + 'Trades'.padStart(8) + 'WinRate'.padStart(10) + 'Return'.padStart(10) + 'MaxDD'.padStart(10) + 'PF'.padStart(8));
console.log('-'.repeat(66));
for (const [name, r] of Object.entries(results)) {
    console.log(
        name.padEnd(20) +
        String(r.totalTrades).padStart(8) +
        (r.winRate.toFixed(1) + '%').padStart(10) +
        (r.totalReturn + '%').padStart(10) +
        (r.maxDrawdown + '%').padStart(10) +
        String(r.profitFactor).padStart(8)
    );
}

await fs.writeFile('./data/backtest/results-active.json', JSON.stringify(results, null, 2));
console.log('\n✅ Saved to data/backtest/results-active.json');
