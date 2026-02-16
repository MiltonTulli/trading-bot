import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA, 'breakout-state.json');
const TRADES_FILE = path.join(DATA, 'breakout-trades.json');
const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

const PARAMS = { lookback: 10, volMult: 2, sl: 0.03, tp: 0.06, posSize: 0.2, leverage: 5 };
const FEE_PAPER = 0.001;   // 0.1% taker
const FEE_LIVE = 0.0004;   // 0.04% with BNB discount on futures

// ============ CONFIG ============
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}

function isLiveMode() {
  const cfg = loadConfig();
  return cfg.mode === 'live' && cfg.binanceApiKey && cfg.binanceApiSecret;
}

// ============ STATE ============
function loadState() {
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function appendTrade(trade) {
  let trades = [];
  try { trades = JSON.parse(fs.readFileSync(TRADES_FILE, 'utf8')); } catch {}
  trades.push(trade);
  fs.writeFileSync(TRADES_FILE, JSON.stringify(trades, null, 2));
}

// ============ BINANCE API ============
async function fetchCandles(symbol = 'BTCUSDT', interval = '4h', limit = 50) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.map(k => ({
    t: k[0],
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
    v: parseFloat(k[5]),
  }));
}

function binanceSign(params, secret) {
  const qs = Object.entries(params).map(([k,v]) => `${k}=${v}`).join('&');
  const sig = crypto.createHmac('sha256', secret).update(qs).digest('hex');
  return `${qs}&signature=${sig}`;
}

