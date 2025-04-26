'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { trpc } from '../lib/trpc/client';
import { AssetTable } from '../components/AssetTable';
import { DashboardHeader } from '../components/DashboardHeader';
import { CryptoPrice } from '../integrations/crypto/price';

interface Asset {
  id: number;
  walletId: number;
  symbol: string;
  name: string;
  balance: string;
  price: string;
  lastUpdated: string;
  changePercent24h?: number;
}

interface DbAsset {
  id: number;
  walletId: number;
  symbol: string;
  name: string;
  balance: string;
  price: string | null;
  lastUpdated: Date | null;
}

const priceService = new CryptoPrice();

export default function Home() {
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [priceChanges, setPriceChanges] = useState<{[symbol: string]: number | null}>({});

  const utils = trpc.useUtils();
  
  // Initialize backend services
  useEffect(() => {
    fetch('/api/initialize')
      .then(response => response.json())
      .then(data => {
        console.log('Backend services initialized:', data);
      })
      .catch(error => {
        console.error('Failed to initialize backend services:', error);
      });
  }, []);
  
  const { data: allAssetsData, isLoading: isLoadingAssets, isFetching: isFetchingAssets } = trpc.asset.getAll.useQuery(
    undefined, 
    {
      // Force refetch every time component renders
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // Refresh data every 10 seconds
      refetchInterval: autoRefresh ? 10000 : false,
    }
  );

  // Fetch price changes directly from APIs
  const fetchPriceChanges = useCallback(async (assets: DbAsset[]) => {
    if (!assets || assets.length === 0) return;
    
    // Get unique coin IDs needed for the API
    const coinIds = Array.from(new Set(assets.map(asset => {
      // Map asset symbols to CoinCap IDs
      // This is a simple mapping for common assets - expand as needed
      const symbolMap: {[key: string]: string} = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'SOL': 'solana',
        'USDC': 'usd-coin'
      };
      return symbolMap[asset.symbol] || asset.symbol.toLowerCase();
    })));
    
    try {
      console.log('Fetching price changes for', coinIds);
      const priceData = await priceService.getMultiplePricesWithChanges(coinIds);
      
      // Convert from coin IDs back to symbols for our UI
      const symbolChanges: {[symbol: string]: number | null} = {};
      assets.forEach(asset => {
        const symbolMap: {[key: string]: string} = {
          'BTC': 'bitcoin',
          'ETH': 'ethereum',
          'SOL': 'solana',
          'USDC': 'usd-coin'
        };
        const coinId = symbolMap[asset.symbol] || asset.symbol.toLowerCase();
        
        if (priceData[coinId]) {
          symbolChanges[asset.symbol] = priceData[coinId].changePercent24Hr;
        }
      });
      
      console.log('Got price changes:', symbolChanges);
      setPriceChanges(symbolChanges);
    } catch (error) {
      console.error('Failed to fetch price changes:', error);
    }
  }, []);

  // Fetch price changes whenever assets change
  useEffect(() => {
    if (allAssetsData) {
      fetchPriceChanges(allAssetsData);
    }
  }, [allAssetsData, fetchPriceChanges]);

  // Auto refresh prices every 15 seconds
  const refreshData = useCallback(() => {
    setRefreshError(null);
    
    // Force clear the crypto price cache
    priceService.clearCache();
    console.log('Cleared price cache to force fresh data');
    
    refreshAllMutation.mutate();
    setLastRefreshed(new Date());
    
    // Also update price changes
    if (allAssetsData) {
      fetchPriceChanges(allAssetsData);
    }
  }, [allAssetsData, fetchPriceChanges]);

  // Directly fetch price data more frequently
  useEffect(() => {
    if (!autoRefresh) return;
    
    // Refresh every 10 seconds - separate from other data
    const priceInterval = setInterval(() => {
      if (allAssetsData) {
        console.log('Refreshing price data...');
        priceService.clearCache(); // Force clear cache
        fetchPriceChanges(allAssetsData);
      }
    }, 10000);
    
    return () => clearInterval(priceInterval);
  }, [autoRefresh, allAssetsData, fetchPriceChanges]);
  
  // Set up main auto-refresh for all data
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      console.log('Auto-refreshing all data...');
      refreshData();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [autoRefresh, refreshData]);

  const transformAssets = (dbAssets: DbAsset[] = []): Asset[] => {
    return dbAssets.map((asset: DbAsset): Asset => ({
      id: asset.id,
      walletId: asset.walletId,
      symbol: asset.symbol,
      name: asset.name,
      balance: asset.balance,
      price: asset.price || '0',
      lastUpdated: asset.lastUpdated?.toString() || new Date().toString(),
      changePercent24h: priceChanges[asset.symbol] || undefined
    }));
  };

  // Merge Bitcoin wallets into a single asset
  const processedAssets = useMemo(() => {
    if (!allAssetsData) return [];
    
    const transformed = transformAssets(allAssetsData);
    
    // Group Bitcoin assets together
    const btcAssets = transformed.filter(asset => asset.symbol === 'BTC');
    const nonBtcAssets = transformed.filter(asset => asset.symbol !== 'BTC');
    
    // If there are multiple BTC assets, merge them
    if (btcAssets.length > 1) {
      console.log(`Merging ${btcAssets.length} Bitcoin wallets`);
      
      // Calculate total BTC balance
      let totalBtcBalance = 0;
      let latestUpdate = new Date(0);
      let priceToUse = '0';
      const changePercent = btcAssets[0].changePercent24h;
      
      for (const btc of btcAssets) {
        totalBtcBalance += parseFloat(btc.balance);
        const updateDate = new Date(btc.lastUpdated);
        
        // Keep the latest price and update time
        if (updateDate > latestUpdate) {
          latestUpdate = updateDate;
          priceToUse = btc.price;
        }
      }
      
      // Create a merged BTC asset (using the first BTC asset's ID and walletId for reference)
      const mergedBtc: Asset = {
        id: btcAssets[0].id,
        walletId: -1, // Special walletId to indicate merged asset
        symbol: 'BTC',
        name: 'Bitcoin (Merged)',
        balance: totalBtcBalance.toString(),
        price: priceToUse,
        lastUpdated: latestUpdate.toString(),
        changePercent24h: changePercent
      };
      
      // Return merged BTC with other non-BTC assets
      return [...nonBtcAssets, mergedBtc];
    }
    
    // If there's only one or no BTC assets, return all assets unchanged
    return transformed;
  }, [allAssetsData, priceChanges]);

  const displayedAssets = processedAssets;

  const totalBalance = useMemo(() => displayedAssets?.reduce((sum: number, asset: Asset) => {
      const balance = parseFloat(asset.balance);
      const price = parseFloat(asset.price);
      return sum + (isNaN(balance) || isNaN(price) ? 0 : balance * price);
  }, 0) || 0, [displayedAssets]); 
  
  const isLoadingDisplayedAssets = isLoadingAssets; 
  const isRefreshing = isFetchingAssets;

  const refreshAllMutation = trpc.wallet.refreshAll.useMutation({
    onSuccess: (data) => {
      console.log(`Refresh successful, updated ${data?.count} wallets.`);
      setRefreshError(null);
      // Force the cache to be invalidated
      utils.asset.getAll.invalidate();
      setLastRefreshed(new Date());
      
      // Also update price changes
      if (allAssetsData) {
        fetchPriceChanges(allAssetsData);
      }
    },
    onError: (error) => {
      console.error("Error refreshing wallets:", error);
      setRefreshError(`Failed to refresh: ${error.message}`);
    },
  });

  const handleRefresh = () => {
    setRefreshError(null);
    refreshAllMutation.mutate();
  };

  // Format last refresh time
  const formattedLastRefresh = lastRefreshed.toLocaleTimeString();

  // Log transformed assets for debugging
  useEffect(() => {
    if (processedAssets && processedAssets.length > 0) {
      console.log('Displaying assets with prices:', 
        processedAssets.map(a => ({ 
          symbol: a.symbol, 
          price: a.price,
          change: a.changePercent24h
        }))
      );
    }
  }, [processedAssets]);

  return (
    <main className="container mx-auto px-4 py-8">
      <DashboardHeader totalBalance={totalBalance} /> 
      
      <div className="flex flex-col gap-6 mt-8">
        <div className="w-full">
          <div className="card p-4 shadow-lg rounded-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  All Assets
                </h2>
                <p className="text-xs text-gray-500">
                  Last updated: {formattedLastRefresh}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center mr-2">
                  <input
                    type="checkbox"
                    id="autoRefresh"
                    checked={autoRefresh}
                    onChange={() => setAutoRefresh(!autoRefresh)}
                    className="mr-1"
                  />
                  <label htmlFor="autoRefresh" className="text-sm">Auto-refresh</label>
                </div>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshAllMutation.isPending || isRefreshing}
                  className="btn-primary px-3 py-2 rounded-md text-sm whitespace-nowrap"
                >
                  {refreshAllMutation.isPending || isRefreshing ? 'Refreshing...' : 'Refresh Now'}
                </button>
              </div>
            </div>
            {refreshError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {refreshError}
              </div>
            )}
            
            <AssetTable
              assets={displayedAssets} 
              isLoading={isLoadingDisplayedAssets}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
