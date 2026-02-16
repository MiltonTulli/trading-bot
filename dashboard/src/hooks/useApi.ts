import { useState, useEffect, useCallback } from 'react';
import type { BotStatus, Trade, Stats, CandleData, EquityPoint, MonthlyReturn, BacktestResult } from '../types';

const API_BASE = '';

class ApiClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async getStatus(): Promise<BotStatus> {
    return this.request<BotStatus>('/api/status');
  }

  async startBot(mode: 'paper' | 'live' = 'paper'): Promise<void> {
    return this.request<void>('/api/bot/start', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  }

  async stopBot(): Promise<void> {
    return this.request<void>('/api/bot/stop', {
      method: 'POST',
    });
  }

  async getTrades(): Promise<Trade[]> {
    return this.request<Trade[]>('/api/trades');
  }

  async getOpenPosition(): Promise<any> {
    return this.request<any>('/api/trades/open');
  }

  async getCandles(): Promise<CandleData[]> {
    return this.request<CandleData[]>('/api/candles');
  }

  async getStats(): Promise<Stats> {
    return this.request<Stats>('/api/stats');
  }

  async getEquity(): Promise<EquityPoint[]> {
    return this.request<EquityPoint[]>('/api/equity');
  }

  async getMonthly(): Promise<MonthlyReturn[]> {
    return this.request<MonthlyReturn[]>('/api/monthly');
  }

  async runBacktest(): Promise<BacktestResult> {
    return this.request<BacktestResult>('/api/backtest');
  }
}

const api = new ApiClient();

// Custom hooks
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
  refreshInterval?: number
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('API Error:', err);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (refreshInterval) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval]);

  return { data, loading, error, refetch: fetchData };
}

export function useBotStatus() {
  return useApi(() => api.getStatus(), [], 30000); // Refresh every 30 seconds
}

export function useTrades() {
  return useApi(() => api.getTrades(), [], 60000); // Refresh every minute
}

export function useStats() {
  return useApi(() => api.getStats(), [], 30000);
}

export function useCandles() {
  return useApi(() => api.getCandles(), [], 300000); // Refresh every 5 minutes
}

export function useEquity() {
  return useApi(() => api.getEquity(), []);
}

export function useMonthlyReturns() {
  return useApi(() => api.getMonthly(), []);
}

export function useBotControls() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startBot = async (mode: 'paper' | 'live' = 'paper') => {
    try {
      setLoading(true);
      setError(null);
      await api.startBot(mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start bot');
    } finally {
      setLoading(false);
    }
  };

  const stopBot = async () => {
    try {
      setLoading(true);
      setError(null);
      await api.stopBot();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop bot');
    } finally {
      setLoading(false);
    }
  };

  return { startBot, stopBot, loading, error };
}

export function useBacktest() {
  const [data, setData] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runBacktest = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.runBacktest();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run backtest');
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, runBacktest };
}