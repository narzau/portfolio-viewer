import { ethers } from 'ethers';
import axios from 'axios'; // Removed AxiosError import

// Standard ERC20 ABI for balanceOf method
const erc20Abi = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
];

// Define the structure of the response from alchemy_getTokenBalances
interface AlchemyTokenBalanceResponse {
  jsonrpc: string;
  id: number;
  result: {
    address: string;
    tokenBalances: {
      contractAddress: string;
      tokenBalance: string | null; // Balance is hex string or null
      error: string | null;
    }[];
  };
}

// Define structure for eth_getBalance response
interface EthBalanceResponse {
  jsonrpc: string;
  id: number;
  result: string; // Hex string like "0x..."
}

export class EthereumIntegration {
  private provider: ethers.providers.JsonRpcProvider;
  private rpcUrl: string;
  
  constructor(rpcUrlInput: string = process.env.ALCHEMY_ETH_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/alcht_tthcl6mTxl4xu5ygt3stXHphwObSYo') {
    // Add logging here
    console.log('[EthereumIntegration] process.env.ALCHEMY_ETH_RPC_URL:', process.env.ALCHEMY_ETH_RPC_URL);
    console.log('[EthereumIntegration] rpcUrlInput received:', rpcUrlInput);

    // Basic check if the placeholder key is still there
    if (rpcUrlInput.includes('YOUR_API_KEY') && process.env.NODE_ENV !== 'test') {
      console.warn('WARNING: ALCHEMY_ETH_RPC_URL is not set or uses a placeholder key.');
    }
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrlInput);
    this.rpcUrl = rpcUrlInput; // Store rpcUrl if needed for direct fetch
    console.log('[EthereumIntegration] Using RPC URL:', this.rpcUrl);
  }
  
  async getEthBalance(address: string): Promise<number> {
    console.log(`[EthereumIntegration] Attempting getBalance for ${address} via axios`); // Log attempt
    try {
      // Make direct JSON-RPC call using axios
      const payload = {
        jsonrpc: "2.0",
        id: 2, // Use a different ID than USDC call
        method: "eth_getBalance",
        params: [
          address,
          "latest" // Standard block parameter for latest balance
        ]
      };

      const response = await axios.post<EthBalanceResponse>(this.rpcUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });

      const balanceHex = response.data.result;
      console.log(`[EthereumIntegration] Raw Hex balance for ${address}: ${balanceHex}`); 

      if (!balanceHex || balanceHex === '0x') { // Handle null or empty hex
          console.log(`[EthereumIntegration] Received zero or invalid hex balance for ${address}.`);
          return 0;
      }

      const balanceEth = ethers.utils.formatEther(balanceHex);
      console.log(`[EthereumIntegration] Formatted ETH Balance for ${address}: ${balanceEth}`);
      return parseFloat(balanceEth);

    } catch (error: unknown) { 
      console.error(`[EthereumIntegration] Error inside getEthBalance (axios) for ${address}:`, error instanceof Error ? error.message : error);
       if (axios.isAxiosError(error)) {
        console.error(`[EthereumIntegration] Axios error details (eth_getBalance): Status=${error.response?.status}, Data=`, error.response?.data);
      }
      // Return 0 on error
      return 0;
    }
  }
  
  async getErc20Balance(address: string, tokenAddress: string, decimals: number = 18): Promise<number> {
    try {
      const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      const balance = await contract.balanceOf(address);
      return parseFloat(ethers.utils.formatUnits(balance, decimals));
    } catch (error) {
      console.error(`Error fetching ERC20 balance for token ${tokenAddress} at address ${address}:`, error);
      // Return 0 on error
      return 0;
    }
  }
  
  async getUsdcBalance(address: string): Promise<number> {
    const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const usdcDecimals = 6;

    try {
      console.log(`Fetching USDC balance for ${address} using alchemy_getTokenBalances via axios`);
      
      // Construct the JSON-RPC request payload manually
      const payload = {
        jsonrpc: "2.0",
        id: 1, // Use a simple ID
        method: "alchemy_getTokenBalances",
        params: [
          address,
          [usdcAddress]
        ]
      };

      // Make the request using axios
      const response = await axios.post<AlchemyTokenBalanceResponse>(this.rpcUrl, payload, {
          headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json' // Often good practice
          },
          timeout: 10000 // Set a reasonable timeout (10 seconds)
      });

      // Check for JSON-RPC level errors within the response data
      if (response.data.result?.address) { // Basic check if result structure looks okay
         const alchemyResult = response.data.result;
         const usdcData = alchemyResult.tokenBalances.find(
           (token) => token.contractAddress.toLowerCase() === usdcAddress.toLowerCase()
         );

         if (usdcData?.error) {
           console.error(`Alchemy Error fetching USDC balance for ${address}: ${usdcData.error}`);
           return 0;
         }

         if (usdcData && usdcData.tokenBalance) {
           const readableBalance = ethers.utils.formatUnits(usdcData.tokenBalance, usdcDecimals);
           console.log('USDC Balance for', address, ':', readableBalance);
           return parseFloat(readableBalance);
         } else {
           console.log(`No USDC balance found for ${address} in Alchemy response.`);
           return 0;
         }
      } else {
          // Handle cases where the response structure is unexpected
          console.error(`Unexpected response structure from Alchemy for ${address}:`, response.data);
          return 0;
      }

    } catch (error: unknown) { // Catch unknown error type
        if (axios.isAxiosError(error)) {
             // Now TypeScript knows error has AxiosError properties
             console.error(`Axios error calling alchemy_getTokenBalances for USDC at address ${address}: ${error.message}`, error.response?.data);
        } else if (error instanceof Error) {
             // Handle standard JavaScript errors
             console.error(`Error calling alchemy_getTokenBalances for USDC at address ${address}: ${error.message}`);
        } else {
             // Handle other unexpected throws
             console.error(`Unexpected error calling alchemy_getTokenBalances for USDC at address ${address}:`, error);
        }
        // Fallback or return 0
        // return this.getErc20Balance(address, usdcAddress, usdcDecimals);
      return 0;
    }
  }
} 