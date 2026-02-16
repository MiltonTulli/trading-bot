/**
 * News Feed Module
 * Fetches crypto news from free APIs and performs sentiment analysis
 */

import type {
  NewsFeedConfig,
  NewsArticle,
  SentimentResult,
  SentimentSummary,
  TrendingData,
  TrendingCoin,
  TrendingNFT,
  TrendingCategory,
  NewsSignal,
  NewsAnalysis,
} from '../types.ts';

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

class NewsFeed {
  private cryptoCompareUrl: string;
  private cacheExpiration: number;
  private newsCache: Map<string, CacheEntry<unknown>>;
  private bullishKeywords: string[];
  private bearishKeywords: string[];

  constructor(config: NewsFeedConfig) {
    this.cryptoCompareUrl = config.cryptoCompareApiUrl || 'https://min-api.cryptocompare.com';
    this.cacheExpiration = 15 * 60 * 1000;
    this.newsCache = new Map();

    this.bullishKeywords = [
      'bullish', 'bull', 'surge', 'pump', 'moon', 'rocket', 'skyrocket',
      'adoption', 'institutional', 'investment', 'partnership', 'integration',
      'breakthrough', 'upgrade', 'innovation', 'growth', 'expansion',
      'positive', 'optimistic', 'confident', 'strong', 'rally',
      'breakthrough', 'milestone', 'success', 'approve', 'approval',
    ];

    this.bearishKeywords = [
      'bearish', 'bear', 'crash', 'dump', 'plunge', 'collapse', 'fall',
      'regulation', 'ban', 'restriction', 'crackdown', 'investigation',
      'hack', 'exploit', 'vulnerability', 'scam', 'fraud',
      'negative', 'pessimistic', 'concern', 'worry', 'fear',
      'decline', 'drop', 'loss', 'reject', 'rejection',
    ];
  }

