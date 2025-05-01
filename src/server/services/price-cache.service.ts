import { CryptoPrice } from '../../integrations/crypto/price';

interface CachedPrices {
    btc: number | null;
    eth: number | null;
    sol: number | null;
    usdc: number | null;
    xmr: number | null;
    lastUpdated: Date | null;
}

// Simple in-memory cache
let priceCache: CachedPrices = {
    btc: null,
    eth: null,
    sol: null,
    usdc: null,
    xmr: null,
    lastUpdated: null,
};

let isUpdating = false; // Simple lock to prevent concurrent updates
let updateInterval: NodeJS.Timeout | null = null;

export class PriceCacheService {
    private priceIntegration: CryptoPrice;

    constructor() {
        this.priceIntegration = new CryptoPrice();
        // Start background update on initialization
        this.startBackgroundUpdate(); // Ensure it starts
    }

    // Fetches prices and updates the cache
    async updatePrices() {
        if (isUpdating) {
            console.log('[PriceCacheService] Update already in progress, skipping.');
            return;
        }
        isUpdating = true;
        console.log('[PriceCacheService] Starting price cache update...');
        
        // Store previous prices in case of individual failures
        const previousPrices = { ...priceCache }; 
        
        try {
            // Use Promise.allSettled to handle individual failures
            const results = await Promise.allSettled([
                this.priceIntegration.getBitcoinPrice(),
                this.priceIntegration.getEthereumPrice(),
                this.priceIntegration.getSolanaPrice(),
                this.priceIntegration.getUsdcPrice(),
                this.priceIntegration.getMoneroPrice()
            ]);
            
            const [btcResult, ethResult, solResult, usdcResult, xmrResult] = results;

            const newPrices: Partial<CachedPrices> = {};

            // Process BTC
            if (btcResult.status === 'fulfilled' && typeof btcResult.value === 'number') {
                newPrices.btc = btcResult.value;
            } else {
                newPrices.btc = previousPrices.btc; // Keep old price on failure
                console.warn('[PriceCacheService] Failed to fetch BTC price, keeping previous value.', btcResult.status === 'rejected' ? btcResult.reason : 'Invalid value');
            }
            
            // Process ETH
            if (ethResult.status === 'fulfilled' && typeof ethResult.value === 'number') {
                newPrices.eth = ethResult.value;
            } else {
                newPrices.eth = previousPrices.eth; // Keep old price on failure
                console.warn('[PriceCacheService] Failed to fetch ETH price, keeping previous value.', ethResult.status === 'rejected' ? ethResult.reason : 'Invalid value');
            }
            
            // Process SOL
            if (solResult.status === 'fulfilled' && typeof solResult.value === 'number') {
                newPrices.sol = solResult.value;
            } else {
                newPrices.sol = previousPrices.sol; // Keep old price on failure
                console.warn('[PriceCacheService] Failed to fetch SOL price, keeping previous value.', solResult.status === 'rejected' ? solResult.reason : 'Invalid value');
            }
            
            // Process USDC
            if (usdcResult.status === 'fulfilled' && typeof usdcResult.value === 'number') {
                newPrices.usdc = usdcResult.value;
            } else {
                newPrices.usdc = previousPrices.usdc ?? 1; // Keep old price or default to 1
                console.warn('[PriceCacheService] Failed to fetch USDC price, keeping previous value.', usdcResult.status === 'rejected' ? usdcResult.reason : 'Invalid value');
            }
            
            // Process XMR
            if (xmrResult.status === 'fulfilled' && typeof xmrResult.value === 'number') {
                newPrices.xmr = xmrResult.value;
            } else {
                newPrices.xmr = previousPrices.xmr; // Keep old XMR price on failure
                console.warn('[PriceCacheService] Failed to fetch XMR price, keeping previous value.', xmrResult.status === 'rejected' ? xmrResult.reason : 'Invalid value');
            }
                
            // Update cache with new/old prices
            priceCache = {
                btc: newPrices.btc ?? previousPrices.btc, // Use new or fallback explicitly again
                eth: newPrices.eth ?? previousPrices.eth,
                sol: newPrices.sol ?? previousPrices.sol,
                usdc: newPrices.usdc ?? previousPrices.usdc ?? 1,
                xmr: newPrices.xmr ?? previousPrices.xmr,
                lastUpdated: new Date()
            };
            console.log('[PriceCacheService] Price cache update attempt finished.');
            
        } catch (error) {
            // This catch is unlikely with allSettled unless there's a fundamental issue
            console.error('[PriceCacheService] Unexpected error during Promise.allSettled execution:', error);
        } finally {
            isUpdating = false;
        }
    }

    // Returns the current cached prices
    getPrices(): Readonly<CachedPrices> {
        return Object.freeze({ ...priceCache });
    }

    // Starts the periodic background update
    startBackgroundUpdate(intervalMinutes: number = 2) { // Default to 2 minutes
        if (updateInterval) {
            console.warn('[PriceCacheService] Background update already running.');
            return;
        }
        
        console.log(`[PriceCacheService] Starting background price update every ${intervalMinutes} minutes.`);
        
        // Run immediately
        this.updatePrices();
        
        updateInterval = setInterval(() => {
            this.updatePrices();
        }, intervalMinutes * 60 * 1000);
        
        // Ensure interval is cleared on shutdown if possible
        process.on('SIGTERM', () => this.stopBackgroundUpdate());
        process.on('SIGINT', () => this.stopBackgroundUpdate());
    }

    // Stops the background update
    stopBackgroundUpdate() {
        if (updateInterval) {
            console.log('[PriceCacheService] Stopping background price update.');
            clearInterval(updateInterval);
            updateInterval = null;
        }
    }
} 