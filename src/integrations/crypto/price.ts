import axios from 'axios';

export interface CoinCapAsset {
  id: string;
  rank: string;
  symbol: string;
  name: string;
  priceUsd: string;
  changePercent24Hr: string;
}

export interface CoinCapResponse {
  data: CoinCapAsset[];
  timestamp: number;
}

// Cache interface for storing price data
interface PriceCache {
  price: number;
  timestamp: number;
}

export class CryptoPrice {
  // API base URLs
  private apiBaseUrl = 'https://api.coincap.io/v2';
  private blockchainInfoUrl = 'https://blockchain.info';
  
  // Tracking API calls for rate limiting
  private lastApiCall: Record<string, number> = {};
  private minDelayBetweenCalls = 1000; // 1 second minimum between calls to same API
  
  // Price cache with 15 second expiry
  private priceCache: Record<string, PriceCache> = {};
  private cacheDuration = 15000; // 15 seconds
  
  // Check if a price is cached and valid
  private isCacheValid(cacheKey: string): boolean {
    const cached = this.priceCache[cacheKey];
    if (!cached) return false;
    
    const now = Date.now();
    return (now - cached.timestamp) < this.cacheDuration;
  }
  
  // Get cached price or null if not found/expired
  private getCachedPrice(cacheKey: string): number | null {
    if (this.isCacheValid(cacheKey)) {
      console.log(`[CryptoPrice] Using cached price for ${cacheKey}`);
      return this.priceCache[cacheKey].price;
    }
    return null;
  }
  
  // Store price in cache
  private cachePrice(cacheKey: string, price: number): void {
    this.priceCache[cacheKey] = {
      price,
      timestamp: Date.now()
    };
  }
  
