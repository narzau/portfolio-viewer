import { CryptoPrice } from '../../integrations/crypto/price';
import { createClient, RedisClientType } from 'redis';
import { AssetService } from './asset.service';

// Use number for timestamp (milliseconds since epoch)
interface CachedPrices {
    btc: number | null;
    eth: number | null;
    sol: number | null;
    usdc: number | null;
    xmr: number | null;
    lastUpdated: number | null; // Changed to number
}

// Cache key in Redis
const CACHE_KEY = 'priceCache';
// Cache expiry time in seconds (e.g., 5 minutes)
const CACHE_TTL_SECONDS = 5 * 60;
// How old the cache can be before triggering a background refresh (e.g., 2 minutes)
const CACHE_STALE_MS = 2 * 60 * 1000; 

export class PriceCacheService {
    private priceIntegration: CryptoPrice;
    private redisClient: RedisClientType;
    private assetService: AssetService;
    private isRedisConnected = false;
    private isUpdating = false; // Still useful as a local lock

    constructor() {
        this.priceIntegration = new CryptoPrice();
        this.assetService = new AssetService();
        
        // Initialize Redis client
        // The redis library automatically picks up REDIS_URL from env if present
        this.redisClient = createClient({ 
            url: process.env.REDIS_URL // Explicitly pass from process.env just in case
        });

        this.redisClient.on('error', (err) => {
            // Log Redis errors
            console.error('[PriceCacheService][Redis] Connection Error:', err);
            this.isRedisConnected = false;
        });
        
        this.redisClient.on('connect', () => {
            // Log successful connection
             console.log('[PriceCacheService][Redis] Successfully connected.');
            this.isRedisConnected = true;
        });
        
        this.redisClient.connect().catch(err => {
             // Log initial connection failure
             console.error('[PriceCacheService][Redis] Initial connection failed:', err);
        });
    }
    
    // Fetches fresh prices and updates the cache in Redis
    private async _fetchAndCachePrices(): Promise<CachedPrices | null> {
        if (this.isUpdating) {
            console.log('[PriceCacheService] Background update already in progress, skipping fetch.');
            return this._readCacheFromRedis(); 
        }
        this.isUpdating = true;
        console.log('[PriceCacheService] Starting price fetch (batch) and cache update...');

        let previousPrices: CachedPrices | null = null;
        try {
            previousPrices = await this._readCacheFromRedis();
            
            // Define symbols and fetch prices using the new batch method
            const symbolsToFetch = ['BTC', 'ETH', 'SOL', 'USDC', 'XMR'];
            const fetchedPricesMap = await this.priceIntegration.fetchPricesBatch(symbolsToFetch);

            // Build new cache data using the map, falling back to previous values
            const newCacheData: CachedPrices = {
                btc: (fetchedPricesMap['BTC'] !== null && !isNaN(fetchedPricesMap['BTC'])) 
                    ? fetchedPricesMap['BTC'] 
                    : previousPrices?.btc ?? null,
                eth: (fetchedPricesMap['ETH'] !== null && !isNaN(fetchedPricesMap['ETH'])) 
                    ? fetchedPricesMap['ETH'] 
                    : previousPrices?.eth ?? null,
                sol: (fetchedPricesMap['SOL'] !== null && !isNaN(fetchedPricesMap['SOL'])) 
                    ? fetchedPricesMap['SOL'] 
                    : previousPrices?.sol ?? null,
                usdc: (fetchedPricesMap['USDC'] !== null && !isNaN(fetchedPricesMap['USDC'])) 
                    ? fetchedPricesMap['USDC'] 
                    : previousPrices?.usdc ?? 1, // Default USDC to 1
                // For XMR: Use fetched price if valid, otherwise keep previous *valid* price, else null
                xmr: (fetchedPricesMap['XMR'] !== null && !isNaN(fetchedPricesMap['XMR'])) 
                    ? fetchedPricesMap['XMR'] 
                    : (previousPrices?.xmr !== null && typeof previousPrices?.xmr === 'number' && !isNaN(previousPrices.xmr)) // Check previous safely
                        ? previousPrices.xmr 
                        : null, // Only store null if fetch failed AND previous was null/invalid
                lastUpdated: Date.now()
            };

            // Store in Redis with TTL
            let redisWriteSuccess = false;
            if (this.isRedisConnected) {
                try {
                    await this.redisClient.set(CACHE_KEY, JSON.stringify(newCacheData), {
                        EX: CACHE_TTL_SECONDS 
                    });
                    console.log(`[PriceCacheService][Redis] Wrote cache key '${CACHE_KEY}'.`);
                    redisWriteSuccess = true;
                } catch (redisError) {
                     console.error(`[PriceCacheService][Redis] Error writing cache key '${CACHE_KEY}':`, redisError);
                }
            } else {
                 console.error('[PriceCacheService][Redis] Not connected, cannot write cache.');
            }
            
            // If Redis write was successful, attempt to update DB prices
            if (redisWriteSuccess) {
                console.log('[PriceCacheService] Attempting to update DB prices from fresh cache data...');
                const dbUpdatePromises = Object.entries(newCacheData)
                    .filter(([key, price]) => key !== 'lastUpdated' && price !== null && !isNaN(price))
                    .map(async ([symbol, price]) => {
                        try {
                            // We use updateAssetPrice which updates ALL assets with that symbol.
                            // If you need per-wallet accuracy, logic here would be more complex.
                            await this.assetService.updateAssetPrice(symbol, price as number);
                            console.log(`[PriceCacheService] DB price update successful for ${symbol}.`);
                        } catch (dbError) {
                            console.error(`[PriceCacheService] DB price update FAILED for ${symbol}:`, dbError);
                            // Continue trying other symbols even if one fails
                        }
                    });
                await Promise.allSettled(dbUpdatePromises); // Wait for all DB updates to settle
                console.log('[PriceCacheService] Finished attempting DB price updates.');
            }
            
            return newCacheData;

        } catch (error) {
            console.error('[PriceCacheService] Error during batch fetch/cache update:', error);
            return previousPrices; // Return previous cache on error
        } finally {
            this.isUpdating = false;
        }
    }

