/**
 * News Feed Module
 * Fetches crypto news from free APIs and performs sentiment analysis
 */

class NewsFeed {
    constructor(config) {
        this.cryptoCompareUrl = config.cryptoCompareApiUrl || 'https://min-api.cryptocompare.com';
        this.cacheExpiration = 15 * 60 * 1000; // 15 minutes
        this.newsCache = new Map();
        
        // Keyword-based sentiment analysis
        this.bullishKeywords = [
            'bullish', 'bull', 'surge', 'pump', 'moon', 'rocket', 'skyrocket',
            'adoption', 'institutional', 'investment', 'partnership', 'integration',
            'breakthrough', 'upgrade', 'innovation', 'growth', 'expansion',
            'positive', 'optimistic', 'confident', 'strong', 'rally',
            'breakthrough', 'milestone', 'success', 'approve', 'approval'
        ];

        this.bearishKeywords = [
            'bearish', 'bear', 'crash', 'dump', 'plunge', 'collapse', 'fall',
            'regulation', 'ban', 'restriction', 'crackdown', 'investigation',
            'hack', 'exploit', 'vulnerability', 'scam', 'fraud',
            'negative', 'pessimistic', 'concern', 'worry', 'fear',
            'decline', 'drop', 'loss', 'reject', 'rejection'
        ];
    }

    /**
     * Fetch latest crypto news from CryptoCompare
     */
    async fetchCryptoCompareNews(limit = 50) {
        try {
            const cacheKey = 'cryptocompare_news';
            const cached = this.newsCache.get(cacheKey);
            
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
            
            const data = await response.json();
            
            if (data.Response === 'Error') {
                throw new Error(data.Message);
            }

            const processedNews = data.Data.map(article => ({
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
                lang: article.lang
            }));

            // Cache the processed news
            this.newsCache.set(cacheKey, {
                timestamp: Date.now(),
                data: processedNews
            });

            return processedNews;

        } catch (error) {
            console.error('Error fetching CryptoCompare news:', error);
            return [];
        }
    }

    /**
     * Fetch trending data from CoinGecko (alternative source)
     */
    async fetchCoinGeckoTrending() {
        try {
            const cacheKey = 'coingecko_trending';
            const cached = this.newsCache.get(cacheKey);
            
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
            
            const data = await response.json();

            const processedTrending = {
                coins: data.coins?.map(coin => ({
                    id: coin.item.id,
                    name: coin.item.name,
                    symbol: coin.item.symbol,
                    marketCapRank: coin.item.market_cap_rank,
                    thumb: coin.item.thumb,
                    score: coin.item.score,
                    sentiment: 'bullish' // Trending coins are generally bullish news
                })) || [],
                nfts: data.nfts?.map(nft => ({
                    id: nft.id,
                    name: nft.name,
                    symbol: nft.symbol,
                    thumb: nft.thumb
                })) || [],
                categories: data.categories?.map(cat => ({
                    id: cat.id,
                    name: cat.name,
                    marketCapChange24h: cat.market_cap_1h_change,
                    sentiment: cat.market_cap_1h_change > 0 ? 'bullish' : 'bearish'
                })) || []
            };

            this.newsCache.set(cacheKey, {
                timestamp: Date.now(),
                data: processedTrending
            });

            return processedTrending;

        } catch (error) {
            console.error('Error fetching CoinGecko trending:', error);
            return { coins: [], nfts: [], categories: [] };
        }
    }