  // Fetch price from CoinCap with retry logic
  async getFromCoinCap(assetId: string, retryCount = 0): Promise<number | null> {
    const apiKey = 'coincap';
    const cacheKey = `coincap:${assetId}`;
    
    // Check cache first
    const cachedPrice = this.getCachedPrice(cacheKey);
    if (cachedPrice !== null) return cachedPrice;
    
    // Check if we need to wait before calling API again
    await this.respectRateLimit(apiKey);
    
    try {
      console.log(`[CryptoPrice] Fetching from CoinCap: ${assetId}`);
      const response = await axios.get(
        `${this.apiBaseUrl}/assets/${assetId}`,
        { 
          timeout: 5000,
          headers: {
            'Accept': 'application/json'
          }
        }
      );
      
      if (response.data?.data?.priceUsd) {
        const price = parseFloat(response.data.data.priceUsd);
        console.log(`[CryptoPrice] CoinCap price for ${assetId}: $${price}`);
        // Cache the price
        this.cachePrice(cacheKey, price);
        return price;
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 429 && retryCount < 3) {
        // Rate limit hit - back off and retry
        const backoffTime = Math.pow(2, retryCount) * 1000;
        console.warn(`[CryptoPrice] Rate limit hit, backing off for ${backoffTime}ms before retry ${retryCount + 1}/3`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return this.getFromCoinCap(assetId, retryCount + 1);
      }
      console.error(`[CryptoPrice] CoinCap error for ${assetId}:`, 
        axios.isAxiosError(error) && error.response?.status 
          ? `Status: ${error.response.status}` 
          : error instanceof Error ? error.message : error);
    }
    return null;
  }

  // Fetch price from Blockchain.info (for Bitcoin)
  async getFromBlockchainInfo(retryCount = 0): Promise<number | null> {
    const apiKey = 'blockchain.info';
    const cacheKey = 'blockchain.info:bitcoin';
    
    // Check cache first
    const cachedPrice = this.getCachedPrice(cacheKey);
    if (cachedPrice !== null) return cachedPrice;
    
    // Check if we need to wait before calling API again
    await this.respectRateLimit(apiKey);
    
    try {
      console.log(`[CryptoPrice] Fetching Bitcoin price from Blockchain.info`);
      const response = await axios.get(
        `${this.blockchainInfoUrl}/ticker`,
        { timeout: 5000 }
      );
      
      if (response.data?.USD?.last) {
        const price = response.data.USD.last;
        console.log(`[CryptoPrice] Blockchain.info price for Bitcoin: $${price}`);
        // Cache the price
        this.cachePrice(cacheKey, price);
        return price;
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 429 && retryCount < 3) {
        // Rate limit hit - back off and retry
        const backoffTime = Math.pow(2, retryCount) * 1000;
        console.warn(`[CryptoPrice] Rate limit hit, backing off for ${backoffTime}ms before retry ${retryCount + 1}/3`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return this.getFromBlockchainInfo(retryCount + 1);
      }
      console.error(`[CryptoPrice] Blockchain.info error:`, 
        axios.isAxiosError(error) && error.response?.status 
          ? `Status: ${error.response.status}` 
          : error instanceof Error ? error.message : error);
    }
    return null;
  }

  // Helper to respect rate limits
  private async respectRateLimit(apiKey: string): Promise<void> {
    const now = Date.now();
    const lastCall = this.lastApiCall[apiKey] || 0;
    const timeSinceLastCall = now - lastCall;
    
    if (timeSinceLastCall < this.minDelayBetweenCalls) {
      const delayNeeded = this.minDelayBetweenCalls - timeSinceLastCall;
      console.log(`[CryptoPrice] Rate limiting: waiting ${delayNeeded}ms before calling ${apiKey} API`);
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }
    
    // Update last call time
    this.lastApiCall[apiKey] = Date.now();
  }

  // Fetch price from CoinGecko
  async getFromCoinGecko(assetId: string, retryCount = 0): Promise<number | null> {
    const apiKey = 'coingecko';
    const cacheKey = `coingecko:${assetId}`;
    
    // Check cache first
    const cachedPrice = this.getCachedPrice(cacheKey);
    if (cachedPrice !== null) return cachedPrice;
    
    // Check if we need to wait before calling API again
    await this.respectRateLimit(apiKey);
    
    try {
      console.log(`[CryptoPrice] Fetching from CoinGecko: ${assetId}`);
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${assetId}&vs_currencies=usd`,
        { timeout: 5000 }
      );
      
      if (response.data && response.data[assetId] && response.data[assetId].usd) {
        const price = response.data[assetId].usd;
        console.log(`[CryptoPrice] CoinGecko price for ${assetId}: $${price}`);
        // Cache the price
        this.cachePrice(cacheKey, price);
        return price;
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 429 && retryCount < 3) {
        // Rate limit hit - back off and retry
        const backoffTime = Math.pow(2, retryCount) * 1000;
        console.warn(`[CryptoPrice] Rate limit hit, backing off for ${backoffTime}ms before retry ${retryCount + 1}/3`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return this.getFromCoinGecko(assetId, retryCount + 1);
      }
      console.error(`[CryptoPrice] CoinGecko error for ${assetId}:`, 
        axios.isAxiosError(error) && error.response?.status 
          ? `Status: ${error.response.status}` 
          : error instanceof Error ? error.message : error);
    }
    return null;
  }

  // Fetch price from Binance (only for major tokens)
  async getFromBinance(symbol: string, retryCount = 0): Promise<number | null> {
    const apiKey = 'binance';
    const cacheKey = `binance:${symbol}`;
    
    // Check cache first
    const cachedPrice = this.getCachedPrice(cacheKey);
    if (cachedPrice !== null) return cachedPrice;
    
    // Check if we need to wait before calling API again
    await this.respectRateLimit(apiKey);
    
    try {
      const marketSymbol = `${symbol.toUpperCase()}USDT`;
      console.log(`[CryptoPrice] Fetching from Binance: ${marketSymbol}`);
      
      const response = await axios.get(
        `https://api.binance.com/api/v3/ticker/price?symbol=${marketSymbol}`,
        { timeout: 5000 }
      );
      
      if (response.data?.price) {
        const price = parseFloat(response.data.price);
        console.log(`[CryptoPrice] Binance price for ${symbol}: $${price}`);
        // Cache the price
        this.cachePrice(cacheKey, price);
        return price;
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 429 && retryCount < 3) {
        // Rate limit hit - back off and retry
        const backoffTime = Math.pow(2, retryCount) * 1000;
        console.warn(`[CryptoPrice] Rate limit hit, backing off for ${backoffTime}ms before retry ${retryCount + 1}/3`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return this.getFromBinance(symbol, retryCount + 1);
      }
      console.error(`[CryptoPrice] Binance error for ${symbol}:`, 
        axios.isAxiosError(error) && error.response?.status 
          ? `Status: ${error.response.status}` 
          : error instanceof Error ? error.message : error);
    }
    return null;
  }

  // Force refresh prices by clearing cache
  clearCache(): void {
    console.log('[CryptoPrice] Clearing price cache');
    this.priceCache = {};
  }

  // Get asset price by ID with caching
  async getAssetPrice(assetId: string): Promise<number> {
    console.log(`[CryptoPrice] Getting price for asset: ${assetId}`);
    
    // Check if we have this price cached already
    const cacheKey = `asset:${assetId}`;
    const cachedPrice = this.getCachedPrice(cacheKey);
    if (cachedPrice !== null) return cachedPrice;
    
    // Special case for Bitcoin - use Blockchain.info if available
    if (assetId === 'bitcoin') {
      const btcPrice = await this.getFromBlockchainInfo();
      if (btcPrice !== null) {
        this.cachePrice(cacheKey, btcPrice);
        return btcPrice;
      }
    }
    
    // Map common asset IDs to their equivalents across different APIs
    const coinGeckoId = assetId;
    const binanceSymbol = {
      'bitcoin': 'btc',
      'ethereum': 'eth',
      'solana': 'sol',
      'cardano': 'ada',
      'polygon': 'matic',
      'polkadot': 'dot',
      'avalanche-2': 'avax'
    }[assetId] || '';
    
    // Try multiple sources with built-in fallbacks
    const price = await this.getPrice(assetId, coinGeckoId, binanceSymbol);
    
    if (price === 0) {
      console.warn(`[CryptoPrice] Could not get price for ${assetId} from any source`);
    } else {
      // Cache the successful price lookup
      this.cachePrice(cacheKey, price);
    }
    
    return price;
  }

  // Get price with multiple fallbacks
  async getPrice(coinCapId: string, coinGeckoId: string, binanceSymbol: string): Promise<number> {
    console.log(`[CryptoPrice] Getting price for ${coinCapId} with fallbacks`);
    
    // Special case for Bitcoin
    if (coinCapId === 'bitcoin') {
      const btcPrice = await this.getFromBlockchainInfo();
      if (btcPrice !== null) return btcPrice;
    }
    
    // Try CoinCap first
    const coincapPrice = await this.getFromCoinCap(coinCapId);
    if (coincapPrice !== null) return coincapPrice;
    
    // Try CoinGecko second
    const coingeckoPrice = await this.getFromCoinGecko(coinGeckoId);
    if (coingeckoPrice !== null) return coingeckoPrice;
    
    // Try Binance third (where applicable)
    if (binanceSymbol) {
      const binancePrice = await this.getFromBinance(binanceSymbol);
      if (binancePrice !== null) return binancePrice;
    }
    
    // All sources failed
    console.error(`[CryptoPrice] All price sources failed for ${coinCapId}`);
    return 0;
  }
  
  // Specific asset methods
  async getBitcoinPrice(): Promise<number> {
    // Check cache first
    const cacheKey = 'asset:bitcoin';
    const cachedPrice = this.getCachedPrice(cacheKey);
    if (cachedPrice !== null) return cachedPrice;
    
    // Try Blockchain.info first for Bitcoin price
    const btcPrice = await this.getFromBlockchainInfo();
    if (btcPrice !== null) {
      this.cachePrice(cacheKey, btcPrice);
      return btcPrice;
    }
    
    // Fall back to other sources if needed
    const price = await this.getPrice('bitcoin', 'bitcoin', 'btc');
    if (price > 0) {
      this.cachePrice(cacheKey, price);
    }
    return price;
  }
  
  async getEthereumPrice(): Promise<number> {
    // Check cache first
    const cacheKey = 'asset:ethereum';
    const cachedPrice = this.getCachedPrice(cacheKey);
    if (cachedPrice !== null) return cachedPrice;
    
    // Get price from sources
    const price = await this.getPrice('ethereum', 'ethereum', 'eth');
    if (price > 0) {
      this.cachePrice(cacheKey, price);
    }
    return price;
  }
  
  async getSolanaPrice(): Promise<number> {
    // Check cache first
    const cacheKey = 'asset:solana';
    const cachedPrice = this.getCachedPrice(cacheKey);
    if (cachedPrice !== null) return cachedPrice;
    
    // Get price from sources
    const price = await this.getAssetPrice('solana');
    if (price > 0) {
      this.cachePrice(cacheKey, price);
    }
    return price;
  }
  
  async getUsdcPrice(): Promise<number> {
    // USDC is pegged to USD
    return 1.0;
  }
  
  async getMultiplePrices(assetIds: string[]): Promise<{[coin: string]: number}> {
    // Check if we have all prices in cache already
    const cachedResults: {[coin: string]: number} = {};
    let allCached = true;
    
    for (const id of assetIds) {
      if (id === 'usdc') {
        cachedResults[id] = 1.0;
        continue;
      }
      
      const cacheKey = `asset:${id}`;
      const cachedPrice = this.getCachedPrice(cacheKey);
      
      if (cachedPrice !== null) {
        cachedResults[id] = cachedPrice;
      } else {
        allCached = false;
        break;
      }
    }
    
    // Return all cached prices if available
    if (allCached) {
      console.log('[CryptoPrice] Returning all cached prices for multiple assets');
      return cachedResults;
    }
    
    // Otherwise fetch from APIs
    try {
      // First check if bitcoin is one of the requested assets
      if (assetIds.includes('bitcoin')) {
        // Try to get bitcoin price from blockchain.info
        const btcPrice = await this.getFromBlockchainInfo();
        if (btcPrice !== null) {
          // Start building the result with the bitcoin price
          const result: {[coin: string]: number} = { 'bitcoin': btcPrice };
          this.cachePrice('asset:bitcoin', btcPrice);
          
          // For remaining assets, use CoinCap or fallbacks
          const otherAssets = assetIds.filter(id => id !== 'bitcoin');
          if (otherAssets.length > 0) {
            const otherPrices = await this.fetchRemainingPrices(otherAssets);
            return { ...result, ...otherPrices };
          }
          return result;
        }
      }
      
      // If no bitcoin price or blockchain.info failed, proceed with normal flow
      console.log(`[CryptoPrice] Fetching prices for multiple assets: ${assetIds.join(', ')}`);
      
      // Cache key for the entire batch request
      const batchCacheKey = `batch:${assetIds.sort().join(',')}`;
      const cachedBatch = this.getCachedPrice(batchCacheKey);
      
      if (cachedBatch !== null && typeof cachedBatch === 'object') {
        return cachedBatch as unknown as {[coin: string]: number};
      }
      
      // Check if we need to wait before calling API again
      await this.respectRateLimit('coincap');
      
      // CoinCap has a convenient endpoint for multiple assets
      const queryParams = assetIds.join(',');
      const response = await axios.get(
        `${this.apiBaseUrl}/assets?ids=${queryParams}`,
        {
          timeout: 5000,
          headers: {
            'Accept': 'application/json'
          }
        }
      );
      
      if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
        console.error('[CryptoPrice] Invalid response format for multiple assets:', response.data);
        return this.getFallbackPrices(assetIds);
      }
      
      const result: {[coin: string]: number} = {};
      
      // Initialize all requested assets to 0 in case some are missing from the response
      assetIds.forEach(id => {
        result[id] = 0;
      });
      
      // Update with actual prices from the response
      for (const asset of response.data.data) {
        if (asset.id && asset.priceUsd) {
          const price = parseFloat(asset.priceUsd);
          result[asset.id] = price;
          // Also cache individual prices
          this.cachePrice(`asset:${asset.id}`, price);
        }
      }
      
      // USDC is always 1.0
      if (assetIds.includes('usdc')) {
        result['usdc'] = 1.0;
      }
      
      console.log('[CryptoPrice] Multiple prices result:', result);
      return result;
    } catch (error: unknown) {
      console.error('[CryptoPrice] Error getting multiple prices:', 
        axios.isAxiosError(error) && error.response?.status 
          ? `Status: ${error.response.status}` 
          : error instanceof Error ? error.message : error);
        
      // If we hit rate limits, try fetching individually with fallbacks
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        console.log('[CryptoPrice] Rate limit hit, falling back to individual price fetches');
        return this.fetchRemainingPrices(assetIds);
      }
      
      return this.getFallbackPrices(assetIds);
    }
  }
  
  // Helper to fetch prices for remaining assets individually
  private async fetchRemainingPrices(assetIds: string[]): Promise<{[coin: string]: number}> {
    const results: {[coin: string]: number} = {};
    
    // Fetch each asset price individually with fallbacks
    for (const id of assetIds) {
      if (id === 'usdc') {
        results[id] = 1.0;
        continue;
      }
      
      results[id] = await this.getAssetPrice(id);
    }
    
    return results;
  }
  
  private getFallbackPrices(assetIds: string[]): {[coin: string]: number} {
    const fallback: {[coin: string]: number} = {};
    for (const id of assetIds) {
      fallback[id] = id === 'usdc' ? 1.0 : 0;
    }
    return fallback;
  }
} 