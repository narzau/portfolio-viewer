import { SolanaIntegration } from '../../integrations/crypto/solana';
import { EthereumIntegration } from '../../integrations/crypto/ethereum';
import { BitcoinIntegration } from '../../integrations/crypto/bitcoin';
import { AssetService } from './asset.service';

// Interface for passed-in prices (can reuse or redefine if needed)
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
  
  // Accept pre-fetched prices
  async updateWalletBalances(walletId: number, walletType: string, address: string, prices: FetchedPrices) {
    console.log(`[WalletIntegrationService] updateWalletBalances called for walletId: ${walletId}, type: ${walletType}, using CACHED prices`);
    try {
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
            console.error(`[WalletIntegrationService] Unsupported wallet type: ${walletType} for walletId: ${walletId}`);
        }
        console.log(`[WalletIntegrationService] Finished updateWalletBalances for walletId: ${walletId}`);
    } catch (error) {
        console.error(`[WalletIntegrationService] Error during updateWalletBalances for walletId ${walletId} (${walletType}):`, error);
    }
  }
  
  // Accept pre-fetched SOL and USDC prices
  private async updateSolanaWallet(walletId: number, address: string, solPrice: number | null | undefined, usdcPrice: number | null | undefined) {
    console.log(`[WalletIntegrationService] Updating Solana wallet ${walletId} using cached prices`);
    const solBalance = await this.solanaIntegration.getSolBalance(address);
    // Use passed price
    await this.assetService.updateAssetBalance(walletId, 'SOL', 'Solana', solBalance, solPrice ?? null);
    
    const usdcBalance = await this.solanaIntegration.getUsdcBalance(address);
    // Use passed price
    await this.assetService.updateAssetBalance(walletId, 'USDC', 'USD Coin (Solana)', usdcBalance, usdcPrice ?? null);
    console.log(`[WalletIntegrationService] Solana wallet ${walletId} update complete.`);
  }
  
  // Accept pre-fetched ETH and USDC prices
  private async updateEthereumWallet(walletId: number, address: string, ethPrice: number | null | undefined, usdcPrice: number | null | undefined) {
    console.log(`[WalletIntegrationService] Updating Ethereum wallet ${walletId} using cached prices`);
    const ethBalance = await this.ethereumIntegration.getEthBalance(address);
    // Use passed price
    await this.assetService.updateAssetBalance(walletId, 'ETH', 'Ethereum', ethBalance, ethPrice ?? null);
    
    const usdcBalance = await this.ethereumIntegration.getUsdcBalance(address);
    // Use passed price
    await this.assetService.updateAssetBalance(walletId, 'USDC', 'USD Coin (ERC20)', usdcBalance, usdcPrice ?? null);
    console.log(`[WalletIntegrationService] Ethereum wallet ${walletId} update complete.`);
  }
  
  // Accept pre-fetched BTC price
  private async updateBitcoinWallet(walletId: number, address: string, btcPrice: number | null | undefined) {
    console.log(`[WalletIntegrationService] Updating Bitcoin wallet ${walletId} using cached price`);
    const btcBalance = await this.bitcoinIntegration.getBitcoinBalance(address);
    // Use passed price
    await this.assetService.updateAssetBalance(walletId, 'BTC', 'Bitcoin', btcBalance, btcPrice ?? null);
    console.log(`[WalletIntegrationService] Bitcoin wallet ${walletId} update complete.`);
  }
} 