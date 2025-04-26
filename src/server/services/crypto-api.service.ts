import axios from 'axios';
import { format } from 'date-fns';

// Free CoinGecko API base URL
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
// GeckoTerminal API for DEX data
const GECKOTERMINAL_API_URL = 'https://api.geckoterminal.com/api/v2';

export interface CoinPriceData {
  prices: [number, number][]; // [timestamp, price]
  market_caps: [number, number][]; // [timestamp, market_cap]
  total_volumes: [number, number][]; // [timestamp, volume]
}

export interface CoinOHLCData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface DailyPriceRecord {
  symbol: string;
  date: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  volume: string | null;
  marketCap: string | null;
}

export interface GeckoTerminalNetwork {
  id: string;
  name: string;
  chain_id: string | null;
}

export interface GeckoTerminalPool {
  id: string;
  type: string;
  attributes: {
    address: string;
    name: string;
    base_token_price_usd: string;
    quote_token_price_usd: string;
    base_token: {
      address: string;
      name: string;
      symbol: string;
    };
    quote_token: {
      address: string;
      name: string;
      symbol: string;
    };
    volume_usd: {
      h24: string;
    };
    reserve_in_usd: string;
  };
}

export interface GeckoTerminalOHLCV {
  pair_id: string;
  ohlcv_list: [
    [
      number, // timestamp
      string, // open
      string, // high
      string, // low
      string, // close
      string  // volume
    ]
  ];
}

