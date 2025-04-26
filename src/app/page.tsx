'use client';

import { useState, useMemo, useEffect } from 'react';
import { trpc } from '../lib/trpc/client';
import { AssetTable } from '../components/AssetTable';
import { DashboardHeader } from '../components/DashboardHeader';

interface Asset {
  id: number;
  walletId: number;
  symbol: string;
  name: string;
  balance: string;
  price: string;
  lastUpdated: string;
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

export default function Home() {
  const [refreshError, setRefreshError] = useState<string | null>(null);

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
  
  const { data: allAssetsData, isLoading: isLoadingAssets, isFetching: isFetchingAssets } = trpc.asset.getAll.useQuery();

  const transformAssets = (dbAssets: DbAsset[] = []): Asset[] => {
    return dbAssets.map((asset: DbAsset): Asset => ({
      id: asset.id,
      walletId: asset.walletId,
      symbol: asset.symbol,
      name: asset.name,
      balance: asset.balance,
      price: asset.price || '0',
      lastUpdated: asset.lastUpdated?.toString() || new Date().toString()
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
        lastUpdated: latestUpdate.toString()
      };
      
      // Return merged BTC with other non-BTC assets
      return [...nonBtcAssets, mergedBtc];
    }
    
    // If there's only one or no BTC assets, return all assets unchanged
    return transformed;
  }, [allAssetsData]);

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
      utils.asset.getAll.invalidate(); 
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

  return (
    <main className="container mx-auto px-4 py-8">
      <DashboardHeader totalBalance={totalBalance} /> 
      
      <div className="flex flex-col gap-6 mt-8">
        <div className="w-full">
          <div className="card p-4 shadow-lg rounded-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
              <h2 className="text-xl font-bold">
                 All Assets
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshAllMutation.isPending || isRefreshing}
                  className="btn-primary px-3 py-2 rounded-md text-sm whitespace-nowrap"
                >
                  {refreshAllMutation.isPending || isRefreshing ? 'Refreshing...' : 'Refresh Balances'}
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
