import { WalletRepository, WalletData } from '../repositories/wallet.repository';
import { WalletIntegrationService } from './wallet-integration.service';
import { AssetService } from './asset.service';
import { PriceCacheService } from './price-cache.service';

export class WalletService {
  private repository: WalletRepository;
  private walletIntegrationService: WalletIntegrationService;
  private assetService: AssetService;
  private priceCacheService: PriceCacheService;

  constructor() {
    this.repository = new WalletRepository();
    this.walletIntegrationService = new WalletIntegrationService();
    this.assetService = new AssetService();
    this.priceCacheService = new PriceCacheService();
  }

  async getAllWallets() {
    return await this.repository.findAll();
  }

  async getWalletById(id: number) {
    const wallet = await this.repository.findById(id);
    if (!wallet) {
      throw new Error(`Wallet with id ${id} not found`);
    }
    
    const assets = await this.repository.findWalletAssets(id);
    
    return {
      wallet,
      assets
    };
  }

  async createWallet(data: WalletData) {
    const newWallet = await this.repository.create(data);
    
    if (newWallet) {
      console.log(`[WalletService] New wallet created (ID: ${newWallet.id}). Triggering balance update.`);
      try {
        // Get prices from the CACHE
        const cachedPrices = this.priceCacheService.getPrices();
        console.log(`[WalletService] Using cached prices for new ${newWallet.type} wallet:`, cachedPrices);

        // Extract relevant prices for the new wallet type
        let pricesToUse: { btc?: number | null, eth?: number | null, sol?: number | null, usdc?: number | null } = {};
        switch (newWallet.type) {
            case 'solana':
                pricesToUse = { sol: cachedPrices.sol, usdc: cachedPrices.usdc };
                break;
            case 'ethereum':
                pricesToUse = { eth: cachedPrices.eth, usdc: cachedPrices.usdc };
                break;
            case 'bitcoin':
                pricesToUse = { btc: cachedPrices.btc };
                break;
        }

        // Trigger update with CACHED prices (run in background)
        this.walletIntegrationService.updateWalletBalances(
          newWallet.id,
          newWallet.type,
          newWallet.address,
          pricesToUse // Pass the relevant cached prices
        ).catch(error => {
             console.error(`[WalletService] Error triggering balance update for new wallet ${newWallet.id}:`, error);
        });
      } catch (error) {
         // Catch errors during price retrieval or triggering update
         console.error(`[WalletService] Error processing balance update for new wallet ${newWallet.id}:`, error);
      }
    } else {
        console.error(`[WalletService] Wallet creation seemed to succeed but returned no data.`);
    }
    
    return newWallet; 
  }

  async deleteWallet(id: number) {
    console.log(`[WalletService] Attempting to delete wallet ID: ${id}`);
    try {
        // 1. Delete associated assets
        console.log(`[WalletService] Deleting assets for wallet ID: ${id}`);
        await this.assetService.deleteAssetsByWalletId(id);
        console.log(`[WalletService] Finished deleting assets for wallet ID: ${id}`);

        // 2. Delete the wallet itself
        console.log(`[WalletService] Deleting wallet record for ID: ${id}`);
        const result = await this.repository.deleteById(id);
        console.log(`[WalletService] Wallet deletion result for ID ${id}:`, result);
        
        // Check if wallet was actually deleted
        if (result.length === 0) {
            console.warn(`[WalletService] Wallet with ID ${id} not found for deletion.`);
            // throw new Error(`Wallet with id ${id} not found`); // Optionally throw error
            return { success: false, message: 'Wallet not found' };
        }

        return { success: true };
    } catch (error) {
        console.error(`[WalletService] Error deleting wallet ID ${id}:`, error);
        // Re-throw or return error status
        throw new Error(`Failed to delete wallet: ${error instanceof Error ? error.message : String(error)}`);
        // return { success: false, message: 'Failed to delete wallet' };
    }
  }
} 