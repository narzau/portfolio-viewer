import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export class SolanaIntegration {
  private connection: Connection;
  
  constructor() {
    // Use just one reliable RPC endpoint
    this.connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    console.log(`[SolanaIntegration] Initialized with Solana mainnet API`);
  }
  
  async getSolBalance(address: string): Promise<number> {
    console.log(`[SolanaIntegration] Getting SOL balance for address: ${address}`);
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      console.log(`[SolanaIntegration] SOL balance: ${solBalance}`);
      return solBalance;
    } catch (error) {
      console.error(`[SolanaIntegration] Error fetching SOL balance:`, error);
      return 0;
    }
  }
  
  async getSplTokenBalance(address: string, tokenMint: string): Promise<number> {
    console.log(`[SolanaIntegration] Getting SPL token (${tokenMint}) balance for address: ${address}`);
    try {
      const publicKey = new PublicKey(address);
      const mintKey = new PublicKey(tokenMint);
      
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        publicKey,
        { mint: mintKey }
      );
      
      console.log(`[SolanaIntegration] Found ${tokenAccounts.value.length} token accounts for mint ${tokenMint}`);
      
      if (tokenAccounts.value.length === 0) {
        console.log(`[SolanaIntegration] No token accounts found for ${tokenMint}, returning 0`);
        return 0;
      }
      
      // Get the token balance from the first account
      const tokenBalance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
      const uiAmount = Number(tokenBalance.uiAmount);
      
      console.log(`[SolanaIntegration] Token ${tokenMint} balance: ${uiAmount}`);
      return uiAmount;
    } catch (error) {
      console.error(`[SolanaIntegration] Error fetching SPL token balance:`, error);
      return 0;
    }
  }
  
  async getUsdcBalance(address: string): Promise<number> {
    // USDC token mint address on Solana
    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    return this.getSplTokenBalance(address, usdcMint);
  }
} 