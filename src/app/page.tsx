'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { trpc } from '../lib/trpc/client';
import { AssetTable, Asset } from '../components/AssetTable';

// Import Asset type from AssetTable to ensure type consistency

interface DbAsset {
  id: number;
  walletId: number;
  symbol: string;
  name: string;
  balance: string;
  price: string | null;
  lastUpdated: Date | null;
}

// Add a MoneroBalanceModal component
interface MoneroBalanceModalProps {
  walletId: number;
  currentBalance: string;
  walletName: string;
  onClose: () => void;
  onUpdate: () => void;
}

function MoneroBalanceModal({ walletId, currentBalance, walletName, onClose, onUpdate }: MoneroBalanceModalProps) {
  const [balance, setBalance] = useState(currentBalance);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMoneroMutation = trpc.wallet.updateMoneroBalance.useMutation({
    onSuccess: () => {
      setIsUpdating(false);
      setError(null);
      onUpdate();
      onClose();
    },
    onError: (error) => {
      setIsUpdating(false);
      setError(error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setError(null);
    
    const numericBalance = parseFloat(balance);
    
    if (isNaN(numericBalance) || numericBalance < 0) {
      setIsUpdating(false);
      setError('Please enter a valid positive number');
      return;
    }
    
    updateMoneroMutation.mutate({
      walletId,
      balance: numericBalance
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center mb-4">
          <span className="text-3xl mr-3">🔒</span>
          <h3 className="text-xl font-bold">Update XMR Balance: {walletName}</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4 pl-1">
          Due to Monero&apos;s privacy features, balances need to be updated manually.
        </p>
        
        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4">
            <div className="flex items-center">
              <span className="text-xl mr-2">⚠️</span>
              {error}
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">XMR Balance</label>
            <input
              type="text"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-600 dark:focus:border-blue-600 bg-white dark:bg-gray-700"
              placeholder="Enter XMR amount"
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-700 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isUpdating ? 'Updating...' : 'Update Balance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Interface for the expected structure of items in CoinGecko API response array
interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  // Add other fields if needed
}

export default function Home() {
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [priceChanges, setPriceChanges] = useState<{[symbol: string]: number | null}>({});
  const [updateMoneroWallet, setUpdateMoneroWallet] = useState<Pick<Asset, 'balance' | 'name' | 'walletId'> & { id: number } | null>(null);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [createWalletError, setCreateWalletError] = useState<string | null>(null);

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
      // Refresh data less frequently (e.g., every 30 seconds)
      refetchInterval: autoRefresh ? 30000 : false,
    }
  );

  const { data: allWallets } = trpc.wallet.getAll.useQuery();

  // Fetch price changes directly from CoinGecko API
  const fetchPriceChanges = useCallback(async (assets: DbAsset[]) => {
    if (!assets || assets.length === 0) {
      setPriceChanges({}); // Clear changes if no assets
      return;
    }
    
    // Map asset symbols to CoinGecko IDs (often the same as CoinCap for major coins)
    const symbolMap: {[key: string]: string} = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'SOL': 'solana',
      'USDC': 'usd-coin',
      'XMR': 'monero'
      // Verify/add other mappings here if needed
    };
    
    // Create a reverse map for easier lookup later
    const idToSymbolMap: {[key: string]: string} = {};
    assets.forEach(asset => {
        const coinId = symbolMap[asset.symbol] || asset.symbol.toLowerCase();
        // Only add if we have a mapping (don't query for unknown IDs)
        if (symbolMap[asset.symbol]) { 
          idToSymbolMap[coinId] = asset.symbol;
        }
    });
    
    const uniqueCoinGeckoIds = Object.keys(idToSymbolMap);

    if (uniqueCoinGeckoIds.length === 0) {
      setPriceChanges({});
      return;
    }

    // Use CoinGecko API endpoint
    const apiUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${uniqueCoinGeckoIds.join(',')}`;
    console.log('Fetching price changes from CoinGecko:', apiUrl);

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        // Don't update state on HTTP error, keep last known values
        console.error(`CoinGecko API request failed: ${response.statusText} (Status: ${response.status})`);
        return; // Exit the function early
      }
      
      const result: CoinGeckoMarketData[] = await response.json();
      
      if (!Array.isArray(result)) {
          // Don't update state on invalid structure, keep last known values
          console.warn('CoinGecko response was not an array', result);
          return; // Exit the function early
      }
      
      // If result is an empty array, we also effectively do nothing, keeping old state
      if (result.length === 0) {
          console.log('CoinGecko returned empty array, keeping previous price changes.');
          return; // Exit early
      }

      // Update state by merging new results with previous state
      setPriceChanges(prevChanges => {
          const newChanges = { ...prevChanges }; // Create a copy of the previous state
          
          result.forEach((coinData: CoinGeckoMarketData) => {
              const coinId = coinData.id;
              const symbol = idToSymbolMap[coinId]; 
              if (symbol) {
                  const changeNum = coinData.price_change_percentage_24h;
                  // Only update if the new value is a valid number
                  if (changeNum !== null && !isNaN(changeNum)) {
                      newChanges[symbol] = changeNum;
                  } else {
                      // Optional: Log if we received null/NaN but are keeping the old value
                      // console.log(`Keeping previous % change for ${symbol} as CoinGecko returned: ${changeNum}`);
                  }
              } else {
                  console.warn(`Could not map CoinGecko id ${coinId} back to a symbol.`);
              }
          });

          console.log('Updated price changes from CoinGecko:', newChanges);
          return newChanges; // Return the updated state object
      });
      
    } catch (error) {
      // Also don't update state on fetch/network error
      console.error('Failed to fetch price changes from CoinGecko (network/fetch error):', error);
      // No state update here, keep last known values
    }
  }, []); 

  // Fetch price changes whenever assets change (or on initial load)
  useEffect(() => {
    if (allAssetsData) {
      fetchPriceChanges(allAssetsData);
    }
  }, [allAssetsData, fetchPriceChanges]); // Keep fetchPriceChanges dependency

  // Directly fetch price change data LESS frequently
  useEffect(() => {
    if (!autoRefresh || !allAssetsData) return; // Ensure assets are loaded
    
    // Initial fetch is handled by the effect depending on allAssetsData
    // fetchPriceChanges(allAssetsData);

    // Refresh % change data less often (e.g., every 60 seconds)
    console.log('Setting up 60s interval for price change refresh...');
    const priceInterval = setInterval(() => {
      console.log('Refreshing price change data (60s interval)...');
      // We still need allAssetsData here to know *which* assets to fetch changes for
      if (allAssetsData) { 
        fetchPriceChanges(allAssetsData);
      }
      
    }, 60000); // Refresh every 60 seconds
    
    return () => {
      console.log('Clearing price change interval.');
      clearInterval(priceInterval);
    };
  }, [autoRefresh, allAssetsData, fetchPriceChanges]);
  
  const transformAssets = (dbAssets: DbAsset[] = []): Asset[] => {
    return dbAssets.map((asset: DbAsset): Asset => ({
      id: asset.id,
      walletId: asset.walletId,
      symbol: asset.symbol,
      name: asset.name,
      balance: asset.balance,
      price: asset.price || '0',
      lastUpdated: asset.lastUpdated?.toString() || new Date().toString(),
      changePercent24h: priceChanges[asset.symbol] || undefined,
      uniqueId: `asset-${asset.id}`
    }));
  };

  // Find Monero wallets and add "Update Balance" action
  const handleUpdateMoneroBalance = (asset: Asset) => {
    // Ensure we only proceed if the asset ID is a number (i.e., not a merged asset)
    if (!allWallets || typeof asset.id !== 'number') return;
    
    const wallet = allWallets.find(w => w.id === asset.walletId);
    if (wallet && wallet.type === 'monero') {
      // Now we know asset.id is a number
      setUpdateMoneroWallet({
        id: asset.id, 
        balance: asset.balance,
        name: wallet.name, // Get name from wallet
        walletId: asset.walletId
      });
    }
  };

  // Function to check if an asset belongs to a Monero wallet
  const isMoneroWalletAsset = (asset: Asset): boolean => {
    if (!allWallets) return false;
    const wallet = allWallets.find(w => w.id === asset.walletId);
    return wallet?.type === 'monero' || false;
  };

  // Merge Bitcoin wallets into a single asset
  const processedAssets = useMemo((): Asset[] => {
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
        walletId: -1,
        symbol: 'BTC',
        name: 'Bitcoin (Merged)',
        balance: totalBtcBalance.toString(),
        price: priceToUse,
        lastUpdated: latestUpdate.toString(),
        changePercent24h: changePercent,
        uniqueId: 'merged-BTC'
      };
      
      // Return merged BTC with other non-BTC assets
      return [...nonBtcAssets, mergedBtc];
    }
    
    // If there's only one or no BTC assets, return all assets unchanged
    return transformed;
  }, [allAssetsData, priceChanges, allWallets]);

  const displayedAssets = processedAssets;

  const totalBalance = useMemo(() => displayedAssets?.reduce((sum: number, asset: Asset) => {
      const balance = parseFloat(asset.balance);
      const price = parseFloat(asset.price);
      return sum + (isNaN(balance) || isNaN(price) ? 0 : balance * price);
  }, 0) || 0, [displayedAssets]); 
  
  // Total (All Assets)
  const totalBalanceAll = totalBalance; // Re-using existing calc, just renaming for clarity
  const totalChangePercentAll = useMemo(() => {
    if (!totalBalanceAll || totalBalanceAll <= 0 || !displayedAssets || displayedAssets.length === 0) return 0;
    let weightedChangeSum = 0;
    for (const asset of displayedAssets) {
      const balance = parseFloat(asset.balance);
      const price = parseFloat(asset.price);
      const changePercent = asset.changePercent24h;
      if (isNaN(balance) || isNaN(price) || balance <= 0 || price <= 0 || changePercent === null || changePercent === undefined || isNaN(changePercent)) continue;
      const assetValue = balance * price;
      const assetWeight = assetValue / totalBalanceAll;
      weightedChangeSum += assetWeight * changePercent;
    }
    return weightedChangeSum;
  }, [displayedAssets, totalBalanceAll]);

  const totalAbsoluteChangeAll = useMemo(() => {
    return displayedAssets?.reduce((sum, asset) => {
      const balance = parseFloat(asset.balance);
      const price = parseFloat(asset.price);
      const changePercent = asset.changePercent24h;
      if (isNaN(balance) || isNaN(price) || balance <= 0 || price <= 0 || changePercent === null || changePercent === undefined || isNaN(changePercent)) return sum;
      const currentValue = balance * price;
      if (1 + (changePercent / 100) <= 0) return sum; 
      const previousValue = currentValue / (1 + (changePercent / 100));
      const absoluteChange = currentValue - previousValue;
      return sum + absoluteChange;
    }, 0) || 0;
  }, [displayedAssets]);

  // Crypto Only (Excluding USDC)
  const totalBalanceCryptoOnly = useMemo(() => displayedAssets?.reduce((sum, asset) => {
    if (asset.symbol === 'USDC') return sum;
    const balance = parseFloat(asset.balance);
    const price = parseFloat(asset.price);
    if (isNaN(balance) || isNaN(price) || balance <= 0 || price <= 0) return sum;
    return sum + (balance * price);
  }, 0) || 0, [displayedAssets]);
  
  const totalChangePercentCryptoOnly = useMemo(() => {
    if (totalBalanceCryptoOnly <= 0 || !displayedAssets || displayedAssets.length === 0) return 0;
    let weightedChangeSum = 0;
    for (const asset of displayedAssets) {
      if (asset.symbol === 'USDC') continue;
      const balance = parseFloat(asset.balance);
      const price = parseFloat(asset.price);
      const changePercent = asset.changePercent24h;
      if (isNaN(balance) || isNaN(price) || balance <= 0 || price <= 0 || changePercent === null || changePercent === undefined || isNaN(changePercent)) continue;
      const assetValue = balance * price;
      const assetWeight = assetValue / totalBalanceCryptoOnly;
      weightedChangeSum += assetWeight * changePercent;
    }
    return weightedChangeSum;
  }, [displayedAssets, totalBalanceCryptoOnly]);

  const totalAbsoluteChangeCryptoOnly = useMemo(() => {
    return displayedAssets?.reduce((sum, asset) => {
      if (asset.symbol === 'USDC') return sum;
      const balance = parseFloat(asset.balance);
      const price = parseFloat(asset.price);
      const changePercent = asset.changePercent24h;
      if (isNaN(balance) || isNaN(price) || balance <= 0 || price <= 0 || changePercent === null || changePercent === undefined || isNaN(changePercent)) return sum;
      const currentValue = balance * price;
      if (1 + (changePercent / 100) <= 0) return sum; 
      const previousValue = currentValue / (1 + (changePercent / 100));
      const absoluteChange = currentValue - previousValue;
      return sum + absoluteChange;
    }, 0) || 0;
  }, [displayedAssets]);

  // Stablecoins Only (USDC)
  const totalBalanceStablecoins = useMemo(() => displayedAssets?.reduce((sum, asset) => {
    if (asset.symbol !== 'USDC') return sum; // Only include USDC
    const balance = parseFloat(asset.balance);
    const price = parseFloat(asset.price);
    // Assuming USDC price is always ~$1, but use fetched price if available & valid
    const stablePrice = (isNaN(price) || price <= 0) ? 1.0 : price;
    if (isNaN(balance) || balance <= 0) return sum;
    return sum + (balance * stablePrice);
  }, 0) || 0, [displayedAssets]);

  // --- End Calculations --- 

  const isLoadingDisplayedAssets = isLoadingAssets; 
  const isRefreshing = isFetchingAssets;

  const refreshAllMutation = trpc.wallet.refreshAll.useMutation({
    onSuccess: (data) => {
      console.log(`Refresh successful, updated ${data?.count} wallets.`);
      setRefreshError(null);
      // Force the cache to be invalidated for assets (will trigger tRPC refetch based on its interval)
      utils.asset.getAll.invalidate(); 
      setLastRefreshed(new Date());
      
      // Also update price changes immediately on manual refresh
      if (allAssetsData) {
        console.log('Fetching price changes after manual refresh success...');
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

  const createWalletMutation = trpc.wallet.create.useMutation({
    onSuccess: () => {
      setIsCreatingWallet(false);
      setNewWalletName('');
      setNewWalletAddress('');
      setCreateWalletError(null);
      utils.asset.getAll.invalidate();
      utils.wallet.getAll.invalidate();
    },
    onError: (error) => {
      setCreateWalletError(error.message);
    }
  });

  const handleCreateWallet = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted', { newWalletName, newWalletAddress });
    setCreateWalletError(null);
    
    if (!newWalletName.trim()) {
      setCreateWalletError('Wallet name is required');
      return;
    }
    
    if (!newWalletAddress.trim()) {
      setCreateWalletError('Wallet address is required (any identifier is fine)');
      return;
    }
    
    console.log('Calling createWalletMutation.mutate with:', {
      name: newWalletName,
      address: newWalletAddress,
      type: 'monero'
    });
    
    createWalletMutation.mutate({
      name: newWalletName,
      address: newWalletAddress,
      type: 'monero'
    });
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-6 min-h-screen flex flex-col">
      {/* Header with animated gradient */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r bg-gray-800 p-6 mb-8 shadow-lg">
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
            <h1 className="text-4xl font-bold text-white mb-4 md:mb-0 flex items-center">
              <svg className="w-10 h-10 mr-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Crypto Portfolio Tracker
            </h1>
          </div>

          {/* ----- Value Display Area ----- */}
          <div className="space-y-4">
            {/* --- Row 1: Stables & Crypto --- */}
            <div className="flex flex-col md:flex-row gap-4">
              {/* Col 1: Stablecoins */}
              <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-sm text-white/70 mb-1">Stablecoin Value (USDC)</div>
                <div className="text-2xl font-semibold text-white">
                  ${totalBalanceStablecoins.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </div>
              </div>

              {/* Col 2: Crypto Only */}
              <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-sm text-white/70 mb-1">Crypto Value (Excl. Stables)</div>
                <div className="text-2xl font-semibold text-white mb-1">
                  ${totalBalanceCryptoOnly.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </div>
                <div className={`text-sm font-medium ${totalChangePercentCryptoOnly >= 0 ? 'text-green-300' : 'text-red-300'} flex items-center flex-wrap gap-x-1.5`}>
                  <span>{totalChangePercentCryptoOnly >= 0 ? '▲' : '▼'} {Math.abs(totalChangePercentCryptoOnly).toFixed(2)}%</span>
                  <span className="text-xs">(${totalAbsoluteChangeCryptoOnly >= 0 ? '+' : '-'}{Math.abs(totalAbsoluteChangeCryptoOnly).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} 24h)</span>
                </div>
              </div>
            </div>

            {/* --- Row 2: Total Portfolio --- */}
            <div className="bg-gradient-to-r from-white/15 to-white/5 backdrop-blur-sm rounded-xl p-5 shadow-inner">
               <div className="text-base text-white/80 mb-1">Total Portfolio Value</div>
               <div className="text-4xl font-bold text-white mb-1">
                 ${totalBalanceAll.toLocaleString('en-US', {
                   minimumFractionDigits: 2,
                   maximumFractionDigits: 2
                 })}
               </div>
               <div className={`text-lg font-semibold ${totalChangePercentAll >= 0 ? 'text-green-200' : 'text-red-200'} flex items-center flex-wrap gap-x-2`}>
                 <span>{totalChangePercentAll >= 0 ? '▲' : '▼'} {Math.abs(totalChangePercentAll).toFixed(2)}%</span>
                 <span className="text-base font-medium">(${totalAbsoluteChangeAll >= 0 ? '+' : '-'}{Math.abs(totalAbsoluteChangeAll).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} 24h)</span>
              </div>
            </div>
          </div>
          {/* ----- End Value Display Area ----- */}

          {/* Controls Area */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
              <svg className="w-4 h-4 text-white/70 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-white/70 text-xs mr-1">Last updated:</span>
              <span className="text-white text-xs font-medium">{formattedLastRefresh}</span>
            </div>
            
            <div className="flex items-center">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={() => setAutoRefresh(!autoRefresh)}
                  className="sr-only peer"
                />
                <div className="relative w-9 h-5 bg-gray-400/30 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-2 text-sm font-medium text-white/90">Auto-refresh</span>
              </label>
            </div>
          </div>
        </div>
        

      </div>
      
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <button
          type="button"
          onClick={() => setIsCreatingWallet(!isCreatingWallet)}
          className={`flex items-center justify-center px-4 py-3 rounded-xl shadow-sm transition-all ${isCreatingWallet ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' : 'bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800'}`}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            {isCreatingWallet ? 
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> :
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            }
          </svg>
          <span className="font-medium">{isCreatingWallet ? 'Cancel' : 'Add XMR Wallet'}</span>
        </button>
        
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshAllMutation.isPending || isRefreshing}
          className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-70 transition-opacity"
        >
          <svg className="w-5 h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{animationPlayState: refreshAllMutation.isPending || isRefreshing ? 'running' : 'paused'}}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="font-medium">{refreshAllMutation.isPending || isRefreshing ? 'Refreshing...' : 'Refresh Now'}</span>
        </button>
      </div>
      
      {refreshError && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-5 py-4 rounded-xl mb-6 flex items-center">
          <svg className="w-6 h-6 mr-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{refreshError}</span>
        </div>
      )}
      
      {isCreatingWallet && (
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-xl p-6 mb-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center mb-5">
            <svg className="w-8 h-8 mr-3 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h2 className="text-2xl font-bold">Create Monero Wallet</h2>
          </div>
          
          {createWalletError && (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-5 flex items-center">
              <svg className="w-5 h-5 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{createWalletError}</span>
            </div>
          )}
          
          <form onSubmit={handleCreateWallet} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium mb-1">Wallet Name</label>
              <input
                type="text"
                value={newWalletName}
                onChange={(e) => setNewWalletName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:focus:ring-orange-600 dark:focus:border-orange-600 bg-white dark:bg-gray-700"
                placeholder="My Monero Wallet"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Wallet Address</label>
              <input
                type="text"
                value={newWalletAddress}
                onChange={(e) => setNewWalletAddress(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:focus:ring-orange-600 dark:focus:border-orange-600 bg-white dark:bg-gray-700"
                placeholder="Enter Monero address or any identifier"
              />
              <p className="text-xs text-gray-500 mt-1 pl-1">
                Note: This address is for reference only and won&apos;t be used to fetch balances.
              </p>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={createWalletMutation.isPending}
                className="px-5 py-3 bg-gradient-to-r from-orange-500 to-orange-700 text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>{createWalletMutation.isPending ? 'Creating...' : 'Create Wallet'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
      
      <div className="flex-grow">
        <AssetTable
          assets={displayedAssets} 
          isLoading={isLoadingDisplayedAssets}
          onUpdateMoneroBalance={handleUpdateMoneroBalance}
          isMoneroWalletAsset={isMoneroWalletAsset}
        />
      </div>

      {/* Monero Balance Update Modal */}
      {updateMoneroWallet && (
        <MoneroBalanceModal
          walletId={updateMoneroWallet.walletId}
          currentBalance={updateMoneroWallet.balance}
          walletName={updateMoneroWallet.name}
          onClose={() => setUpdateMoneroWallet(null)}
          onUpdate={handleRefresh}
        />
      )}
    </main>
  );
}
