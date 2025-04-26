import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { WalletService } from '../../services/wallet.service';
import { WalletIntegrationService } from '../../services/wallet-integration.service';
import { PriceCacheService } from '../../services/price-cache.service';

const walletService = new WalletService();
const walletIntegrationService = new WalletIntegrationService();
const priceCacheService = new PriceCacheService();

export const walletRouter = router({
  getAll: publicProcedure.query(async () => {
    return await walletService.getAllWallets();
  }),
  
  create: publicProcedure
    .input(z.object({
      name: z.string(),
      address: z.string(),
      type: z.enum(['solana', 'ethereum', 'bitcoin']),
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
            
            console.log('[walletRouter] Getting cached prices...');
            const cachedPrices = priceCacheService.getPrices();
            console.log('[walletRouter] Using cached prices:', cachedPrices);
            
            const refreshPromises = allWallets.map(wallet => 
                walletIntegrationService.updateWalletBalances(wallet.id, wallet.type, wallet.address, cachedPrices)
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
}); 