/**
 * Shared type definitions for the trading bot
 */

// ─── Market Data ───────────────────────────────────────────────────

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface BacktestCandle extends Candle {
  date: string;
}

export interface OHLCVCandle {
  openTime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: Date;
  quoteVolume: number;
  trades: number;
  buyBaseVolume: number;
  buyQuoteVolume: number;
}

// ─── Strategy & Config ─────────────────────────────────────────────

export interface StrategyParams {
  lookback: number;
  volMult: number;
  sl: number;
  tp: number;
  posSize: number;
  leverage: number;
  fees?: number;
}

export interface Config {
  strategy: string;
  pairs: string[];
  timeframe: string;
  mode: string;
  params: StrategyParams;
  paperBalance: number;
  binanceApiKey?: string;
  binanceApiSecret?: string;
}

// ─── Trading ───────────────────────────────────────────────────────

export interface Position {
  side: 1 | -1;
  entry: number;
  size: number;
  openedAt: string;
  mode: 'PAPER' | 'LIVE';
  liveQty?: number;
  liveOrder?: BinanceOrderResult | null;
}

export interface TradeRecord {
  side: 'LONG' | 'SHORT';
  entry: number;
  exit: number;
  pnl: number;
  openedAt: string;
  closedAt: string;
  reason: string;
  mode: 'PAPER' | 'LIVE';
  liveOrder: BinanceOrderResult | null;
}

export interface TradeStats {
  wins: number;
  losses: number;
  totalPnL: number;
}

export interface BotState {
  balance: number;
  position: Position | null;
  trades: TradeRecord[];
  stats: TradeStats;
  lastRun: string;
  lastPrice: number;
  mode: 'PAPER' | 'LIVE';
}

export interface EngineResult {
  time: string;
  price: number;
  action: string;
  balance: number;
  position: string;
  stats: TradeStats;
  mode: 'PAPER' | 'LIVE';
  liveOrder: BinanceOrderResult | null;
}

// ─── Backtest ──────────────────────────────────────────────────────

export interface BacktestResult {
  balance: number;
  trades: number;
  wins: number;
  winRate: number;
  returnPct: number;
  maxDD: number;
  pf: number;
}

export interface BacktestPeriodResult extends BacktestResult {
  name: string;
}

export interface BacktestDataset {
  name: string;
  file: string;
}

// ─── Binance API ───────────────────────────────────────────────────

export interface BinanceOrderResult {
  orderId?: number;
  symbol?: string;
  status?: string;
  [key: string]: unknown;
}

export interface BinanceBalance {
  asset: string;
  balance: string;
  [key: string]: unknown;
}

export interface BinancePositionRisk {
  symbol: string;
  positionAmt: string;
  [key: string]: unknown;
}

// ─── Indicators ────────────────────────────────────────────────────

export interface CandleWithClose {
  close: number;
}

export interface CandleWithHLC {
  high: number;
  low: number;
  close: number;
}

export interface CandleWithVolume {
  volume: number;
}

export interface CandleWithHigh {
  high: number;
}

export interface CandleWithLow {
  low: number;
}

export interface BollingerBands {
  upper: number[];
  middle: number[];
  lower: number[];
}

export interface MACDResult {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
}

// ─── Logger ────────────────────────────────────────────────────────

export interface LoggerConfig {
  verbose?: boolean;
}

export interface DecisionLog {
  timestamp: Date;
  action: string;
  symbol?: string;
  reasoning?: string;
  id: string;
  [key: string]: unknown;
}

export interface TradeLog {
  timestamp: Date;
  tradeId: string;
  symbol: string;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryTime: number;
  exitTime: number;
  holdingPeriod: number;
  holdingPeriodHours: number;
  grossPnL: number;
  netPnL: number;
  returnPercent: number;
  fees: number;
  exitReason: string;
  maxFavorableExcursion?: number;
  maxAdverseExcursion?: number;
  signal: {
    type?: string;
    confidence?: number;
    reasoning?: string;
    riskRewardRatio?: number;
  };
  marketConditions: unknown;
}

export interface TradeInput {
  id: string;
  symbol: string;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryTime: number;
  exitTime: number;
  grossPnL: number;
  netPnL: number;
  entryFee: number;
  exitFee: number;
  exitReason: string;
  maxFavorableExcursion?: number;
  maxAdverseExcursion?: number;
  signal?: {
    type?: string;
    confidence?: number;
    reasoning?: string;
    riskRewardRatio?: number;
  };
  marketConditions?: unknown;
}

