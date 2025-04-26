import { NextResponse } from 'next/server';
import { PriceCacheService } from '../../../server/services/price-cache.service';

// Start price cache service in the background
const priceCacheService = new PriceCacheService();
priceCacheService.startBackgroundUpdate(5); // Update every 5 minutes

console.log('[INITIALIZATION] Price cache service started successfully.');

export async function GET() {
  return NextResponse.json({
    initialized: true,
    services: ['PriceCacheService'],
    message: 'Server-side services initialized successfully.'
  });
} 