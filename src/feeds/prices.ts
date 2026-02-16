/**
 * Price Feed Module
 * Fetches OHLCV data and latest prices from Binance public API
 */

import fs from 'fs/promises';
import path from 'path';
import type {
  PriceFeedConfig,
  OHLCVCandle,
  PriceInfo,
  TickerData,
  CandleCache,
} from '../types.ts';

class PriceFeed {
  private baseUrl: string;
  private maxCandles: number;
  private cacheExpiration: number;
  private dataDir: string;

  constructor(config: PriceFeedConfig) {
    this.baseUrl = config.binanceBaseUrl || 'https://api.binance.com';
    this.maxCandles = config.maxCandles;
    this.cacheExpiration = config.cacheExpiration;
    this.dataDir = './data/candles';

    this.ensureDataDirectory();
  }

  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('Error creating data directory:', error);
    }
  }

  async getCandles(symbol: string, interval: string, limit: number = 500): Promise<OHLCVCandle[]> {
    try {
      const cachedData = await this.getCachedCandles(symbol, interval);
      if (cachedData && this.isCacheValid(cachedData.timestamp)) {
        console.log(`Using cached data for ${symbol} ${interval}`);
        return cachedData.candles.slice(-limit);
      }

      console.log(`Fetching fresh data for ${symbol} ${interval}`);
      const url = `${this.baseUrl}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawCandles = await response.json() as Array<Array<string | number>>;

      const candles: OHLCVCandle[] = rawCandles.map((candle) => ({
        openTime: new Date(candle[0] as number),
        open: parseFloat(candle[1] as string),
        high: parseFloat(candle[2] as string),
        low: parseFloat(candle[3] as string),
        close: parseFloat(candle[4] as string),
        volume: parseFloat(candle[5] as string),
        closeTime: new Date(candle[6] as number),
        quoteVolume: parseFloat(candle[7] as string),
        trades: parseInt(candle[8] as string),
        buyBaseVolume: parseFloat(candle[9] as string),
        buyQuoteVolume: parseFloat(candle[10] as string),
      }));

      await this.cacheCandles(symbol, interval, candles);

      return candles;
    } catch (error) {
      console.error(`Error fetching candles for ${symbol} ${interval}:`, error);
      throw error;
    }
  }

  async getLatestPrice(symbol: string): Promise<PriceInfo> {
    try {
      const url = `${this.baseUrl}/api/v3/ticker/price?symbol=${symbol}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const priceData = await response.json() as { symbol: string; price: string };

      return {
        symbol: priceData.symbol,
        price: parseFloat(priceData.price),
        timestamp: new Date(),
      };
    } catch (error) {
      console.error(`Error fetching latest price for ${symbol}:`, error);
      throw error;
    }
  }

  async get24hrTicker(symbol: string): Promise<TickerData> {
    try {
      const url = `${this.baseUrl}/api/v3/ticker/24hr?symbol=${symbol}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const ticker = await response.json() as Record<string, string | number>;

      return {
        symbol: ticker.symbol as string,
        priceChange: parseFloat(ticker.priceChange as string),
        priceChangePercent: parseFloat(ticker.priceChangePercent as string),
        weightedAvgPrice: parseFloat(ticker.weightedAvgPrice as string),
        prevClosePrice: parseFloat(ticker.prevClosePrice as string),
        lastPrice: parseFloat(ticker.lastPrice as string),
        bidPrice: parseFloat(ticker.bidPrice as string),
        askPrice: parseFloat(ticker.askPrice as string),
        openPrice: parseFloat(ticker.openPrice as string),
        highPrice: parseFloat(ticker.highPrice as string),
        lowPrice: parseFloat(ticker.lowPrice as string),
        volume: parseFloat(ticker.volume as string),
        quoteVolume: parseFloat(ticker.quoteVolume as string),
        openTime: new Date(ticker.openTime as number),
        closeTime: new Date(ticker.closeTime as number),
        count: parseInt(ticker.count as string),
      };
    } catch (error) {
      console.error(`Error fetching 24hr ticker for ${symbol}:`, error);
      throw error;
    }
  }

  private async cacheCandles(symbol: string, interval: string, candles: OHLCVCandle[]): Promise<void> {
    try {
      const filename = `${symbol}_${interval}.json`;
      const filepath = path.join(this.dataDir, filename);

      const cacheData: CandleCache = {
        symbol,
        interval,
        timestamp: Date.now(),
        candles,
      };

      await fs.writeFile(filepath, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.error('Error caching candles:', error);
    }
  }

  private async getCachedCandles(symbol: string, interval: string): Promise<CandleCache | null> {
    try {
      const filename = `${symbol}_${interval}.json`;
      const filepath = path.join(this.dataDir, filename);

      const data = await fs.readFile(filepath, 'utf8');
      const cachedData = JSON.parse(data) as CandleCache;

      if (cachedData.candles) {
        cachedData.candles = cachedData.candles.map((candle) => ({
          ...candle,
          openTime: new Date(candle.openTime),
          closeTime: new Date(candle.closeTime),
        }));
      }

      return cachedData;
    } catch {
      return null;
    }
  }

  private isCacheValid(cacheTimestamp: number): boolean {
    return (Date.now() - cacheTimestamp) < this.cacheExpiration;
  }

  intervalToMs(interval: string): number {
    const intervalMap: Record<string, number> = {
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
      '1M': 30 * 24 * 60 * 60 * 1000,
    };

    return intervalMap[interval] || 60 * 60 * 1000;
  }

  async getMultiTimeframeData(symbol: string, intervals: string[]): Promise<Record<string, OHLCVCandle[]>> {
    const data: Record<string, OHLCVCandle[]> = {};

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
