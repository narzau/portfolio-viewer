import { AssetService } from './asset.service';
import { SolanaIntegration } from '../../integrations/crypto/solana';
import { EthereumIntegration } from '../../integrations/crypto/ethereum';
import { BitcoinIntegration } from '../../integrations/crypto/bitcoin';
import { CryptoPrice } from '../../integrations/crypto/price';

export class WalletIntegrationService {
  private assetService: AssetService;
  private solanaIntegration: SolanaIntegration;
  private ethereumIntegration: EthereumIntegration;
  private bitcoinIntegration: BitcoinIntegration;
  private cryptoPrice: CryptoPrice;
  
  constructor() {
    this.assetService = new AssetService();
    this.solanaIntegration = new SolanaIntegration();
    this.ethereumIntegration = new EthereumIntegration();
    this.bitcoinIntegration = new BitcoinIntegration();
    this.cryptoPrice = new CryptoPrice();
  }
  
  // Update wallet balances based on type
  async updateWalletBalances(walletId: number, walletType: string, address: string, prices: {[key: string]: number}) {
    console.log(`[WalletIntegrationService] Updating balances for wallet ID ${walletId} (${walletType}): ${address}`);
    
    try {
      if (walletType === 'solana') {
        return await this.updateSolanaWallet(walletId, address, prices);
      } else if (walletType === 'ethereum') {
        return await this.updateEthereumWallet(walletId, address, prices);
      } else if (walletType === 'bitcoin') {
        return await this.updateBitcoinWallet(walletId, address, prices);
      } else if (walletType === 'monero') {
        // For Monero wallets, we don't auto-update balances since they're manually set
        // Just refresh price for existing Monero assets
        return await this.refreshMoneroWallet(walletId, prices);
      } else {
        throw new Error(`Unsupported wallet type: ${walletType}`);
      }
    } catch (error) {
      console.error(`[WalletIntegrationService] Error updating wallet ${walletId}:`, error);
      throw error;
    }
  }
  
  // Update Solana wallet
  private async updateSolanaWallet(walletId: number, address: string, prices: {[key: string]: number}) {
    try {
      // Get SOL balance
      const solBalance = await this.solanaIntegration.getSolBalance(address);
      await this.assetService.updateAssetBalance(walletId, 'SOL', 'Solana', solBalance, prices['sol'] ?? 0);
      
      // Get USDC balance
      const usdcBalance = await this.solanaIntegration.getUsdcBalance(address);
      await this.assetService.updateAssetBalance(walletId, 'USDC', 'USD Coin (Solana)', usdcBalance, prices['usdc'] ?? 1);
    } catch (error) {
      console.error(`[WalletIntegrationService] Error updating Solana wallet:`, error);
    }
  }
  
  // Update Ethereum wallet
  private async updateEthereumWallet(walletId: number, address: string, prices: {[key: string]: number}) {
    try {
      // Get ETH balance
      const ethBalance = await this.ethereumIntegration.getEthBalance(address);
      await this.assetService.updateAssetBalance(walletId, 'ETH', 'Ethereum', ethBalance, prices['eth'] ?? 0);
      
      // Get USDC balance
      const usdcBalance = await this.ethereumIntegration.getUsdcBalance(address);
      await this.assetService.updateAssetBalance(walletId, 'USDC', 'USD Coin (ERC20)', usdcBalance, prices['usdc'] ?? 1);
    } catch (error) {
      console.error(`[WalletIntegrationService] Error updating Ethereum wallet:`, error);
    }
  }
  
  // Update Bitcoin wallet
  private async updateBitcoinWallet(walletId: number, address: string, prices: {[key: string]: number}) {
    try {
      // Get BTC balance
      const btcBalance = await this.bitcoinIntegration.getBitcoinBalance(address);
      await this.assetService.updateAssetBalance(walletId, 'BTC', 'Bitcoin', btcBalance, prices['btc'] ?? 0);
    } catch (error) {
      console.error(`[WalletIntegrationService] Error updating Bitcoin wallet:`, error);
    }
  }

  private async refreshMoneroWallet(walletId: number, prices: {[key: string]: number | null}): Promise<void> {
    console.log(`[WalletIntegrationService] Refreshing Monero wallet ${walletId} prices`);
    
    try {
      // Get XMR price directly from the passed-in (cached) prices
      // Use optional chaining and nullish coalescing
      const xmrPrice = prices?.xmr ?? null; // Get XMR price or null
      
      if (xmrPrice !== null && xmrPrice > 0 && !isNaN(xmrPrice)) {
         console.log(`[WalletIntegrationService] Using XMR price from input: $${xmrPrice}`);
         // Update the XMR asset price for this specific wallet
         await this.assetService.updateAssetPriceByWallet(walletId, 'XMR', xmrPrice);
         console.log(`[WalletIntegrationService] Updated XMR asset price for wallet ${walletId} to $${xmrPrice}`);
      } else {
         console.warn(`[WalletIntegrationService] No valid XMR price found in input prices for wallet ${walletId}. Price will not be updated.`);
         // Do not update the price if a valid one wasn't provided via the cache
         // The asset will retain its last known price from the DB.
      }

    } catch (error) {
      console.error(`[WalletIntegrationService] Error refreshing Monero wallet ${walletId}:`, error);
      // Don't re-throw here to allow other wallet refreshes to proceed
      // throw error; 
    }
  }
} 