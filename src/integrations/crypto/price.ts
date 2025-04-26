import axios from 'axios';

export interface PriceResponse {
  [id: string]: {
    usd: number;
    usd_24h_change?: number;
  };
}

export class CryptoPrice {
  private apiBaseUrl: string;
  
  constructor(apiBaseUrl: string = 'https://api.coingecko.com/api/v3') {
    this.apiBaseUrl = apiBaseUrl;
  }
  
  async getCurrentPrices(coinIds: string[]): Promise<PriceResponse> {
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_24hr_change=true`
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching crypto prices:', error);
      throw new Error('Failed to fetch crypto prices');
    }
  }
  
  async getBitcoinPrice(): Promise<number> {
    const prices = await this.getCurrentPrices(['bitcoin']);
    return prices.bitcoin.usd;
  }
  
  async getEthereumPrice(): Promise<number> {
    const prices = await this.getCurrentPrices(['ethereum']);
    return prices.ethereum.usd;
  }
  
  async getSolanaPrice(): Promise<number> {
    const prices = await this.getCurrentPrices(['solana']);
    return prices.solana.usd;
  }
  
  async getUsdcPrice(): Promise<number> {
    // USDC is a stablecoin pegged to USD
    return 1.0;
  }
  
  async getMultiplePrices(coins: string[]): Promise<{[coin: string]: number}> {
    const prices = await this.getCurrentPrices(coins);
    
    const result: {[coin: string]: number} = {};
    for (const coin of Object.keys(prices)) {
      result[coin] = prices[coin].usd;
    }
    
    return result;
  }
} 