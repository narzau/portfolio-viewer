import axios from 'axios';
import * as bitcoin from 'bitcoinjs-lib';

export interface BitcoinTransaction {
  hash: string;
  time: number;
  inputs: Array<{ prev_out: { addr: string; value: number } }>;
  out: Array<{ addr: string; value: number }>;
  result: number;
}

export class BitcoinIntegration {
  private apiBaseUrl: string;
  
  constructor(apiBaseUrl: string = 'https://blockchain.info') {
    this.apiBaseUrl = apiBaseUrl;
  }
  
  async getBitcoinBalance(address: string): Promise<number> {
    try {
      // Validate the Bitcoin address
      try {
        bitcoin.address.toOutputScript(address);
      } catch {
        throw new Error('Invalid Bitcoin address');
      }
      
      // Fetch balance from a public API
      const response = await axios.get(`${this.apiBaseUrl}/balance?active=${address}`);
      
      if (response.data && response.data[address]) {
        // Convert satoshis to BTC
        return response.data[address].final_balance / 100000000;
      }
      
      return 0;
    } catch (error) {
      console.error('Error fetching BTC balance:', error);
      throw new Error('Failed to fetch BTC balance');
    }
  }
  
  async getTransactionHistory(address: string, limit: number = 10): Promise<BitcoinTransaction[]> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/rawaddr/${address}?limit=${limit}`);
      
      if (response.data && response.data.txs) {
        return response.data.txs;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      throw new Error('Failed to fetch transaction history');
    }
  }
} 