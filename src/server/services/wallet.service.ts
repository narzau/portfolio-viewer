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
    console.log(`[WalletService] Creating new ${data.type} wallet with address: ${data.address}`);
    
    // Create the wallet record
    const newWallet = await this.repository.create(data);
    
    if (!newWallet) {
        console.error(`[WalletService] Wallet creation failed for address ${data.address}`);
        throw new Error('Failed to create wallet record');
    }
    
    console.log(`[WalletService] New wallet created with ID ${newWallet.id}`);
    
    try {
      // Get the latest prices
      const prices = this.priceCacheService.getPrices();
      console.log(`[WalletService] Fetched prices for update:`, prices);
      
      // Immediately update balances
      await this.walletIntegrationService.updateWalletBalances(
        newWallet.id,
        newWallet.type,
        newWallet.address,
        prices
      );
      
      console.log(`[WalletService] Successfully updated balances for wallet ${newWallet.id}`);
    } catch (error) {
      // Log error but don't fail wallet creation
      console.error(`[WalletService] Error updating balances for new wallet ${newWallet.id}:`, error);
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
            return { success: false, message: 'Wallet not found' };
        }

        return { success: true };
    } catch (error) {
        console.error(`[WalletService] Error deleting wallet ID ${id}:`, error);
        throw new Error(`Failed to delete wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 