    // Reads the cache object from Redis
    private async _readCacheFromRedis(): Promise<CachedPrices | null> {
        if (!this.isRedisConnected) {
            console.warn('[PriceCacheService][Redis] Not connected, cannot read cache.');
            return null;
        }
        try {
            const cachedString = await this.redisClient.get(CACHE_KEY);
            if (cachedString) {
                // Log successful cache read
                console.log(`[PriceCacheService][Redis] Read cache key '${CACHE_KEY}'.`);
                return JSON.parse(cachedString) as CachedPrices;
            } else {
                // Log cache miss
                console.log(`[PriceCacheService][Redis] Cache key '${CACHE_KEY}' not found.`);
            }
        } catch (error) {
            console.error(`[PriceCacheService][Redis] Error reading cache key '${CACHE_KEY}':`, error);
        }
        return null;
    }

    // Public method to get prices
    async getPrices(): Promise<Readonly<CachedPrices> | null> {
        const cachedData = await this._readCacheFromRedis();
        const now = Date.now();

        if (cachedData && cachedData.lastUpdated && (now - cachedData.lastUpdated < CACHE_STALE_MS)) {
            // Log cache hit (fresh)
            console.log(`[PriceCacheService] Cache hit (fresh) for key '${CACHE_KEY}'.`);
            return Object.freeze(cachedData);
        }

        if (cachedData) {
             // Log cache hit (stale)
             console.log(`[PriceCacheService] Cache hit (stale) for key '${CACHE_KEY}' (last updated: ${new Date(cachedData.lastUpdated!).toISOString()}). Triggering background update.`);
             this._fetchAndCachePrices(); // Fire-and-forget update
             return Object.freeze(cachedData); // Return stale data
        } else {
            // Log cache miss
            console.log(`[PriceCacheService] Cache miss for key '${CACHE_KEY}'. Triggering background update.`);
            this._fetchAndCachePrices(); // Fire-and-forget update
            return null; // Return null as cache was empty
        }
    }

    // NEW method to force a refresh and return the results
    async getFreshPrices(): Promise<Readonly<CachedPrices> | null> {
        console.log('[PriceCacheService] Force refreshing prices now...');
        // Directly call the internal fetch/cache method and await its result
        const freshData = await this._fetchAndCachePrices(); 
        console.log('[PriceCacheService] Force refresh finished.');
        return freshData ? Object.freeze(freshData) : null;
    }

    // No longer need background interval methods
    // startBackgroundUpdate() { ... }
    // stopBackgroundUpdate() { ... }
} 