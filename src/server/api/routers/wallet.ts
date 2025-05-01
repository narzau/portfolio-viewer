import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { WalletService } from '../../services/wallet.service';
import { WalletIntegrationService } from '../../services/wallet-integration.service';
import { PriceCacheService } from '../../services/price-cache.service';
import { CryptoPrice } from '../../../integrations/crypto/price';
import { AssetService } from '../../services/asset.service';
import { db } from '../../db';
import { assets as assetsSchema } from '../../db/schema';
import { and, eq } from 'drizzle-orm';

const walletService = new WalletService();
const walletIntegrationService = new WalletIntegrationService();
const priceCacheService = new PriceCacheService();
const assetService = new AssetService();

export const walletRouter = router({
  getAll: publicProcedure.query(async () => {
    return await walletService.getAllWallets();
  }),
  
  create: publicProcedure
    .input(z.object({
      name: z.string(),
      address: z.string(),
      type: z.enum(['solana', 'ethereum', 'bitcoin', 'monero']),
    }))
    .mutation(async ({ input }) => {
      console.log(`[walletRouter] Create mutation called with input:`, JSON.stringify(input));
      return await walletService.createWallet(input);
    }),

  delete: publicProcedure
    .input(z.object({ 
        id: z.number(),
    }))
    .mutation(async ({ input }) => {
        console.log(`[walletRouter] Delete mutation called for ID: ${input.id}`);
        return await walletService.deleteWallet(input.id);
    }),

  refreshAll: publicProcedure
    .mutation(async () => {
        console.log('[walletRouter] Refresh All mutation called');
        try {
            // --- No longer forcing price cache update here ---
            
            const allWallets = await walletService.getAllWallets();
            console.log(`[walletRouter] Found ${allWallets.length} wallets to refresh.`);
            
            console.log('[walletRouter] Getting latest prices from cache...');
            // Await the prices from Redis cache
            const cachedPrices = await priceCacheService.getPrices();
            console.log('[walletRouter] Using latest cached prices:', cachedPrices);
            
            // Handle null case: provide defaults if cache is unavailable
            const defaultPrices = { btc: 0, eth: 0, sol: 0, usdc: 1, xmr: 0 };
            
            // Convert cached prices to non-nullable format, using defaults if cache is null
            const validPrices: {[key: string]: number} = {
              btc: cachedPrices?.btc ?? defaultPrices.btc,
              eth: cachedPrices?.eth ?? defaultPrices.eth,
              sol: cachedPrices?.sol ?? defaultPrices.sol,
              usdc: cachedPrices?.usdc ?? defaultPrices.usdc,
              xmr: cachedPrices?.xmr ?? defaultPrices.xmr
            };
            
            const refreshPromises = allWallets.map(wallet => 
                walletIntegrationService.updateWalletBalances(wallet.id, wallet.type, wallet.address, validPrices)
            );

            const results = await Promise.allSettled(refreshPromises);
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(`[walletRouter] Error refreshing wallet ID ${allWallets[index]?.id}:`, result.reason);
                }
            });
            
            console.log('[walletRouter] Finished refreshing all wallets.');
            return { success: true, count: allWallets.length };
        } catch (error) {
            console.error('[walletRouter] Critical error during refreshAll:', error);
            throw new Error('Failed to refresh wallets (error fetching wallets or cached prices)');
        }
    }),
    
  updateMoneroBalance: publicProcedure
    .input(z.object({
      walletId: z.number(),
      balance: z.number(),
    }))
    .mutation(async ({ input }) => {
      console.log(`[walletRouter] Update Monero balance for wallet ID ${input.walletId} with balance ${input.balance}`);
      
      let priceToUse: number | null = null;
      
      try {
        // 1. Attempt to fetch the latest XMR price
        const cryptoPrice = new CryptoPrice();
        const fetchedXmrPrice = await cryptoPrice.getMoneroPrice();
        
        // 2. Validate the fetched price
        if (fetchedXmrPrice !== null && fetchedXmrPrice > 0 && !isNaN(fetchedXmrPrice)) {
          priceToUse = fetchedXmrPrice;
          console.log(`[walletRouter] Successfully fetched live XMR price: $${priceToUse}`);
        } else {
           console.warn(`[walletRouter] Live XMR price fetch failed or returned invalid value (${fetchedXmrPrice}). Attempting to use last known price from DB.`);
           // 3. Fetch failed, try to get the last known price from the asset record
           const assets = await db.select({
                price: assetsSchema.price // Select only the price column
            })
            .from(assetsSchema)
            .where(and(eq(assetsSchema.walletId, input.walletId), eq(assetsSchema.symbol, 'XMR')))
            .limit(1);

           if (assets.length > 0 && assets[0].price) {
             const lastKnownPrice = parseFloat(assets[0].price);
             if (!isNaN(lastKnownPrice) && lastKnownPrice > 0) {
               priceToUse = lastKnownPrice;
               console.log(`[walletRouter] Using last known XMR price from DB: $${priceToUse}`);
             } else {
                console.warn(`[walletRouter] Last known XMR price in DB is invalid (${assets[0].price}). Falling back to 0.`);
                priceToUse = 0; // Fallback if DB price is also invalid
             }
           } else {
             console.warn(`[walletRouter] Could not find existing XMR asset or price in DB for wallet ${input.walletId}. Falling back to 0.`);
             priceToUse = 0; // Fallback if asset doesn't exist
           }
        }

        // 4. Update the XMR asset balance using the determined price
        // Note: updateAssetBalance handles null price by keeping the existing one,
        // but here we explicitly pass the determined price (live or last known or 0)
        await assetService.updateAssetBalance(
          input.walletId, 
          'XMR', 
          'Monero', 
          input.balance, 
          priceToUse // Pass the determined price
        );
        
        console.log(`[walletRouter] Updated XMR balance to ${input.balance} using price $${priceToUse}`);
        
        return { success: true };
      } catch (error) {
        console.error(`[walletRouter] Error updating Monero balance:`, error);
        throw new Error(`Failed to update Monero balance: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
}); 