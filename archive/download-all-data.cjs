const https = require('https');
const fs = require('fs');
const path = require('path');

function fetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function downloadCandles(symbol, interval, startMs, endMs) {
    const all = [];
    let current = startMs;
    const limit = 1000;
    
    while (current < endMs) {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${current}&endTime=${endMs}&limit=${limit}`;
        const data = await fetch(url);
        if (!data.length) break;
        
        for (const k of data) {
            all.push({
                openTime: new Date(k[0]).toISOString(),
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5]),
                closeTime: new Date(k[6]).toISOString(),
            });
        }
        
        current = data[data.length - 1][6] + 1; // closeTime + 1ms
        process.stdout.write(`\r  ${all.length} candles (${new Date(current).toISOString().slice(0,10)})...`);
        
        // Rate limit
        await new Promise(r => setTimeout(r, 200));
    }
    console.log(`\n  Total: ${all.length} candles`);
    return all;
}

async function main() {
    const outDir = path.join(__dirname, '..', 'data', 'backtest');
    
    // Download BTC 4h: Jan 2021 → now
    console.log('📥 Downloading BTCUSDT 4h (Jan 2021 → Feb 2026)...');
    const start = new Date('2021-01-01').getTime();
    const end = Date.now();
    
    const candles = await downloadCandles('BTCUSDT', '4h', start, end);
    
    const outFile = path.join(outDir, 'BTCUSDT_4h_full.json');
    fs.writeFileSync(outFile, JSON.stringify({ symbol: 'BTCUSDT', interval: '4h', candles }, null, 0));
    console.log(`✅ Saved ${candles.length} candles to ${outFile}`);
    console.log(`   Range: ${candles[0].openTime} → ${candles[candles.length-1].openTime}`);
}

main().catch(console.error);
