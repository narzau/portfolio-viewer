import { SolanaIntegration } from '../../integrations/crypto/solana';
import { EthereumIntegration } from '../../integrations/crypto/ethereum';
import { BitcoinIntegration } from '../../integrations/crypto/bitcoin';
import { AssetService } from './asset.service';

// Simple interface for passed-in prices
interface FetchedPrices {
    btc?: number | null;
    eth?: number | null;
    sol?: number | null;
    usdc?: number | null;
}

export class WalletIntegrationService {
  private solanaIntegration: SolanaIntegration;
  private ethereumIntegration: EthereumIntegration;
  private bitcoinIntegration: BitcoinIntegration;
  private assetService: AssetService;
  
  constructor() {
    this.solanaIntegration = new SolanaIntegration();
    this.ethereumIntegration = new EthereumIntegration();
    this.bitcoinIntegration = new BitcoinIntegration();
    this.assetService = new AssetService();
  }
  
  // Update wallet balances based on type
  async updateWalletBalances(walletId: number, walletType: string, address: string, prices: FetchedPrices) {
    console.log(`[WalletIntegrationService] Updating ${walletType} wallet ${walletId} (${address})`);
    
    switch (walletType) {
      case 'solana':
        await this.updateSolanaWallet(walletId, address, prices.sol, prices.usdc);
        break;
      case 'ethereum':
        await this.updateEthereumWallet(walletId, address, prices.eth, prices.usdc);
        break;
      case 'bitcoin':
        await this.updateBitcoinWallet(walletId, address, prices.btc);
        break;
      default:
        console.error(`[WalletIntegrationService] Unsupported wallet type: ${walletType}`);
    }
    
    console.log(`[WalletIntegrationService] Finished updating ${walletType} wallet ${walletId}`);
  }
  
  // Update Solana wallet
  private async updateSolanaWallet(walletId: number, address: string, solPrice: number | null | undefined, usdcPrice: number | null | undefined) {
    try {
      // Get SOL balance
      const solBalance = await this.solanaIntegration.getSolBalance(address);
      await this.assetService.updateAssetBalance(walletId, 'SOL', 'Solana', solBalance, solPrice ?? 0);
      
      // Get USDC balance
      const usdcBalance = await this.solanaIntegration.getUsdcBalance(address);
      await this.assetService.updateAssetBalance(walletId, 'USDC', 'USD Coin (Solana)', usdcBalance, usdcPrice ?? 1);
    } catch (error) {
      console.error(`[WalletIntegrationService] Error updating Solana wallet:`, error);
    }
  }
  
  // Update Ethereum wallet
  private async updateEthereumWallet(walletId: number, address: string, ethPrice: number | null | undefined, usdcPrice: number | null | undefined) {
    try {
      // Get ETH balance
      const ethBalance = await this.ethereumIntegration.getEthBalance(address);
      await this.assetService.updateAssetBalance(walletId, 'ETH', 'Ethereum', ethBalance, ethPrice ?? 0);
      
      // Get USDC balance
      const usdcBalance = await this.ethereumIntegration.getUsdcBalance(address);
      await this.assetService.updateAssetBalance(walletId, 'USDC', 'USD Coin (ERC20)', usdcBalance, usdcPrice ?? 1);
    } catch (error) {
      console.error(`[WalletIntegrationService] Error updating Ethereum wallet:`, error);
    }
  }
  
  // Update Bitcoin wallet
  private async updateBitcoinWallet(walletId: number, address: string, btcPrice: number | null | undefined) {
    try {
      // Get BTC balance
      const btcBalance = await this.bitcoinIntegration.getBitcoinBalance(address);
      await this.assetService.updateAssetBalance(walletId, 'BTC', 'Bitcoin', btcBalance, btcPrice ?? 0);
    } catch (error) {
      console.error(`[WalletIntegrationService] Error updating Bitcoin wallet:`, error);
    }
  }
} 