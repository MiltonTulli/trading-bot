// Trading Bot Dashboard Types

export interface BotStatus {
  status: 'running' | 'stopped' | 'paper';
  balance: number;
  equity: number;
  currentPosition?: Position;
  lastUpdated: string;
}

export interface Position {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  quantity: number;
  unrealizedPnL: number;
  entryTime: string;
}

export interface Trade {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryTime: string;
  exitTime: string;
  grossPnL: number;
  netPnL: number;
  returnPercent: number;
  exitReason: string;
  duration: number; // in hours
}

export interface Stats {
  totalPnL: number;
  totalPnLPercent: number;
  winRate: number;
  totalTrades: number;
  currentMonthReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface EquityPoint {
  time: string;
  equity: number;
  drawdown: number;
}

export interface MonthlyReturn {
  month: string;
  year: number;
  return: number;
}

export interface BacktestResult {
  equity: EquityPoint[];
  trades: Trade[];
  stats: Stats;
  period: {
    start: string;
    end: string;
  };
}

export interface TradeMarker {
  time: number;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown';
  text: string;
}