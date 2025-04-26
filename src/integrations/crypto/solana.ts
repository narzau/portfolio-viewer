import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export class SolanaIntegration {
  private connection: Connection;
  
  constructor(rpcUrl: string = 'https://api.mainnet-beta.solana.com') {
    this.connection = new Connection(rpcUrl);
  }
  
  async getSolBalance(address: string): Promise<number> {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Error fetching SOL balance:', error);
      throw new Error('Failed to fetch SOL balance');
    }
  }
  
  async getSplTokenBalance(address: string, tokenMint: string): Promise<number> {
    try {
      // For USDC on Solana: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        new PublicKey(address),
        { mint: new PublicKey(tokenMint) }
      );
      
      if (tokenAccounts.value.length === 0) {
        return 0;
      }
      
      // Get the token balance from the first account
      const tokenBalance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
      
      return Number(tokenBalance.uiAmount);
    } catch (error) {
      console.error('Error fetching SPL token balance:', error);
      throw new Error('Failed to fetch SPL token balance');
    }
  }
  
  async getUsdcBalance(address: string): Promise<number> {
    // USDC token mint address on Solana
    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    return this.getSplTokenBalance(address, usdcMint);
  }
} 