export interface PerformanceMetrics {
  totalReturn: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
  sharpeRatio: number;
  portfolioHeat: number;
}

export interface PortfolioState {
  equity: number;
  balance: number;
  openTrades: Record<string, {
    symbol: string;
    direction: string;
    unrealizedPnL: number;
    entryTime: number;
  }>;
}

export interface PerformanceReport {
  timestamp: Date;
  period: {
    startDate: Date;
    endDate: Date;
    totalDays: string;
  };
  trades: {
    total: number;
    winning: number;
    losing: number;
    winRate: string;
    profitFactor: string;
  };
  returns: {
    totalProfit: string;
    totalLoss: string;
    netProfit: string;
    avgWin: string;
    avgLoss: string;
    avgReturn: string;
    expectancy: string;
  };
  risk: {
    maxDrawdown: string;
    longestDrawdownDays: string;
    stdDev: string;
    sharpeRatio: string;
  };
  timing: {
    tradingFrequency: string;
    avgHoldingTimeHours: string;
    executionRate: string;
  };
  strategies: Record<string, StrategyStats>;
  decisions: {
    total: number;
    trades: number;
    skips: number;
    executionRate: string;
  };
}

export interface StrategyStats {
  count: number;
  wins: number;
  totalPnL: number;
  avgReturn: number;
  winRate?: number;
  avgPnL?: number;
}

// ─── News Feed ─────────────────────────────────────────────────────

export interface NewsFeedConfig {
  cryptoCompareApiUrl?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  body: string;
  url: string;
  source: string;
  tags: string[];
  publishedOn: Date;
  imageUrl: string;
  sentiment: SentimentResult;
  categories: string[];
  lang: string;
}

export interface SentimentResult {
  score: number;
  label: 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish';
  confidence: number;
  bullishCount: number;
  bearishCount: number;
  totalKeywords: number;
}

export interface SentimentSummary {
  total: number;
  sentimentCounts: Record<string, number>;
  percentages: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  overallSentiment: string;
  netSentiment: number;
}

export interface TrendingData {
  coins: TrendingCoin[];
  nfts: TrendingNFT[];
  categories: TrendingCategory[];
}

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  marketCapRank: number;
  thumb: string;
  score: number;
  sentiment: string;
}

export interface TrendingNFT {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
}

export interface TrendingCategory {
  id: string;
  name: string;
  marketCapChange24h: number;
  sentiment: string;
}

export interface NewsSignal {
  type: string;
  direction: string;
  strength: number;
  confidence: number;
  reasoning: string;
  newsCount?: number;
  sentiment?: SentimentSummary;
  timestamp?: Date;
}

export interface NewsAnalysis {
  timestamp: Date;
  general: {
    news: NewsArticle[];
    sentiment: SentimentSummary;
    recent: NewsArticle[];
  };
  specific: Record<string, {
    news: NewsArticle[];
    sentiment: SentimentSummary;
    recent: NewsArticle[];
  }>;
  trending: TrendingData;
  signals: Record<string, NewsSignal | null>;
}

// ─── Price Feed ────────────────────────────────────────────────────

export interface PriceFeedConfig {
  binanceBaseUrl?: string;
  maxCandles: number;
  cacheExpiration: number;
}

export interface PriceInfo {
  symbol: string;
  price: number;
  timestamp: Date;
}

export interface TickerData {
  symbol: string;
  priceChange: number;
  priceChangePercent: number;
  weightedAvgPrice: number;
  prevClosePrice: number;
  lastPrice: number;
  bidPrice: number;
  askPrice: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  openTime: Date;
  closeTime: Date;
  count: number;
}

export interface CandleCache {
  symbol: string;
  interval: string;
  timestamp: number;
  candles: OHLCVCandle[];
}

export interface RecentPerformance {
  period: string;
  trades: number;
  netPnL: number;
  winRate: number;
  avgPnL: number;
  bestTrade: number;
  worstTrade: number;
}

export interface GoLiveResult {
  status: 'live';
  usdtBalance: number;
}

export interface GoPaperResult {
  status: 'paper';
}
