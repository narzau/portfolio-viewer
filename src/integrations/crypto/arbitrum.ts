import { ethers } from 'ethers';
import axios from 'axios';

// Define structure for eth_getBalance and eth_call responses
interface EthBalanceResponse {
  jsonrpc: string;
  id: number;
  result: string; // Hex string like "0x..."
}

interface EthCallResponse {
  jsonrpc: string;
  id: number;
  result: string; // Hex string result from contract call
}

export class ArbitrumIntegration {
  private provider: ethers.providers.JsonRpcProvider;
  private rpcUrl: string;

  constructor(rpcUrl: string = process.env.ALCHEMY_ARB_RPC_URL || 'https://arb1.arbitrum.io/rpc') {
    // Explicitly set network to avoid detection issues
    const network = {
      name: 'arbitrum',
      chainId: 42161,
    };
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl, network);
    this.rpcUrl = rpcUrl;
    console.log('[ArbitrumIntegration] Using RPC URL:', this.rpcUrl);
  }

  async getEthBalance(address: string): Promise<number> {
    console.log(`[ArbitrumIntegration] Attempting getBalance for ${address} via axios`);
    try {
      // Make direct JSON-RPC call using axios (similar to EthereumIntegration)
      const payload = {
        jsonrpc: "2.0",
        id: 2,
        method: "eth_getBalance",
        params: [
          address,
          "latest"
        ]
      };

      const response = await axios.post<EthBalanceResponse>(this.rpcUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      const balanceHex = response.data.result;
      console.log(`[ArbitrumIntegration] Raw Hex balance for ${address}: ${balanceHex}`);

      if (!balanceHex || balanceHex === '0x') {
        console.log(`[ArbitrumIntegration] Received zero or invalid hex balance for ${address}.`);
        return 0;
      }

      const balanceEth = ethers.utils.formatEther(balanceHex);
      console.log(`[ArbitrumIntegration] Formatted ETH Balance for ${address}: ${balanceEth}`);
      return parseFloat(balanceEth);
    } catch (error: unknown) {
      console.error(`[ArbitrumIntegration] Error inside getEthBalance (axios) for ${address}:`, error instanceof Error ? error.message : error);
      if (axios.isAxiosError(error)) {
        console.error(`[ArbitrumIntegration] Axios error details (eth_getBalance): Status=${error.response?.status}, Data=`, error.response?.data);
      }
      return 0;
    }
  }

  async getUsdcBalance(address: string): Promise<number> {
    // Arbitrum USDC address
    const usdcAddress = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    const usdcDecimals = 6;
    
    console.log(`[ArbitrumIntegration] Fetching USDC balance for ${address} via eth_call`);
    
    try {
      // Use ethers to properly encode the function call
      const iface = new ethers.utils.Interface([
        'function balanceOf(address owner) view returns (uint256)'
      ]);
      const data = iface.encodeFunctionData('balanceOf', [address]);

      console.log(`[ArbitrumIntegration] Encoded function data: ${data}`);
      console.log(`[ArbitrumIntegration] Calling USDC contract at: ${usdcAddress}`);

      const payload = {
        jsonrpc: "2.0",
        id: 3,
        method: "eth_call",
        params: [
          {
            to: usdcAddress,
            data: data
          },
          "latest"
        ]
      };

      const response = await axios.post<EthCallResponse>(this.rpcUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      const balanceHex = response.data.result;
      console.log(`[ArbitrumIntegration] Raw USDC balance hex for ${address}: ${balanceHex}`);

      if (!balanceHex || balanceHex === '0x' || balanceHex === '0x0' || balanceHex === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        console.log(`[ArbitrumIntegration] No USDC balance found for ${address} on Arbitrum.`);
        return 0;
      }

      // Parse the hex result and format with 6 decimals
      const balance = ethers.utils.formatUnits(balanceHex, usdcDecimals);
      console.log(`[ArbitrumIntegration] USDC Balance for ${address}: ${balance}`);
      return parseFloat(balance);
    } catch (error: unknown) {
      console.error(`[ArbitrumIntegration] Error fetching USDC balance for ${address}:`, error instanceof Error ? error.message : error);
      if (axios.isAxiosError(error)) {
        console.error(`[ArbitrumIntegration] Axios error details (eth_call): Status=${error.response?.status}, Data=`, error.response?.data);
      }
      return 0;
    }
  }
}

