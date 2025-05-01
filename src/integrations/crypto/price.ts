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

// Define mapping for internal symbols to CoinGecko IDs
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  USDC: 'usd-coin',
  XMR: 'monero',
  // Add other mappings if needed
};

export class CryptoPrice {
  // Keep API base URLs if other methods still use them
  // private apiBaseUrl = 'https://api.coincap.io/v2';
  // private blockchainInfoUrl = 'https://blockchain.info'; 
  private coingeckoApiBaseUrl = 'https://api.coingecko.com/api/v3';
  
  // Keep rate limiting state if other methods use it
  private lastApiCall: Record<string, number> = {};
  private minDelayBetweenCalls = 1000; // 1 second

  // REMOVE all individual getFrom... methods (getFromCoinCap, getFromBlockchainInfo, etc.)
  // REMOVE getPrice method
  // REMOVE individual getXxxPrice methods (getBitcoinPrice, getEthereumPrice, etc.)
  
  // Keep helper to respect rate limits if needed, or simplify if only one API is used now
  private async respectRateLimit(apiKey: string): Promise<void> {
    const now = Date.now();
    const lastCall = this.lastApiCall[apiKey] || 0;
    const timeSinceLastCall = now - lastCall;
    
    if (timeSinceLastCall < this.minDelayBetweenCalls) {
      const delayNeeded = this.minDelayBetweenCalls - timeSinceLastCall;
      console.log(`[CryptoPrice] Rate limiting: waiting ${delayNeeded}ms before calling ${apiKey} API`);
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }
    this.lastApiCall[apiKey] = Date.now();
  }

  // NEW Batch fetch method using CoinGecko
  async fetchPricesBatch(symbols: string[], retryCount = 0): Promise<Record<string, number | null>> {
    const apiKey = 'coingecko_batch';
    const coinGeckoIds = symbols
      .map(symbol => SYMBOL_TO_COINGECKO_ID[symbol.toUpperCase()])
      .filter(id => !!id); // Filter out symbols without a mapping

    if (coinGeckoIds.length === 0) {
      console.warn('[CryptoPrice] fetchPricesBatch called with no mappable symbols.');
      return {};
    }

    const idsParam = coinGeckoIds.join(',');
    const url = `${this.coingeckoApiBaseUrl}/simple/price?ids=${idsParam}&vs_currencies=usd`;

    await this.respectRateLimit(apiKey);

    try {
      console.log(`[CryptoPrice] Fetching batch prices from CoinGecko for IDs: ${idsParam}`);
      const response = await axios.get(url, { timeout: 8000 }); // Increased timeout slightly

      const prices: Record<string, number | null> = {};

      // Map results back to original symbols
      for (const symbol of symbols) {
        const coinGeckoId = SYMBOL_TO_COINGECKO_ID[symbol.toUpperCase()];
        if (coinGeckoId && response.data && response.data[coinGeckoId] && response.data[coinGeckoId].usd) {
          prices[symbol.toUpperCase()] = response.data[coinGeckoId].usd;
        } else {
          prices[symbol.toUpperCase()] = null; // Mark as null if not found in response
        }
      }
      console.log('[CryptoPrice] Successfully fetched batch prices:', prices);
      return prices;

    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 429 && retryCount < 3) {
        const backoffTime = Math.pow(2, retryCount) * 1000;
        console.warn(`[CryptoPrice] CoinGecko batch rate limit hit, backing off for ${backoffTime}ms before retry ${retryCount + 1}/3`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return this.fetchPricesBatch(symbols, retryCount + 1); // Retry with original symbols
      }
      console.error(`[CryptoPrice] CoinGecko batch error:`, 
        axios.isAxiosError(error) && error.response?.status 
          ? `Status: ${error.response.status}` 
          : error instanceof Error ? error.message : String(error));
      
      // On failure, return object with null for all requested symbols
      const errorResult: Record<string, number | null> = {};
      symbols.forEach(symbol => { errorResult[symbol.toUpperCase()] = null; });
      return errorResult;
    }
  }
  
  // REMOVE or refactor getMultiplePrices / getMultiplePricesWithChanges if they are still used elsewhere
  // For now, assume they are not needed as PriceCacheService handles the main price logic
} 