import { NextRequest, NextResponse } from 'next/server';

// Map of crypto symbols to their respective image URLs
// Source: https://cryptologos.cc/
// Keep this in sync with the frontend component if necessary
const cryptoIcons: Record<string, string> = {
  'btc': 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg',
  'eth': 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
  'sol': 'https://cryptologos.cc/logos/solana-sol-logo.svg',
  'xmr': 'https://cryptologos.cc/logos/monero-xmr-logo.svg',
  'usdc': 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg',
  'usdt': 'https://cryptologos.cc/logos/tether-usdt-logo.svg',
  // Add more symbols and URLs as needed
};

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol.toLowerCase().replace('.svg', ''); // Extract symbol from route
  const logoUrl = cryptoIcons[symbol];

  if (!logoUrl) {
    return new NextResponse('Logo not found', { status: 404 });
  }

  try {
    const response = await fetch(logoUrl, {
      headers: {
        // Optional: Add headers if needed, e.g., User-Agent
        'User-Agent': 'PortfolioViewer/1.0',
      },
      cache: 'force-cache', // Cache fetched logos aggressively
    });

    if (!response.ok) {
      console.error(`Failed to fetch logo from ${logoUrl}: ${response.statusText}`);
      return new NextResponse('Failed to fetch logo', { status: response.status });
    }

    // Get the SVG content
    const svgContent = await response.text();

    // Return the SVG content with the correct content type
    return new NextResponse(svgContent, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error(`Error proxying logo for ${symbol}:`, error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 