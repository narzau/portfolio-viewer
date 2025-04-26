'use client';

import { useState, useMemo } from 'react';
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

  const displayedAssets = useMemo(() => transformAssets(allAssetsData), [allAssetsData]);

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
