import { CryptoPrice } from '../../integrations/crypto/price';
import { createClient, RedisClientType } from 'redis';

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
    private isRedisConnected = false;
    private isUpdating = false; // Still useful as a local lock

    constructor() {
        this.priceIntegration = new CryptoPrice();
        
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
            // If update is already running, try returning current cache one more time
            return this._readCacheFromRedis(); 
        }
        this.isUpdating = true;
        console.log('[PriceCacheService] Starting price fetch and cache update...');

        let previousPrices: CachedPrices | null = null;
        try {
             // Get previous values from cache to use as fallbacks
            previousPrices = await this._readCacheFromRedis();
            
            const results = await Promise.allSettled([
                this.priceIntegration.getBitcoinPrice(),
                this.priceIntegration.getEthereumPrice(),
                this.priceIntegration.getSolanaPrice(),
                this.priceIntegration.getUsdcPrice(),
                this.priceIntegration.getMoneroPrice()
            ]);

            const [btcResult, ethResult, solResult, usdcResult, xmrResult] = results;

            // Build new cache data, falling back to previous values
            const newCacheData: CachedPrices = {
                btc: (btcResult.status === 'fulfilled' && typeof btcResult.value === 'number') ? btcResult.value : previousPrices?.btc ?? null,
                eth: (ethResult.status === 'fulfilled' && typeof ethResult.value === 'number') ? ethResult.value : previousPrices?.eth ?? null,
                sol: (solResult.status === 'fulfilled' && typeof solResult.value === 'number') ? solResult.value : previousPrices?.sol ?? null,
                usdc: (usdcResult.status === 'fulfilled' && typeof usdcResult.value === 'number') ? usdcResult.value : previousPrices?.usdc ?? 1,
                xmr: (xmrResult.status === 'fulfilled' && typeof xmrResult.value === 'number') ? xmrResult.value : previousPrices?.xmr ?? null,
                lastUpdated: Date.now() // Use timestamp number
            };

            // Store in Redis with TTL
            if (this.isRedisConnected) {
                try {
                    await this.redisClient.set(CACHE_KEY, JSON.stringify(newCacheData), {
                        EX: CACHE_TTL_SECONDS 
                    });
                    // Log successful cache write
                    console.log(`[PriceCacheService][Redis] Wrote cache key '${CACHE_KEY}' with TTL ${CACHE_TTL_SECONDS}s.`);
                } catch (redisError) {
                     console.error(`[PriceCacheService][Redis] Error writing cache key '${CACHE_KEY}':`, redisError);
                }
            } else {
                 console.error('[PriceCacheService][Redis] Not connected, cannot write cache.');
            }
            
            return newCacheData;

        } catch (error) {
            console.error('[PriceCacheService] Error during fetch/cache update:', error);
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

    // No longer need background interval methods
    // startBackgroundUpdate() { ... }
    // stopBackgroundUpdate() { ... }
} 