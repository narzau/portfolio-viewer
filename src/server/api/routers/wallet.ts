import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { WalletService } from '../../services/wallet.service';
import { WalletIntegrationService } from '../../services/wallet-integration.service';
import { PriceCacheService } from '../../services/price-cache.service';
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
            const allWallets = await walletService.getAllWallets();
            console.log(`[walletRouter] Found ${allWallets.length} wallets to refresh.`);
            
            console.log('[walletRouter] Getting FRESH prices from cache service (forcing update)...');
            // Await the FRESH prices (this forces a cache update)
            const freshPrices = await priceCacheService.getFreshPrices();
            console.log('[walletRouter] Using fresh prices:', freshPrices);
            
            // Handle null case: provide defaults if cache is unavailable
            const defaultPrices = { btc: 0, eth: 0, sol: 0, usdc: 1, xmr: 0 };
            
            // Convert FRESH prices to non-nullable format
            const validPrices: {[key: string]: number} = {
              btc: freshPrices?.btc ?? defaultPrices.btc,
              eth: freshPrices?.eth ?? defaultPrices.eth,
              sol: freshPrices?.sol ?? defaultPrices.sol,
              usdc: freshPrices?.usdc ?? defaultPrices.usdc,
              xmr: freshPrices?.xmr ?? defaultPrices.xmr
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
      let fetchedFromCache = false;
      
      try {
        // 1. Try to get price from cache service first
        const cachedPrices = await priceCacheService.getPrices(); 
        if (cachedPrices?.xmr !== null && cachedPrices?.xmr !== undefined) {
           priceToUse = cachedPrices.xmr;
           fetchedFromCache = true;
           console.log(`[walletRouter] Using cached XMR price for update: $${priceToUse}`);
        } else {
          console.warn(`[walletRouter] XMR price not found or invalid in cache. Attempting to use last known price from DB.`);
          // Cache failed or missing, try to get the last known price from the asset record
          const assets = await db.select({ price: assetsSchema.price })
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

        // 2. Update the XMR asset balance using the determined price
        await assetService.updateAssetBalance(
          input.walletId, 
          'XMR', 
          'Monero', 
          input.balance, 
          priceToUse // Pass the determined price (cached or last known or 0)
        );
        
        console.log(`[walletRouter] Updated XMR balance to ${input.balance} using price $${priceToUse} (source: ${fetchedFromCache ? 'cache' : 'DB/fallback'})`);
        
        return { success: true };
      } catch (error) {
        console.error(`[walletRouter] Error updating Monero balance:`, error);
        throw new Error(`Failed to update Monero balance: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
}); 