async function binanceFuturesRequest(method, endpoint, params = {}, cfg) {
  const baseUrl = 'https://fapi.binance.com';
  params.timestamp = Date.now();
  params.recvWindow = 5000;
  const signed = binanceSign(params, cfg.binanceApiSecret);
  
  const url = method === 'GET' 
    ? `${baseUrl}${endpoint}?${signed}`
    : `${baseUrl}${endpoint}`;
  
  const opts = {
    method,
    headers: {
      'X-MBX-APIKEY': cfg.binanceApiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };
  if (method === 'POST') opts.body = signed;
  
  const res = await fetch(url, opts);
  const data = await res.json();
  if (data.code && data.code < 0) throw new Error(`Binance error ${data.code}: ${data.msg}`);
  return data;
}

// ============ LIVE TRADING ============
async function setLeverage(symbol, leverage, cfg) {
  return binanceFuturesRequest('POST', '/fapi/v1/leverage', { symbol, leverage }, cfg);
}

async function openPosition(symbol, side, quantity, cfg) {
  return binanceFuturesRequest('POST', '/fapi/v1/order', {
    symbol,
    side: side === 1 ? 'BUY' : 'SELL',
    type: 'MARKET',
    quantity: quantity.toFixed(3),
  }, cfg);
}

async function closePosition(symbol, side, quantity, cfg) {
  return binanceFuturesRequest('POST', '/fapi/v1/order', {
    symbol,
    side: side === 1 ? 'SELL' : 'BUY', // opposite to close
    type: 'MARKET',
    quantity: quantity.toFixed(3),
    reduceOnly: 'true',
  }, cfg);
}

async function getAccountBalance(cfg) {
  const data = await binanceFuturesRequest('GET', '/fapi/v2/balance', {}, cfg);
  const usdt = data.find(a => a.asset === 'USDT');
  return usdt ? parseFloat(usdt.balance) : 0;
}

async function getPositions(cfg) {
  const data = await binanceFuturesRequest('GET', '/fapi/v2/positionRisk', { symbol: 'BTCUSDT' }, cfg);
  return data.filter(p => parseFloat(p.positionAmt) !== 0);
}

// ============ MAIN ENGINE ============
export async function runBreakoutEngine() {
  const candles = await fetchCandles();
  const state = loadState();
  const cfg = loadConfig();
  const live = isLiveMode();
  const fee = live ? FEE_LIVE : FEE_PAPER;
  const { lookback, volMult, sl, tp, posSize, leverage } = PARAMS;
  const currentPrice = candles[candles.length - 1].c;
  const now = new Date().toISOString();

  let action = 'HOLD';
  let liveOrderResult = null;

  // Check open position
  if (state.position) {
    const pos = state.position;
    const move = pos.side === 1
      ? (currentPrice - pos.entry) / pos.entry
      : (pos.entry - currentPrice) / pos.entry;

    let closed = false;
    let pnl = 0;
    let reason = '';

    if (move <= -sl) {
      pnl = -sl * pos.size * leverage - pos.size * fee;
      reason = 'SL';
      closed = true;
    } else if (move >= tp) {
      pnl = tp * pos.size * leverage - pos.size * fee;
      reason = 'TP';
      closed = true;
    }

    if (closed) {
      // Execute live close
      if (live && pos.liveQty) {
        try {
          liveOrderResult = await closePosition('BTCUSDT', pos.side, pos.liveQty, cfg);
          action = `${reason}_HIT_LIVE (${pos.side === 1 ? 'LONG' : 'SHORT'})`;
        } catch (e) {
          action = `${reason}_HIT_LIVE_ERROR: ${e.message}`;
          // Still update paper state
        }
      } else {
        action = `${reason}_HIT (${pos.side === 1 ? 'LONG' : 'SHORT'})`;
      }

      state.balance += pnl;
      const trade = {
        side: pos.side === 1 ? 'LONG' : 'SHORT',
        entry: pos.entry,
        exit: currentPrice,
        pnl: Math.round(pnl * 100) / 100,
        openedAt: pos.openedAt,
        closedAt: now,
        reason,
        mode: live ? 'LIVE' : 'PAPER',
        liveOrder: liveOrderResult || null,
      };
      state.trades.push(trade);
      appendTrade(trade);
      if (pnl > 0) state.stats.wins++;
      else state.stats.losses++;
      state.stats.totalPnL = Math.round((state.stats.totalPnL + pnl) * 100) / 100;
      state.position = null;
    }
  }

  // Check for new signal if no position
  if (!state.position && candles.length > lookback + 1) {
    const i = candles.length - 1;
    let hi = -Infinity, lo = Infinity, avgVol = 0;
    for (let j = i - lookback; j < i; j++) {
      if (candles[j].h > hi) hi = candles[j].h;
      if (candles[j].l < lo) lo = candles[j].l;
      avgVol += candles[j].v;
    }
    avgVol /= lookback;

    const volOk = candles[i].v >= avgVol * volMult;
    let signal = 0;

    if (volOk && candles[i].c > hi) signal = 1;   // LONG breakout
    if (volOk && candles[i].c < lo) signal = -1;   // SHORT breakdown

    if (signal !== 0) {
      const size = state.balance * posSize;
      const entryFee = size * fee;

      if (live) {
        try {
          // Set leverage first
          await setLeverage('BTCUSDT', leverage, cfg);
          // Calculate quantity in BTC
          const qty = (size * leverage) / currentPrice;
          liveOrderResult = await openPosition('BTCUSDT', signal, qty, cfg);
          state.balance -= entryFee;
          state.position = {
            side: signal,
            entry: currentPrice,
            size,
            openedAt: now,
            mode: 'LIVE',
            liveQty: qty,
            liveOrder: liveOrderResult,
          };
          action = `OPEN_${signal === 1 ? 'LONG' : 'SHORT'}_LIVE`;
        } catch (e) {
          action = `SIGNAL_${signal === 1 ? 'LONG' : 'SHORT'}_LIVE_ERROR: ${e.message}`;
        }
      } else {
        state.balance -= entryFee;
        state.position = {
          side: signal,
          entry: currentPrice,
          size,
          openedAt: now,
          mode: 'PAPER',
        };
        action = `OPEN_${signal === 1 ? 'LONG' : 'SHORT'}`;
      }
    }
  }

  state.balance = Math.round(state.balance * 100) / 100;
  state.lastRun = now;
  state.lastPrice = currentPrice;
  state.mode = live ? 'LIVE' : 'PAPER';
  saveState(state);

  return {
    time: now,
    price: currentPrice,
    action,
    balance: state.balance,
    position: state.position ? `${state.position.side === 1 ? 'LONG' : 'SHORT'} @ ${state.position.entry}` : 'NONE',
    stats: state.stats,
    mode: live ? 'LIVE' : 'PAPER',
    liveOrder: liveOrderResult,
  };
}

// ============ UTILITY: Go live ============
export async function goLive(apiKey, apiSecret) {
  const cfg = loadConfig();
  cfg.mode = 'live';
  cfg.binanceApiKey = apiKey;
  cfg.binanceApiSecret = apiSecret;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  
  // Verify connection
  const testCfg = { ...cfg, binanceApiKey: apiKey, binanceApiSecret: apiSecret };
  const balance = await getAccountBalance(testCfg);
  return { status: 'live', usdtBalance: balance };
}

export async function goPaper() {
  const cfg = loadConfig();
  cfg.mode = 'paper';
  delete cfg.binanceApiKey;
  delete cfg.binanceApiSecret;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  return { status: 'paper' };
}
