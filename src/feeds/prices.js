/**
 * Price Feed Module
 * Fetches OHLCV data and latest prices from Binance public API
 */

import fs from 'fs/promises';
import path from 'path';

class PriceFeed {
    constructor(config) {
        this.baseUrl = config.binanceBaseUrl;
        this.maxCandles = config.maxCandles;
        this.cacheExpiration = config.cacheExpiration; // 5 minutes
        this.dataDir = './data/candles';
        
        // Ensure data directory exists
        this.ensureDataDirectory();
    }

    async ensureDataDirectory() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
        } catch (error) {
            console.error('Error creating data directory:', error);
        }
    }

    /**
     * Fetch OHLCV candle data from Binance
     * @param {string} symbol - Trading pair (e.g., "BTCUSDT")
     * @param {string} interval - Timeframe (1m, 5m, 15m, 1h, 4h, 1d, 1w)
     * @param {number} limit - Number of candles to fetch (max 1000)
     * @returns {Array} Array of candle objects
     */
    async getCandles(symbol, interval, limit = 500) {
        try {
            // Check cache first
            const cachedData = await this.getCachedCandles(symbol, interval);
            if (cachedData && this.isCacheValid(cachedData.timestamp)) {
                console.log(`Using cached data for ${symbol} ${interval}`);
                return cachedData.candles.slice(-limit);
            }

            // Fetch fresh data
            console.log(`Fetching fresh data for ${symbol} ${interval}`);
            const url = `${this.baseUrl}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const rawCandles = await response.json();
            
            // Transform raw data to structured format
            const candles = rawCandles.map(candle => ({
                openTime: new Date(candle[0]),
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5]),
                closeTime: new Date(candle[6]),
                quoteVolume: parseFloat(candle[7]),
                trades: parseInt(candle[8]),
                buyBaseVolume: parseFloat(candle[9]),
                buyQuoteVolume: parseFloat(candle[10])
            }));

            // Cache the data
            await this.cacheCandles(symbol, interval, candles);
            
            return candles;
            
        } catch (error) {
            console.error(`Error fetching candles for ${symbol} ${interval}:`, error);
            throw error;
        }
    }

    /**
     * Get latest price for a symbol
     * @param {string} symbol - Trading pair
     * @returns {Object} Price information
     */
    async getLatestPrice(symbol) {
        try {
            const url = `${this.baseUrl}/api/v3/ticker/price?symbol=${symbol}`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const priceData = await response.json();
            
            return {
                symbol: priceData.symbol,
                price: parseFloat(priceData.price),
                timestamp: new Date()
            };
            
        } catch (error) {
            console.error(`Error fetching latest price for ${symbol}:`, error);
            throw error;
        }
    }

    /**
     * Get 24hr ticker statistics
     * @param {string} symbol - Trading pair
     * @returns {Object} 24hr ticker data
     */
    async get24hrTicker(symbol) {
        try {
            const url = `${this.baseUrl}/api/v3/ticker/24hr?symbol=${symbol}`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const ticker = await response.json();
            
            return {
                symbol: ticker.symbol,
                priceChange: parseFloat(ticker.priceChange),
                priceChangePercent: parseFloat(ticker.priceChangePercent),
                weightedAvgPrice: parseFloat(ticker.weightedAvgPrice),
                prevClosePrice: parseFloat(ticker.prevClosePrice),
                lastPrice: parseFloat(ticker.lastPrice),
                bidPrice: parseFloat(ticker.bidPrice),
                askPrice: parseFloat(ticker.askPrice),
                openPrice: parseFloat(ticker.openPrice),
                highPrice: parseFloat(ticker.highPrice),
                lowPrice: parseFloat(ticker.lowPrice),
                volume: parseFloat(ticker.volume),
                quoteVolume: parseFloat(ticker.quoteVolume),
                openTime: new Date(ticker.openTime),
                closeTime: new Date(ticker.closeTime),
                count: parseInt(ticker.count)
            };
            
        } catch (error) {
            console.error(`Error fetching 24hr ticker for ${symbol}:`, error);
            throw error;
        }
    }

    /**
     * Cache candle data to local JSON files
     */
    async cacheCandles(symbol, interval, candles) {
        try {
            const filename = `${symbol}_${interval}.json`;
            const filepath = path.join(this.dataDir, filename);
            
            const cacheData = {
                symbol,
                interval,
                timestamp: Date.now(),
                candles
            };
            
            await fs.writeFile(filepath, JSON.stringify(cacheData, null, 2));
            
        } catch (error) {
            console.error('Error caching candles:', error);
        }
    }

    /**
     * Get cached candle data
     */
    async getCachedCandles(symbol, interval) {
        try {
            const filename = `${symbol}_${interval}.json`;
            const filepath = path.join(this.dataDir, filename);
            
            const data = await fs.readFile(filepath, 'utf8');
            const cachedData = JSON.parse(data);
            
            // Convert date strings back to Date objects
            if (cachedData.candles) {
                cachedData.candles = cachedData.candles.map(candle => ({
                    ...candle,
                    openTime: new Date(candle.openTime),
                    closeTime: new Date(candle.closeTime)
                }));
            }
            
            return cachedData;
            
        } catch (error) {
            // File doesn't exist or can't be read
            return null;
        }
    }

    /**
     * Check if cached data is still valid
     */
    isCacheValid(cacheTimestamp) {
        const now = Date.now();
        return (now - cacheTimestamp) < this.cacheExpiration;
    }

    /**
     * Convert interval string to milliseconds
     */
    intervalToMs(interval) {
        const intervalMap = {
            '1m': 60 * 1000,
            '3m': 3 * 60 * 1000,
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '30m': 30 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '2h': 2 * 60 * 60 * 1000,
            '4h': 4 * 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '8h': 8 * 60 * 60 * 1000,
            '12h': 12 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000,
            '3d': 3 * 24 * 60 * 60 * 1000,
            '1w': 7 * 24 * 60 * 60 * 1000,
            '1M': 30 * 24 * 60 * 60 * 1000
        };
        
        return intervalMap[interval] || 60 * 60 * 1000; // Default to 1h
    }

    /**
     * Get multiple timeframes for a symbol
     */
    async getMultiTimeframeData(symbol, intervals) {
        const data = {};
        
        for (const interval of intervals) {
            try {
                data[interval] = await this.getCandles(symbol, interval);
            } catch (error) {
                console.error(`Error fetching ${interval} data for ${symbol}:`, error);
                data[interval] = [];
            }
        }
        
        return data;
    }
}

export default PriceFeed;