/**
 * Download Additional Market Periods for Multi-Period Testing
 * Downloads Bear 2022, Bull 2021, and Recovery 2023 periods
 */

import fs from 'fs/promises';

class PeriodDownloader {
    constructor() {
        this.baseUrl = 'https://api.binance.com/api/v3/klines';
    }

    async downloadPeriod(symbol, interval, startTime, endTime, filename) {
        console.log(`📥 Downloading ${filename}...`);
        
        const url = `${this.baseUrl}?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=1000`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (Array.isArray(data)) {
                const candles = data.map(kline => ({
                    openTime: new Date(kline[0]).toISOString(),
                    open: parseFloat(kline[1]),
                    high: parseFloat(kline[2]),
                    low: parseFloat(kline[3]),
                    close: parseFloat(kline[4]),
                    volume: parseFloat(kline[5]),
                    closeTime: new Date(kline[6]).toISOString(),
                    trades: parseInt(kline[8])
                }));

                const dataObj = {
                    symbol,
                    interval,
                    period: filename.replace('.json', ''),
                    startTime: new Date(startTime).toISOString(),
                    endTime: new Date(endTime).toISOString(),
                    candleCount: candles.length,
                    candles
                };

                await fs.writeFile(`./data/backtest/${filename}`, JSON.stringify(dataObj, null, 2));
                console.log(`✅ Downloaded ${candles.length} candles for ${filename}`);
                return true;
            } else {
                console.error(`❌ API error for ${filename}:`, data);
                return false;
            }
        } catch (error) {
            console.error(`❌ Download failed for ${filename}:`, error.message);
            return false;
        }
    }

    async downloadAllPeriods() {
        console.log('🚀 DOWNLOADING ADDITIONAL MARKET PERIODS');
        console.log('='.repeat(50));

        const periods = [
            {
                name: 'bear_2022',
                description: 'Bear Market 2022 (Jan-Jun): BTC $47K → $19K',
                symbol: 'BTCUSDT',
                interval: '4h',
                startTime: new Date('2022-01-01').getTime(),
                endTime: new Date('2022-06-30').getTime(),
                filename: 'BTCUSDT_4h_bear_2022.json'
            },
            {
                name: 'bull_2021',
                description: 'Bull Market 2021 (Jan-Jun): BTC $29K → $35K',
                symbol: 'BTCUSDT',
                interval: '4h',
                startTime: new Date('2021-01-01').getTime(),
                endTime: new Date('2021-06-30').getTime(),
                filename: 'BTCUSDT_4h_bull_2021.json'
            },
            {
                name: 'recovery_2023',
                description: 'Recovery 2023 (Jan-Jun): BTC $16K → $30K',
                symbol: 'BTCUSDT',
                interval: '4h',
                startTime: new Date('2023-01-01').getTime(),
                endTime: new Date('2023-06-30').getTime(),
                filename: 'BTCUSDT_4h_recovery_2023.json'
            }
        ];

        let downloaded = 0;
        for (const period of periods) {
            console.log(`\n📊 ${period.description}`);
            const success = await this.downloadPeriod(
                period.symbol,
                period.interval,
                period.startTime,
                period.endTime,
                period.filename
            );
            
            if (success) downloaded++;
            
            // Rate limiting - wait 1 second between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`\n✅ Downloaded ${downloaded}/${periods.length} periods successfully!`);
        return downloaded === periods.length;
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const downloader = new PeriodDownloader();
    await downloader.downloadAllPeriods();
}

export default PeriodDownloader;