  async fetchCryptoCompareNews(limit: number = 50): Promise<NewsArticle[]> {
    try {
      const cacheKey = 'cryptocompare_news';
      const cached = this.newsCache.get(cacheKey) as CacheEntry<NewsArticle[]> | undefined;

      if (cached && this.isCacheValid(cached.timestamp)) {
        console.log('Using cached CryptoCompare news');
        return cached.data;
      }

      console.log('Fetching fresh CryptoCompare news...');
      const url = `${this.cryptoCompareUrl}/data/v2/news/?lang=EN&sortOrder=latest&limit=${limit}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as {
        Response?: string;
        Message?: string;
        Data: Array<{
          id: string;
          title: string;
          body: string;
          url: string;
          source: string;
          tags: string;
          published_on: number;
          imageurl: string;
          categories: string;
          lang: string;
        }>;
      };

      if (data.Response === 'Error') {
        throw new Error(data.Message);
      }

      const processedNews: NewsArticle[] = data.Data.map((article) => ({
        id: article.id,
        title: article.title,
        body: article.body,
        url: article.url,
        source: article.source,
        tags: article.tags ? article.tags.split('|') : [],
        publishedOn: new Date(article.published_on * 1000),
        imageUrl: article.imageurl,
        sentiment: this.analyzeSentiment(article.title + ' ' + article.body),
        categories: article.categories ? article.categories.split('|') : [],
        lang: article.lang,
      }));

      this.newsCache.set(cacheKey, { timestamp: Date.now(), data: processedNews });
      return processedNews;
    } catch (error) {
      console.error('Error fetching CryptoCompare news:', error);
      return [];
    }
  }

  async fetchCoinGeckoTrending(): Promise<TrendingData> {
    try {
      const cacheKey = 'coingecko_trending';
      const cached = this.newsCache.get(cacheKey) as CacheEntry<TrendingData> | undefined;

      if (cached && this.isCacheValid(cached.timestamp)) {
        console.log('Using cached CoinGecko trending data');
        return cached.data;
      }

      console.log('Fetching CoinGecko trending data...');
      const url = 'https://api.coingecko.com/api/v3/search/trending';

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as {
        coins?: Array<{ item: { id: string; name: string; symbol: string; market_cap_rank: number; thumb: string; score: number } }>;
        nfts?: Array<{ id: string; name: string; symbol: string; thumb: string }>;
        categories?: Array<{ id: string; name: string; market_cap_1h_change: number }>;
      };

      const processedTrending: TrendingData = {
        coins: data.coins?.map((coin): TrendingCoin => ({
          id: coin.item.id,
          name: coin.item.name,
          symbol: coin.item.symbol,
          marketCapRank: coin.item.market_cap_rank,
          thumb: coin.item.thumb,
          score: coin.item.score,
          sentiment: 'bullish',
        })) || [],
        nfts: data.nfts?.map((nft): TrendingNFT => ({
          id: nft.id,
          name: nft.name,
          symbol: nft.symbol,
          thumb: nft.thumb,
        })) || [],
        categories: data.categories?.map((cat): TrendingCategory => ({
          id: cat.id,
          name: cat.name,
          marketCapChange24h: cat.market_cap_1h_change,
          sentiment: cat.market_cap_1h_change > 0 ? 'bullish' : 'bearish',
        })) || [],
      };

      this.newsCache.set(cacheKey, { timestamp: Date.now(), data: processedTrending });
      return processedTrending;
    } catch (error) {
      console.error('Error fetching CoinGecko trending:', error);
      return { coins: [], nfts: [], categories: [] };
    }
  }

  analyzeSentiment(text: string): SentimentResult {
    if (!text) return { score: 0, label: 'neutral', confidence: 0, bullishCount: 0, bearishCount: 0, totalKeywords: 0 };

    const lowerText = text.toLowerCase();
    let bullishScore = 0;
    let bearishScore = 0;

    this.bullishKeywords.forEach((keyword) => {
      const matches = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
      bullishScore += matches;
    });

    this.bearishKeywords.forEach((keyword) => {
      const matches = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
      bearishScore += matches;
    });

    const netScore = bullishScore - bearishScore;
    const totalScore = bullishScore + bearishScore;

    let label: SentimentResult['label'] = 'neutral';
    let confidence = 0;

    if (totalScore > 0) {
      confidence = Math.abs(netScore) / totalScore;

      if (netScore > 0) {
        label = confidence > 0.6 ? 'very_bullish' : 'bullish';
      } else if (netScore < 0) {
        label = confidence > 0.6 ? 'very_bearish' : 'bearish';
      }
    }

    return {
      score: netScore,
      label,
      confidence,
      bullishCount: bullishScore,
      bearishCount: bearishScore,
      totalKeywords: totalScore,
    };
  }

  filterBySentiment(news: NewsArticle[], sentiment: string): NewsArticle[] {
    return news.filter((article) => article.sentiment.label === sentiment);
  }

  filterByKeywords(news: NewsArticle[], keywords: string | string[]): NewsArticle[] {
    const keywordList = Array.isArray(keywords) ? keywords : [keywords];

    return news.filter((article) => {
      const textToSearch = `${article.title} ${article.body} ${article.tags.join(' ')}`.toLowerCase();
      return keywordList.some((keyword) => textToSearch.includes(keyword.toLowerCase()));
    });
  }

  filterByTimeRange(news: NewsArticle[], hoursBack: number = 24): NewsArticle[] {
    const cutoff = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));
    return news.filter((article) => article.publishedOn >= cutoff);
  }

  getSentimentSummary(news: NewsArticle[]): SentimentSummary {
    const sentimentCounts: Record<string, number> = {
      very_bullish: 0,
      bullish: 0,
      neutral: 0,
      bearish: 0,
      very_bearish: 0,
    };

    news.forEach((article) => {
      sentimentCounts[article.sentiment.label]++;
    });

    const total = news.length;
    const bullishTotal = sentimentCounts.very_bullish + sentimentCounts.bullish;
    const bearishTotal = sentimentCounts.very_bearish + sentimentCounts.bearish;

    let overallSentiment = 'neutral';
    const bullishPercentage = (bullishTotal / total) * 100;
    const bearishPercentage = (bearishTotal / total) * 100;

    if (bullishPercentage > bearishPercentage + 20) {
      overallSentiment = 'bullish';
    } else if (bearishPercentage > bullishPercentage + 20) {
      overallSentiment = 'bearish';
    }

    return {
      total,
      sentimentCounts,
      percentages: {
        bullish: bullishPercentage,
        bearish: bearishPercentage,
        neutral: (sentimentCounts.neutral / total) * 100,
      },
      overallSentiment,
      netSentiment: bullishPercentage - bearishPercentage,
    };
  }

  async getCryptoSpecificNews(symbols: string[] = ['BTC', 'ETH']): Promise<Record<string, NewsArticle[]>> {
    try {
      const allNews = await this.fetchCryptoCompareNews(100);
      const cryptoNews: Record<string, NewsArticle[]> = {};

      symbols.forEach((symbol) => {
        const keywords = this.getCryptoKeywords(symbol);
        cryptoNews[symbol] = this.filterByKeywords(allNews, keywords);
      });

      return cryptoNews;
    } catch (error) {
      console.error('Error fetching crypto-specific news:', error);
      return {};
    }
  }

  getCryptoKeywords(symbol: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'BTC': ['bitcoin', 'btc', 'satoshi'],
      'ETH': ['ethereum', 'eth', 'ether', 'vitalik'],
      'ADA': ['cardano', 'ada'],
      'SOL': ['solana', 'sol'],
      'AVAX': ['avalanche', 'avax'],
      'MATIC': ['polygon', 'matic'],
      'DOT': ['polkadot', 'dot'],
      'LINK': ['chainlink', 'link'],
      'UNI': ['uniswap', 'uni'],
      'AAVE': ['aave'],
    };

    return keywordMap[symbol] || [symbol.toLowerCase()];
  }

  generateNewsSignals(news: NewsArticle[], _symbol: string): NewsSignal | null {
    const recentNews = this.filterByTimeRange(news, 4);
    const sentimentSummary = this.getSentimentSummary(recentNews);

    if (recentNews.length === 0) {
      return null;
    }

    let signal: NewsSignal | null = null;
    const confidence = Math.min(recentNews.length * 5, 50);

    if (sentimentSummary.overallSentiment === 'bullish' && sentimentSummary.netSentiment > 50) {
      signal = {
        type: 'news',
        direction: 'bullish',
        strength: sentimentSummary.netSentiment,
        confidence,
        reasoning: `Strong bullish sentiment in recent news (${sentimentSummary.percentages.bullish.toFixed(1)}% positive)`,
      };
    } else if (sentimentSummary.overallSentiment === 'bearish' && sentimentSummary.netSentiment < -50) {
      signal = {
        type: 'news',
        direction: 'bearish',
        strength: Math.abs(sentimentSummary.netSentiment),
        confidence,
        reasoning: `Strong bearish sentiment in recent news (${sentimentSummary.percentages.bearish.toFixed(1)}% negative)`,
      };
    }

    if (signal) {
      signal.newsCount = recentNews.length;
      signal.sentiment = sentimentSummary;
      signal.timestamp = new Date();
    }

    return signal;
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheExpiration;
  }

  async getNewsAnalysis(symbols: string[] = ['BTC', 'ETH']): Promise<NewsAnalysis | null> {
    try {
      const [generalNews, cryptoNews, trending] = await Promise.all([
        this.fetchCryptoCompareNews(50),
        this.getCryptoSpecificNews(symbols),
        this.fetchCoinGeckoTrending(),
      ]);

      const analysis: NewsAnalysis = {
        timestamp: new Date(),
        general: {
          news: generalNews,
          sentiment: this.getSentimentSummary(generalNews),
          recent: this.filterByTimeRange(generalNews, 6),
        },
        specific: {},
        trending,
        signals: {},
      };

      symbols.forEach((symbol) => {
        if (cryptoNews[symbol]) {
          analysis.specific[symbol] = {
            news: cryptoNews[symbol],
            sentiment: this.getSentimentSummary(cryptoNews[symbol]),
            recent: this.filterByTimeRange(cryptoNews[symbol], 6),
          };

          analysis.signals[symbol] = this.generateNewsSignals(cryptoNews[symbol], symbol);
        }
      });

      return analysis;
    } catch (error) {
      console.error('Error in news analysis:', error);
      return null;
    }
  }

  clearCache(): void {
    this.newsCache.clear();
    console.log('News cache cleared');
  }
}

export default NewsFeed;
