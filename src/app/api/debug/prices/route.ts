import { NextResponse } from 'next/server';
import axios from 'axios';

// Directly fetch SOL price without any abstraction
async function fetchSolPrice() {
  try {
    // Try CoinCap
    console.log('Trying CoinCap API...');
    const coincapResponse = await axios.get('https://api.coincap.io/v2/assets/solana', {
      timeout: 10000
    });
    console.log('CoinCap response:', coincapResponse.data);
    
    if (coincapResponse.data?.data?.priceUsd) {
      return {
        source: 'coincap',
        price: parseFloat(coincapResponse.data.data.priceUsd),
        rawData: coincapResponse.data
      };
    }
  } catch (error) {
    console.error('CoinCap failed:', error);
  }
  
  try {
    // Try CoinGecko as fallback
    console.log('Trying CoinGecko API...');
    const coingeckoResponse = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { timeout: 10000 }
    );
    console.log('CoinGecko response:', coingeckoResponse.data);
    
    if (coingeckoResponse.data?.solana?.usd) {
      return {
        source: 'coingecko',
        price: coingeckoResponse.data.solana.usd,
        rawData: coingeckoResponse.data
      };
    }
  } catch (error) {
    console.error('CoinGecko failed:', error);
  }
  
  try {
    // Try Binance as last resort
    console.log('Trying Binance API...');
    const binanceResponse = await axios.get(
      'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT',
      { timeout: 10000 }
    );
    console.log('Binance response:', binanceResponse.data);
    
    if (binanceResponse.data?.price) {
      return {
        source: 'binance',
        price: parseFloat(binanceResponse.data.price),
        rawData: binanceResponse.data
      };
    }
  } catch (error) {
    console.error('Binance failed:', error);
  }
  
  return {
    source: 'none',
    price: 0,
    error: 'All price sources failed'
  };
}

export async function GET() {
  console.log('Debug price endpoint called');
  
  const solPrice = await fetchSolPrice();
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    solana: solPrice,
    message: 'Direct price check results'
  });
} 