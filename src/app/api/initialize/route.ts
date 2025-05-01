import { NextResponse } from 'next/server';
// import { PriceCacheService } from '../../../server/services/price-cache.service'; // No longer needed here

// No need to instantiate PriceCacheService globally here
// const priceCacheService = new PriceCacheService();

// console.log('[INITIALIZATION] Price cache service initialized.');

export async function GET() {
  // This route might not be strictly necessary anymore if its only purpose
  // was to initialize the price cache service background task.
  // Consider if you still need this API route.
  return NextResponse.json({
    initialized: true, 
    services: [], // Indicate no specific services initialized here
    message: 'Initialization route called.' // Updated message
  });
} 