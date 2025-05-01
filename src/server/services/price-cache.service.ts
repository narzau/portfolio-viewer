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
        // Initialize immediately
        this.updatePrices();
    }

    // Fetches prices and updates the cache
    async updatePrices() {
        if (isUpdating) {
            console.log('[PriceCacheService] Update already in progress, skipping.');
            return;
        }
        isUpdating = true;
        console.log('[PriceCacheService] Starting price cache update...');
        try {
            const [btcPrice, ethPrice, solPrice, usdcPrice, xmrPrice] = await Promise.all([
                this.priceIntegration.getBitcoinPrice(),
                this.priceIntegration.getEthereumPrice(),
                this.priceIntegration.getSolanaPrice(),
                this.priceIntegration.getUsdcPrice(),
                this.priceIntegration.getMoneroPrice()
            ]);
            
            priceCache = {
                btc: btcPrice,
                eth: ethPrice,
                sol: solPrice,
                usdc: usdcPrice,
                xmr: xmrPrice,
                lastUpdated: new Date()
            };
            console.log('[PriceCacheService] Price cache updated successfully');
        } catch (error) {
            console.error('[PriceCacheService] Error updating price cache:', error);
        } finally {
            isUpdating = false;
        }
    }

    // Returns the current cached prices
    getPrices(): Readonly<CachedPrices> {
        return Object.freeze({ ...priceCache });
    }

    // Starts the periodic background update
    startBackgroundUpdate(intervalMinutes: number = 5) {
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