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

// Add an interface for price data with change percentage
export interface PriceData {
  price: number;
  changePercent24Hr: number | null;
}

export class CryptoPrice {
  // API base URLs
  private apiBaseUrl = 'https://api.coincap.io/v2';
  private blockchainInfoUrl = 'https://blockchain.info';
  
  // Tracking API calls for rate limiting
  private lastApiCall: Record<string, number> = {};
  private minDelayBetweenCalls = 1000; // 1 second minimum between calls to same API
  
  // Fetch price from CoinCap with retry logic
  async getFromCoinCap(assetId: string, retryCount = 0): Promise<number | null> {
    const apiKey = 'coincap';
    
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

  // Simplify getPrice - just try sources in order, no local cache
  async getPrice(coinCapId: string, coinGeckoId: string, binanceSymbol: string): Promise<number | null> {
      let price = await this.getFromCoinCap(coinCapId);
      if (price !== null) return price;
      
      console.log(`[CryptoPrice] CoinCap failed for ${coinCapId}, trying CoinGecko...`);
      price = await this.getFromCoinGecko(coinGeckoId);
      if (price !== null) return price;

      // Only try Binance if symbol provided
      if (binanceSymbol) {
        console.log(`[CryptoPrice] CoinGecko failed for ${coinGeckoId}, trying Binance...`);
        price = await this.getFromBinance(binanceSymbol);
        if (price !== null) return price;
      }
      
      console.warn(`[CryptoPrice] All price sources failed for ${coinCapId}/${coinGeckoId}/${binanceSymbol}`);
      return null; // Return null if all sources fail
  }

  // --- Specific Asset Price Methods --- 

  // These methods now just call getPrice with the appropriate IDs

  async getBitcoinPrice(): Promise<number | null> { // Return null on failure
    // Try Blockchain.info first as it might be more reliable for BTC
    const price = await this.getFromBlockchainInfo();
    if (price !== null) return price;
    // Fallback to the standard multi-source getPrice
    console.log(`[CryptoPrice] Blockchain.info failed for BTC, trying standard getPrice...`);
    return await this.getPrice('bitcoin', 'bitcoin', 'BTC'); 
  }

  async getEthereumPrice(): Promise<number | null> { // Return null on failure
    return await this.getPrice('ethereum', 'ethereum', 'ETH');
  }

  async getSolanaPrice(): Promise<number | null> { // Return null on failure
    return await this.getPrice('solana', 'solana', 'SOL');
  }

  async getUsdcPrice(): Promise<number | null> { // Return null on failure
    // Primarily use CoinGecko for stablecoins, CoinCap might be less accurate
    let price = await this.getFromCoinGecko('usd-coin');
    if (price !== null) return price;
    // Fallback to CoinCap if CoinGecko fails
    console.log(`[CryptoPrice] CoinGecko failed for USDC, trying CoinCap...`);
    price = await this.getFromCoinCap('usd-coin');
    // Return price or default to 1 if both fail
    return price !== null ? price : 1; 
  }

  async getMoneroPrice(): Promise<number | null> { // Return null on failure
    // Monero isn't typically on Binance, so try CoinCap then CoinGecko
    return await this.getPrice('monero', 'monero', ''); // Pass empty string for Binance symbol
  }

  // ... (Keep getMultiplePrices and related methods, they need refactoring 
  //      but focus on single price first) ...
} 