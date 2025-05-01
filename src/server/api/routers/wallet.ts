import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { WalletService } from '../../services/wallet.service';
import { WalletIntegrationService } from '../../services/wallet-integration.service';
import { PriceCacheService } from '../../services/price-cache.service';
import { CryptoPrice } from '../../../integrations/crypto/price';
import { AssetService } from '../../services/asset.service';

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
            
            console.log('[walletRouter] Getting cached prices...');
            const cachedPrices = priceCacheService.getPrices();
            console.log('[walletRouter] Using cached prices:', cachedPrices);
            
            // Convert cached prices to non-nullable format
            const validPrices: {[key: string]: number} = {
              btc: cachedPrices.btc ?? 0,
              eth: cachedPrices.eth ?? 0,
              sol: cachedPrices.sol ?? 0,
              usdc: cachedPrices.usdc ?? 1,
              xmr: cachedPrices.xmr ?? 0
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
      
      try {
        // Get the wallet
        const wallet = await walletService.getWalletById(input.walletId);
        
        if (!wallet || wallet.wallet.type !== 'monero') {
          throw new Error('Invalid wallet or not a Monero wallet');
        }
        
        // Get current XMR price
        const cryptoPrice = new CryptoPrice();
        const xmrPrice = await cryptoPrice.getMoneroPrice();
        
        // Update the XMR asset balance
        await assetService.updateAssetBalance(
          input.walletId, 
          'XMR', 
          'Monero', 
          input.balance, 
          xmrPrice
        );
        
        console.log(`[walletRouter] Updated XMR balance to ${input.balance} with price $${xmrPrice}`);
        
        return { success: true };
      } catch (error) {
        console.error(`[walletRouter] Error updating Monero balance:`, error);
        throw new Error(`Failed to update Monero balance: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
}); 