export class CryptoApiService {
  // Maps common symbols to CoinGecko IDs
  private readonly symbolToId: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'BNB': 'binancecoin',
    'XRP': 'ripple',
    'ADA': 'cardano',
    'AVAX': 'avalanche-2',
    'DOGE': 'dogecoin',
    'DOT': 'polkadot',
    'MATIC': 'matic-network',
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'SHIB': 'shiba-inu',
  };

  // Maps common symbols to networks in GeckoTerminal
  private readonly symbolToNetwork: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'BNB': 'bnb',
    'AVAX': 'avalanche',
    'MATIC': 'polygon',
    'ARB': 'arbitrum'
  };

  // Cache for pools by symbol to avoid redundant API calls
  private poolCache: Record<string, { timestamp: number, pool: string }> = {};

  /**
   * Get historical market data for a specific cryptocurrency
   */
  async getHistoricalMarketData(
    symbol: string, 
    days: number = 30,
    interval: 'daily' | 'hourly' = 'daily'
  ): Promise<CoinPriceData | null> {
    try {
      // First try using CoinGecko
      const coinId = this.getCoinIdFromSymbol(symbol);
      if (!coinId) return null;

      // For 24h, we must use hourly data
      const actualInterval = days === 1 ? 'hourly' : interval;
      
      console.log(`Fetching ${actualInterval} market data for ${symbol} (${days} days)`);
      
      try {
        const response = await axios.get(`${COINGECKO_API_URL}/coins/${coinId}/market_chart`, {
          params: {
            vs_currency: 'usd',
            days: days,
            interval: actualInterval,
          },
          timeout: 10000,
        });
        
        // Log the structure of the response for debugging
        if (days === 1) {
          console.log(`24h market data for ${symbol}:`, 
            `${response.data.prices.length} price points, ` +
            `first timestamp: ${new Date(response.data.prices[0][0]).toISOString()}, ` +
            `last timestamp: ${new Date(response.data.prices[response.data.prices.length-1][0]).toISOString()}`
          );
        }

        return response.data;
      } catch {
        // If CoinGecko fails (likely rate limit), try GeckoTerminal API
        return await this.getGeckoTerminalHistoricalData(symbol, days, interval);
      }
    } catch (error) {
      console.error(`Error fetching historical market data for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get historical data from GeckoTerminal as a fallback
   */
  private async getGeckoTerminalHistoricalData(
    symbol: string,
    days: number,
    interval: 'daily' | 'hourly'
  ): Promise<CoinPriceData | null> {
    try {
      // Find the most liquid pool for this token
      const pool = await this.findMostLiquidPool(symbol);
      if (!pool) {
        return null;
      }

      // Determine appropriate timeframe based on days and interval
      let timeframe: string;
      let aggregate: number;

      if (interval === 'hourly' && days <= 1) {
        timeframe = 'minute';
        aggregate = 30; // 30 minutes for hourly data
      } else if (days <= 7) {
        timeframe = 'hour';
        aggregate = 1;
      } else if (days <= 30) {
        timeframe = 'hour';
        aggregate = 4;
      } else if (days <= 90) {
        timeframe = 'day';
        aggregate = 1;
      } else {
        timeframe = 'day';
        aggregate = Math.ceil(days / 90);
      }

      // Get OHLCV data from GeckoTerminal
      const response = await axios.get(`${GECKOTERMINAL_API_URL}/networks/${pool.network}/pools/${pool.address}/ohlcv`, {
        params: {
          timeframe,
          aggregate,
          limit: Math.min(1000, days * 24), // Respect the GeckoTerminal limit
          currency: 'usd',
        },
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.data || !response.data.data || !response.data.data.attributes || !response.data.data.attributes.ohlcv_list) {
        console.error(`Invalid response from GeckoTerminal for ${symbol}`);
        return null;
      }

      // Transform GeckoTerminal format to CoinGecko format
      const ohlcvList = response.data.data.attributes.ohlcv_list;
      
      const prices: [number, number][] = [];
      const market_caps: [number, number][] = [];
      const total_volumes: [number, number][] = [];
      
      ohlcvList.forEach((item: [number, string, string, string, string, string]) => {
        const timestamp = item[0] * 1000; // Convert seconds to milliseconds
        const closePrice = parseFloat(item[4]);
        const volume = parseFloat(item[5]);
        
        prices.push([timestamp, closePrice]);
        // We don't have market cap data, so use 0
        market_caps.push([timestamp, 0]);
        total_volumes.push([timestamp, volume]);
      });

      console.log(`Retrieved ${prices.length} data points from GeckoTerminal for ${symbol}`);
      
      return { prices, market_caps, total_volumes };
    } catch (error) {
      console.error(`Error fetching GeckoTerminal historical data for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Find the most liquid pool for a token on GeckoTerminal
   */
  private async findMostLiquidPool(symbol: string): Promise<{ network: string, address: string } | null> {
    try {
      const cacheKey = symbol.toUpperCase();
      
      // Check if we have a cached result less than 1 hour old
      const now = Date.now();
      if (this.poolCache[cacheKey] && (now - this.poolCache[cacheKey].timestamp < 3600000)) {
        const [network, address] = this.poolCache[cacheKey].pool.split('_');
        return { network, address };
      }
      
      // Try to find the common network for this symbol
      const network = this.symbolToNetwork[cacheKey] || 'ethereum';
      
      // First, search for token on the specific network
      const searchResponse = await axios.get(`${GECKOTERMINAL_API_URL}/search`, {
        params: {
          query: symbol,
          network: network
        },
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
        }
      });
      
      // Extract token address from search results
      let tokenAddress = null;
      if (searchResponse.data?.data?.tokens?.length > 0) {
        tokenAddress = searchResponse.data.data.tokens[0].attributes.address;
      }
      
      if (!tokenAddress) {
        console.error(`Token ${symbol} not found on GeckoTerminal`);
        return null;
      }
      
      // Get pools for this token
      const poolsResponse = await axios.get(
        `${GECKOTERMINAL_API_URL}/networks/${network}/tokens/${tokenAddress}/pools`,
        {
          params: {
            page: 1,
            limit: 50, // Get a good number of pools to find the most liquid one
          },
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
          }
        }
      );
      
      if (!poolsResponse.data?.data?.length) {
        return null;
      }
      
      // Find the pool with the highest liquidity
      let bestPool = null;
      let highestLiquidity = 0;
      
      for (const pool of poolsResponse.data.data) {
        const liquidity = parseFloat(pool.attributes.reserve_in_usd || '0');
        if (liquidity > highestLiquidity) {
          highestLiquidity = liquidity;
          bestPool = pool;
        }
      }
      
      if (!bestPool) {
        return null;
      }
      
      // Cache the result
      this.poolCache[cacheKey] = {
        timestamp: now,
        pool: `${network}_${bestPool.attributes.address}`
      };
      
      return {
        network,
        address: bestPool.attributes.address
      };
    } catch (error: unknown) {
      console.error(`[CryptoApiService] Error finding most liquid pool for ${symbol}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Get OHLC (Open-High-Low-Close) data for a specific cryptocurrency
   */
  async getOHLCData(symbol: string, days: number = 30): Promise<CoinOHLCData[] | null> {
    try {
      // First try using CoinGecko
      const coinId = this.getCoinIdFromSymbol(symbol);
      if (!coinId) return null;

      // CoinGecko offers different day ranges with different granularity
      let actualDays = days;
      if (days > 90) actualDays = 90; // Max 90 days for daily candles
      
      try {
        const response = await axios.get(`${COINGECKO_API_URL}/coins/${coinId}/ohlc`, {
          params: {
            vs_currency: 'usd',
            days: actualDays,
          },
          timeout: 10000,
        });

        // Transform the data to our expected format
        return response.data.map((item: [number, number, number, number, number]) => ({
          time: item[0],
          open: item[1],
          high: item[2],
          low: item[3],
          close: item[4],
        }));
      } catch {
        // If CoinGecko fails, try to build OHLC from GeckoTerminal data
        console.log(`CoinGecko OHLC API failed, trying to build OHLC from GeckoTerminal for ${symbol}...`);
        return await this.getGeckoTerminalOHLCData(symbol, days);
      }
    } catch (error) {
      console.error(`Error fetching OHLC data for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get OHLC data from GeckoTerminal
   */
  private async getGeckoTerminalOHLCData(symbol: string, days: number): Promise<CoinOHLCData[] | null> {
    try {
      // Find the most liquid pool for this token
      const pool = await this.findMostLiquidPool(symbol);
      if (!pool) {
        console.error(` found for ${symbol} on GeckoTerminal`);
        return null;
      }

      // Determine appropriate timeframe based on days
      let timeframe: string;
      let aggregate: number;

      if (days <= 1) {
        timeframe = 'minute';
        aggregate = 15; // 15 minutes for intraday
      } else if (days <= 7) {
        timeframe = 'hour';
        aggregate = 1;
      } else if (days <= 30) {
        timeframe = 'hour';
        aggregate = 4;
      } else if (days <= 90) {
        timeframe = 'day';
        aggregate = 1;
      } else {
        timeframe = 'day';
        aggregate = Math.ceil(days / 90);
      }

      // Get OHLCV data from GeckoTerminal
      const response = await axios.get(`${GECKOTERMINAL_API_URL}/networks/${pool.network}/pools/${pool.address}/ohlcv`, {
        params: {
          timeframe,
          aggregate,
          limit: Math.min(1000, days * 24), // Respect the GeckoTerminal limit
          currency: 'usd',
        },
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.data || !response.data.data || !response.data.data.attributes || !response.data.data.attributes.ohlcv_list) {
        console.error(`Invalid response from GeckoTerminal for ${symbol}`);
        return null;
      }

      // Transform GeckoTerminal format to our expected format
      const ohlcvList = response.data.data.attributes.ohlcv_list;
      
      return ohlcvList.map((item: [number, string, string, string, string, string]) => ({
        time: item[0] * 1000, // Convert seconds to milliseconds to match CoinGecko format
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
      }));
    } catch (error) {
      console.error(`Error fetching GeckoTerminal OHLC data for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Convert historical market data to the daily prices format needed for our database
   */
  convertToDailyPrices(
    symbol: string,
    marketData: CoinPriceData, 
    ohlcData: CoinOHLCData[] | null,
    isHourly: boolean = false
  ): DailyPriceRecord[] {
    const result: DailyPriceRecord[] = [];
    
    if (!marketData || !marketData.prices || marketData.prices.length === 0) {
      return result;
    }

    // For 24h timeframe with hourly data, we'll focus on the marketData directly
    // since it provides better hourly granularity than OHLC data
    if (isHourly) {
      // Sort market data by timestamp to ensure chronological order
      const sortedPrices = [...marketData.prices].sort((a, b) => a[0] - b[0]);
      
      // Group price points by hour
      const hourlyPrices = new Map<string, number[]>();
      const hourlyTimestamps = new Map<string, number>();
      
      // Process each price point
      sortedPrices.forEach(([timestamp, price]) => {
        const date = new Date(timestamp);
        // Format with hours but zero out minutes and seconds for grouping by hour
        const hourKey = format(date, 'yyyy-MM-dd HH:00:00');
        
        if (!hourlyPrices.has(hourKey)) {
          hourlyPrices.set(hourKey, []);
          hourlyTimestamps.set(hourKey, timestamp);
        }
        
        hourlyPrices.get(hourKey)?.push(price);
      });
      
      // Get volume and market cap data
      for (const hourKey of hourlyPrices.keys()) {
        const timestamp = hourlyTimestamps.get(hourKey) || 0;
        const prices = hourlyPrices.get(hourKey) || [];
        
        if (prices.length > 0) {
          // Calculate OHLC from prices within this hour
          const open = prices[0];
          const close = prices[prices.length - 1];
          const high = Math.max(...prices);
          const low = Math.min(...prices);
          
          // Find closest volume and market cap data
          const marketDataPoint = this.findClosestMarketDataPoint(marketData, timestamp);
          
          result.push({
            symbol,
            date: hourKey,
            openPrice: open.toString(),
            highPrice: high.toString(),
            lowPrice: low.toString(),
            closePrice: close.toString(),
            volume: marketDataPoint?.volume?.toString() || null,
            marketCap: marketDataPoint?.marketCap?.toString() || null,
          });
        }
      }
      
      return result;
    }

    // If we have OHLC data, use it for more accurate pricing for non-hourly data
    if (ohlcData && ohlcData.length > 0) {
      for (const candle of ohlcData) {
        const date = new Date(candle.time);
        const formattedDate = format(date, 'yyyy-MM-dd');
        
        // Find corresponding market data points
        const marketDataPoint = this.findClosestMarketDataPoint(marketData, candle.time);
        
        result.push({
          symbol,
          date: formattedDate,
          openPrice: candle.open.toString(),
          highPrice: candle.high.toString(),
          lowPrice: candle.low.toString(),
          closePrice: candle.close.toString(),
          volume: marketDataPoint?.volume?.toString() || null,
          marketCap: marketDataPoint?.marketCap?.toString() || null,
        });
      }
    } else {
      // If no OHLC data, create approximated records from market data
      const pricesByInterval = new Map<string, number[]>();
      const volumesByInterval = new Map<string, number>();
      const marketCapsByInterval = new Map<string, number>();
      
      // Group prices
      marketData.prices.forEach(([timestamp, price]) => {
        const date = new Date(timestamp);
        const formattedDate = format(date, 'yyyy-MM-dd');
        
        if (!pricesByInterval.has(formattedDate)) {
          pricesByInterval.set(formattedDate, []);
        }
        pricesByInterval.get(formattedDate)?.push(price);
      });
      
      // Get last volume and market cap for each interval
      marketData.total_volumes.forEach(([timestamp, volume]) => {
        const date = new Date(timestamp);
        const formattedDate = format(date, 'yyyy-MM-dd');
        volumesByInterval.set(formattedDate, volume);
      });
      
      marketData.market_caps.forEach(([timestamp, marketCap]) => {
        const date = new Date(timestamp);
        const formattedDate = format(date, 'yyyy-MM-dd');
        marketCapsByInterval.set(formattedDate, marketCap);
      });
      
      // Create price records
      for (const [date, prices] of pricesByInterval.entries()) {
        if (prices.length > 0) {
          // Calculate OHLC from available prices
          const open = prices[0];
          const close = prices[prices.length - 1];
          const high = Math.max(...prices);
          const low = Math.min(...prices);
          const volume = volumesByInterval.get(date) || 0;
          const marketCap = marketCapsByInterval.get(date) || 0;
          
          result.push({
            symbol,
            date,
            openPrice: open.toString(),
            highPrice: high.toString(),
            lowPrice: low.toString(),
            closePrice: close.toString(),
            volume: volume.toString(),
            marketCap: marketCap.toString(),
          });
        }
      }
    }
    
    return result;
  }

  private findClosestMarketDataPoint(marketData: CoinPriceData, timestamp: number) {
    let closestVolumePoint = null;
    let closestMarketCapPoint = null;
    let minVolumeDiff = Infinity;
    let minMarketCapDiff = Infinity;
    
    // Find closest volume data point
    for (const [volTimestamp, volume] of marketData.total_volumes) {
      const diff = Math.abs(volTimestamp - timestamp);
      if (diff < minVolumeDiff) {
        minVolumeDiff = diff;
        closestVolumePoint = volume;
      }
    }
    
    // Find closest market cap data point
    for (const [mcTimestamp, marketCap] of marketData.market_caps) {
      const diff = Math.abs(mcTimestamp - timestamp);
      if (diff < minMarketCapDiff) {
        minMarketCapDiff = diff;
        closestMarketCapPoint = marketCap;
      }
    }
    
    return {
      volume: closestVolumePoint,
      marketCap: closestMarketCapPoint,
    };
  }

  /**
   * Get coin ID from symbol
   */
  private getCoinIdFromSymbol(symbol: string): string | null {
    const upperSymbol = symbol.toUpperCase();
    return this.symbolToId[upperSymbol] || null;
  }

  /**
   * Get current price for a specific cryptocurrency
   */
  async getCurrentPrice(symbol: string): Promise<number | null> {
    console.log(`[CryptoApiService] getCurrentPrice called for symbol: ${symbol}`); // Log entry
    try {
      const coinId = this.getCoinIdFromSymbol(symbol);
      console.log(`[CryptoApiService] Mapped symbol ${symbol} to CoinGecko ID: ${coinId}`);
      if (!coinId) {
          console.error(`[CryptoApiService] No CoinGecko ID found for symbol: ${symbol}`);
          return null;
      }

      try {
        console.log(`[CryptoApiService] Attempting CoinGecko simple price fetch for ID: ${coinId}`);
        const response = await axios.get(`${COINGECKO_API_URL}/simple/price`, {
          params: {
            ids: coinId,
            vs_currencies: 'usd',
          },
          timeout: 5000,
        });
        console.log(`[CryptoApiService] CoinGecko response for ${coinId}:`, JSON.stringify(response.data)); // Log response data
        const price = response.data[coinId]?.usd;
        if (price !== undefined && price !== null) {
            console.log(`[CryptoApiService] Successfully fetched price from CoinGecko for ${symbol}: ${price}`);
            return price;
        } else {
            console.warn(`[CryptoApiService] CoinGecko response did not contain USD price for ${coinId}`);
            // Don't return null yet, fall through to GeckoTerminal
        }
      } catch (error: unknown) {
        console.error(`[CryptoApiService] Error fetching from CoinGecko simple price for ${coinId}:`, error instanceof Error ? error.message : 'Unknown error');
        if (axios.isAxiosError(error)) {
            console.error(`[CryptoApiService] CoinGecko Axios error details: Status=${error.response?.status}, Data=`, error.response?.data);
        }        
        // Fall through to GeckoTerminal
      }
        
      // If CoinGecko failed or returned no price, try GeckoTerminal
      console.log(`[CryptoApiService] Trying GeckoTerminal fallback for ${symbol}...`);
      return await this.getCurrentPriceFromGeckoTerminal(symbol);

    } catch (error: unknown) {
      console.error(`[CryptoApiService] Outer error in getCurrentPrice for ${symbol}:`, error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Get current price directly from GeckoTerminal
   */
  async getCurrentPriceFromGeckoTerminal(symbol: string): Promise<number | null> {
    console.log(`[CryptoApiService] getCurrentPriceFromGeckoTerminal called for symbol: ${symbol}`); // Log entry
    try {
      // Find the most liquid pool for this token
      console.log(`[CryptoApiService] Finding most liquid pool for ${symbol} on GeckoTerminal...`);
      const pool = await this.findMostLiquidPool(symbol);
      if (!pool) {
        console.error(`[CryptoApiService] No suitable pool found for ${symbol} on GeckoTerminal.`);
        return null;
      }
      console.log(`[CryptoApiService] Found pool for ${symbol}: Network=${pool.network}, Address=${pool.address}`);

      // Get pool details
      console.log(`[CryptoApiService] Fetching pool details from GeckoTerminal for pool ${pool.address}...`);
      const response = await axios.get(
        `${GECKOTERMINAL_API_URL}/networks/${pool.network}/pools/${pool.address}`,
        {
          timeout: 5000,
          headers: {
            'Accept': 'application/json',
          }
        }
      );
      console.log(`[CryptoApiService] GeckoTerminal pool details response status: ${response.status}`);
      console.log(`[CryptoApiService] GeckoTerminal pool details response data:`, JSON.stringify(response.data)); // Log response data

      if (!response.data?.data?.attributes) {
        console.error(`[CryptoApiService] Invalid response structure from GeckoTerminal pool details for ${symbol}:`, response.data);
        return null;
      }

      // Determine which token in the pair matches our symbol
      const poolData = response.data.data.attributes;
      console.log(`[CryptoApiService] Pool details data for ${symbol}: Base=${poolData.base_token?.symbol}, Quote=${poolData.quote_token?.symbol}`);
      
      // Add null checks for poolData tokens
      const baseSymbol = poolData.base_token?.symbol?.toUpperCase();
      const quoteSymbol = poolData.quote_token?.symbol?.toUpperCase();
      const upperSymbol = symbol.toUpperCase();

      if (baseSymbol === upperSymbol) {
        const price = parseFloat(poolData.base_token_price_usd);
        console.log(`[CryptoApiService] Using base token price for ${symbol}: ${price}`);
        return isNaN(price) ? null : price;
      }
      
      if (quoteSymbol === upperSymbol) {
        const price = parseFloat(poolData.quote_token_price_usd);
        console.log(`[CryptoApiService] Using quote token price for ${symbol}: ${price}`);
        return isNaN(price) ? null : price;
      }

      console.error(`[CryptoApiService] Symbol ${symbol} not found in GeckoTerminal pool tokens (${baseSymbol} / ${quoteSymbol})`);
      return null;
    } catch (error: unknown) {
      console.error(`[CryptoApiService] Error in getCurrentPriceFromGeckoTerminal for ${symbol}:`, error instanceof Error ? error.message : 'Unknown error');
      if (axios.isAxiosError(error)) {
        console.error(`[CryptoApiService] GeckoTerminal Axios error details: Status=${error.response?.status}, Data=`, JSON.stringify(error.response?.data)); // Log error data
      }
      return null;
    }
  }
} 