    /**
     * Simple keyword-based sentiment analysis
     */
    analyzeSentiment(text) {
        if (!text) return { score: 0, label: 'neutral' };

        const lowerText = text.toLowerCase();
        let bullishScore = 0;
        let bearishScore = 0;

        // Count bullish keywords
        this.bullishKeywords.forEach(keyword => {
            const matches = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
            bullishScore += matches;
        });

        // Count bearish keywords
        this.bearishKeywords.forEach(keyword => {
            const matches = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
            bearishScore += matches;
        });

        // Calculate net sentiment
        const netScore = bullishScore - bearishScore;
        const totalScore = bullishScore + bearishScore;
        
        let label = 'neutral';
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
            totalKeywords: totalScore
        };
    }

    /**
     * Filter news by sentiment
     */
    filterBySentiment(news, sentiment) {
        return news.filter(article => article.sentiment.label === sentiment);
    }

    /**
     * Filter news by keywords or tags
     */
    filterByKeywords(news, keywords) {
        const keywordList = Array.isArray(keywords) ? keywords : [keywords];
        
        return news.filter(article => {
            const textToSearch = `${article.title} ${article.body} ${article.tags.join(' ')}`.toLowerCase();
            return keywordList.some(keyword => textToSearch.includes(keyword.toLowerCase()));
        });
    }

    /**
     * Filter news by time range
     */
    filterByTimeRange(news, hoursBack = 24) {
        const cutoff = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));
        return news.filter(article => article.publishedOn >= cutoff);
    }

    /**
     * Get sentiment summary
     */
    getSentimentSummary(news) {
        const sentimentCounts = {
            very_bullish: 0,
            bullish: 0,
            neutral: 0,
            bearish: 0,
            very_bearish: 0
        };

        news.forEach(article => {
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
                neutral: (sentimentCounts.neutral / total) * 100
            },
            overallSentiment,
            netSentiment: bullishPercentage - bearishPercentage
        };
    }

    /**
     * Get news for specific cryptocurrencies
     */
    async getCryptoSpecificNews(symbols = ['BTC', 'ETH']) {
        try {
            const allNews = await this.fetchCryptoCompareNews(100);
            const cryptoNews = {};

            symbols.forEach(symbol => {
                const keywords = this.getCryptoKeywords(symbol);
                cryptoNews[symbol] = this.filterByKeywords(allNews, keywords);
            });

            return cryptoNews;

        } catch (error) {
            console.error('Error fetching crypto-specific news:', error);
            return {};
        }
    }

    /**
     * Get relevant keywords for crypto symbols
     */
    getCryptoKeywords(symbol) {
        const keywordMap = {
            'BTC': ['bitcoin', 'btc', 'satoshi'],
            'ETH': ['ethereum', 'eth', 'ether', 'vitalik'],
            'ADA': ['cardano', 'ada'],
            'SOL': ['solana', 'sol'],
            'AVAX': ['avalanche', 'avax'],
            'MATIC': ['polygon', 'matic'],
            'DOT': ['polkadot', 'dot'],
            'LINK': ['chainlink', 'link'],
            'UNI': ['uniswap', 'uni'],
            'AAVE': ['aave']
        };

        return keywordMap[symbol] || [symbol.toLowerCase()];
    }

    /**
     * Generate news-based trading signals
     */
    generateNewsSignals(news, symbol) {
        const recentNews = this.filterByTimeRange(news, 4); // Last 4 hours
        const sentimentSummary = this.getSentimentSummary(recentNews);

        if (recentNews.length === 0) {
            return null;
        }

        let signal = null;
        const confidence = Math.min(recentNews.length * 5, 50); // Max 50% confidence from news alone

        // Strong bullish news signal
        if (sentimentSummary.overallSentiment === 'bullish' && sentimentSummary.netSentiment > 50) {
            signal = {
                type: 'news',
                direction: 'bullish',
                strength: sentimentSummary.netSentiment,
                confidence,
                reasoning: `Strong bullish sentiment in recent news (${sentimentSummary.percentages.bullish.toFixed(1)}% positive)`
            };
        }
        // Strong bearish news signal
        else if (sentimentSummary.overallSentiment === 'bearish' && sentimentSummary.netSentiment < -50) {
            signal = {
                type: 'news',
                direction: 'bearish',
                strength: Math.abs(sentimentSummary.netSentiment),
                confidence,
                reasoning: `Strong bearish sentiment in recent news (${sentimentSummary.percentages.bearish.toFixed(1)}% negative)`
            };
        }

        if (signal) {
            signal.newsCount = recentNews.length;
            signal.sentiment = sentimentSummary;
            signal.timestamp = new Date();
        }

        return signal;
    }

    /**
     * Check if cached data is still valid
     */
    isCacheValid(timestamp) {
        return Date.now() - timestamp < this.cacheExpiration;
    }

    /**
     * Get comprehensive news analysis
     */
    async getNewsAnalysis(symbols = ['BTC', 'ETH']) {
        try {
            const [generalNews, cryptoNews, trending] = await Promise.all([
                this.fetchCryptoCompareNews(50),
                this.getCryptoSpecificNews(symbols),
                this.fetchCoinGeckoTrending()
            ]);

            const analysis = {
                timestamp: new Date(),
                general: {
                    news: generalNews,
                    sentiment: this.getSentimentSummary(generalNews),
                    recent: this.filterByTimeRange(generalNews, 6)
                },
                specific: {},
                trending: trending,
                signals: {}
            };

            // Analyze each symbol
            symbols.forEach(symbol => {
                if (cryptoNews[symbol]) {
                    analysis.specific[symbol] = {
                        news: cryptoNews[symbol],
                        sentiment: this.getSentimentSummary(cryptoNews[symbol]),
                        recent: this.filterByTimeRange(cryptoNews[symbol], 6)
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

    /**
     * Clear cache
     */
    clearCache() {
        this.newsCache.clear();
        console.log('News cache cleared');
    }
}

export default NewsFeed;