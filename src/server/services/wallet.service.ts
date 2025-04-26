import { WalletRepository, WalletData } from '../repositories/wallet.repository';
import { WalletIntegrationService } from './wallet-integration.service';
import { AssetService } from './asset.service';
import { CryptoPrice } from '../../integrations/crypto/price';

export class WalletService {
  private repository: WalletRepository;
  private walletIntegrationService: WalletIntegrationService;
  private assetService: AssetService;
  private priceIntegration: CryptoPrice;

  constructor() {
    this.repository = new WalletRepository();
    this.walletIntegrationService = new WalletIntegrationService();
    this.assetService = new AssetService();
    this.priceIntegration = new CryptoPrice();
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
        // Define prices object structure
        let prices: { btc?: number | null, eth?: number | null, sol?: number | null, usdc?: number | null } = {}; 
        
        // Fetch required prices ONLY for the new wallet type
        console.log(`[WalletService] Fetching prices for new ${newWallet.type} wallet...`);
        switch (newWallet.type) {
            case 'solana':
                const [solPrice, solUsdcPrice] = await Promise.all([
                    this.priceIntegration.getSolanaPrice(),
                    this.priceIntegration.getUsdcPrice()
                ]);
                prices = { sol: solPrice, usdc: solUsdcPrice };
                break;
            case 'ethereum':
                const [ethPrice, ethUsdcPrice] = await Promise.all([
                    this.priceIntegration.getEthereumPrice(),
                    this.priceIntegration.getUsdcPrice()
                ]);
                prices = { eth: ethPrice, usdc: ethUsdcPrice };
                break;
            case 'bitcoin':
                const btcPrice = await this.priceIntegration.getBitcoinPrice();
                prices = { btc: btcPrice };
                break;
        }
        console.log(`[WalletService] Fetched prices for new ${newWallet.type} wallet:`, prices);

        // Trigger update with fetched prices (run in background)
        this.walletIntegrationService.updateWalletBalances(
          newWallet.id,
          newWallet.type,
          newWallet.address,
          prices // *** Pass the fetched prices object ***
        ).catch(error => {
             console.error(`[WalletService] Error triggering balance update for new wallet ${newWallet.id}:`, error);
        });
      } catch (error) {
         // Catch errors during price fetching
         console.error(`[WalletService] Error fetching prices or triggering balance update for new wallet ${newWallet.id}:`, error);
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