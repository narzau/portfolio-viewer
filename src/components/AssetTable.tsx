'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';
import { CryptoLogo } from './CryptoLogo';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface Asset {
  id: number | string;
  uniqueId: string;
  walletId: number;
  symbol: string;
  name: string;
  balance: string;
  price: string;
  lastUpdated: string;
  dailyChange?: number;
  weeklyChange?: number;
  monthlyChange?: number;
  changePercent24h?: number;
}

interface AssetTableProps {
  stableAssets: Asset[];
  cryptoAssets: Asset[];
  isLoading: boolean;
  onUpdateMoneroBalance?: (asset: Asset) => void;
  isMoneroWalletAsset?: (asset: Asset) => boolean;
}

function SortableAssetCard({ asset, isDeleting, renderActions, renderChangePercentage }: {
  asset: Asset;
  isDeleting: boolean;
  renderActions: (asset: Asset, isDeleting: boolean) => React.ReactNode;
  renderChangePercentage: (changePercent?: number) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: asset.uniqueId, data: { type: asset.symbol === 'USDC' ? 'stable' : 'crypto' } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  const balance = parseFloat(asset.balance);
  const price = parseFloat(asset.price);
  const value = isNaN(balance) || isNaN(price) ? 0 : balance * price;
  const isMergedBtc = asset.walletId === -1 && asset.symbol === 'BTC';
  const isVirtualGains = asset.walletId === -2 && asset.symbol === 'USD';
  const dailyChange = asset.changePercent24h;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative touch-manipulation overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-shadow duration-300 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      <div className="relative z-10 p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <CryptoLogo symbol={asset.symbol} size={48} />
            <div className="ml-3">
              <div className="text-xl font-bold text-gray-900 dark:text-white">{asset.symbol}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{asset.name}</div>
            </div>
          </div>
          <div className="flex justify-end">
            {renderChangePercentage(dailyChange)}
          </div>
        </div>
        
        <div className="mt-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Current Value</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            ${value.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mt-5 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">My Balance</div>
            <div className="text-md font-medium text-gray-900 dark:text-white">
              {balance.toLocaleString('en-US', {
                minimumFractionDigits: asset.symbol === 'BTC' || asset.symbol === 'XMR' ? 8 : 2,
                maximumFractionDigits: asset.symbol === 'BTC' || asset.symbol === 'XMR' ? 8 : 2,
              })} {asset.symbol}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Price</div>
            <div className="text-md font-medium text-gray-900 dark:text-white">
              ${price.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>
        
        {!isMergedBtc && !isVirtualGains && (
          <div className="mt-4 flex justify-end">
            {renderActions(asset, isDeleting)}
          </div>
        )}
      </div>
    </div>
  );
}

// Define Sort Order Type
type SortOrder = 'manual' | 'valueDesc' | 'valueAsc';

export function AssetTable({ stableAssets, cryptoAssets, isLoading, onUpdateMoneroBalance, isMoneroWalletAsset }: AssetTableProps) {
  // State for ordered IDs (manual drag-and-drop order)
  const [stableOrderedIds, setStableOrderedIds] = useState<string[]>([]);
  const [cryptoOrderedIds, setCryptoOrderedIds] = useState<string[]>([]);
  
  // State for current sort order
  const [stableSortOrder, setStableSortOrder] = useState<SortOrder>('manual');
  const [cryptoSortOrder, setCryptoSortOrder] = useState<SortOrder>('manual');
  
  const utils = trpc.useUtils();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const stableLocalStorageKey = 'portfolioStableAssetOrder_v1';
  const cryptoLocalStorageKey = 'portfolioCryptoAssetOrder_v1';

  useEffect(() => {
    const savedOrder = localStorage.getItem(stableLocalStorageKey);
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        if (Array.isArray(parsedOrder)) {
          setStableOrderedIds(parsedOrder);
        }
      } catch (e) {
        console.error("Failed to parse saved stable order v1 from localStorage", e);
        localStorage.removeItem(stableLocalStorageKey);
      }
    }
  }, []);

  useEffect(() => {
    const savedOrder = localStorage.getItem(cryptoLocalStorageKey);
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        if (Array.isArray(parsedOrder)) {
          setCryptoOrderedIds(parsedOrder);
        }
      } catch (e) {
        console.error("Failed to parse saved crypto order v1 from localStorage", e);
        localStorage.removeItem(cryptoLocalStorageKey);
      }
    }
  }, []);

  useEffect(() => {
    if (!stableAssets) return;
    const currentIds = stableAssets.map(a => a.uniqueId);
    const existingOrder = stableOrderedIds.length > 0 ? stableOrderedIds : currentIds;
    const validOrderedIds = existingOrder.filter(id => currentIds.includes(id));
    const newIds = currentIds.filter(id => !validOrderedIds.includes(id));
    const finalOrder = [...validOrderedIds, ...newIds];
    if (JSON.stringify(finalOrder) !== JSON.stringify(stableOrderedIds)) {
      setStableOrderedIds(finalOrder);
    }
  }, [stableAssets]);

  useEffect(() => {
    if (!cryptoAssets) return;
    const currentIds = cryptoAssets.map(a => a.uniqueId);
    const existingOrder = cryptoOrderedIds.length > 0 ? cryptoOrderedIds : currentIds;
    const validOrderedIds = existingOrder.filter(id => currentIds.includes(id));
    const newIds = currentIds.filter(id => !validOrderedIds.includes(id));
    const finalOrder = [...validOrderedIds, ...newIds];
    if (JSON.stringify(finalOrder) !== JSON.stringify(cryptoOrderedIds)) {
      setCryptoOrderedIds(finalOrder);
    }
  }, [cryptoAssets]);

  useEffect(() => {
    if (stableOrderedIds.length > 0) {
      localStorage.setItem(stableLocalStorageKey, JSON.stringify(stableOrderedIds));
    } else if (localStorage.getItem(stableLocalStorageKey)) {
      localStorage.removeItem(stableLocalStorageKey);
    }
  }, [stableOrderedIds]);

  useEffect(() => {
    if (cryptoOrderedIds.length > 0) {
      localStorage.setItem(cryptoLocalStorageKey, JSON.stringify(cryptoOrderedIds));
    } else if (localStorage.getItem(cryptoLocalStorageKey)) {
      localStorage.removeItem(cryptoLocalStorageKey);
    }
  }, [cryptoOrderedIds]);

  // Memoize assets based on manual order first
  const manuallyOrderedStableAssets = useMemo(() => {
    if (!stableAssets || stableAssets.length === 0) return [];
    const assetMap = new Map(stableAssets.map(asset => [asset.uniqueId, asset]));
    return stableOrderedIds.map(id => assetMap.get(id)).filter((asset): asset is Asset => asset !== undefined);
  }, [stableAssets, stableOrderedIds]);

  const manuallyOrderedCryptoAssets = useMemo(() => {
    if (!cryptoAssets || cryptoAssets.length === 0) return [];
    const assetMap = new Map(cryptoAssets.map(asset => [asset.uniqueId, asset]));
    return cryptoOrderedIds.map(id => assetMap.get(id)).filter((asset): asset is Asset => asset !== undefined);
  }, [cryptoAssets, cryptoOrderedIds]);

  // Apply sorting based on the current sort order state
  const displayedStableAssets = useMemo(() => {
    const assetsToSort = [...manuallyOrderedStableAssets]; // Clone to avoid mutating
    if (stableSortOrder === 'valueDesc') {
      return assetsToSort.sort((a, b) => {
        const valueA = parseFloat(a.balance) * parseFloat(a.price);
        const valueB = parseFloat(b.balance) * parseFloat(b.price);
        return (isNaN(valueB) ? 0 : valueB) - (isNaN(valueA) ? 0 : valueA); // Descending
      });
    } else if (stableSortOrder === 'valueAsc') {
      return assetsToSort.sort((a, b) => {
        const valueA = parseFloat(a.balance) * parseFloat(a.price);
        const valueB = parseFloat(b.balance) * parseFloat(b.price);
        return (isNaN(valueA) ? 0 : valueA) - (isNaN(valueB) ? 0 : valueB); // Ascending
      });
    } 
    return manuallyOrderedStableAssets; // Default: manual order
  }, [manuallyOrderedStableAssets, stableSortOrder]);

  const displayedCryptoAssets = useMemo(() => {
    const assetsToSort = [...manuallyOrderedCryptoAssets]; // Clone to avoid mutating
     if (cryptoSortOrder === 'valueDesc') {
      return assetsToSort.sort((a, b) => {
        const valueA = parseFloat(a.balance) * parseFloat(a.price);
        const valueB = parseFloat(b.balance) * parseFloat(b.price);
        return (isNaN(valueB) ? 0 : valueB) - (isNaN(valueA) ? 0 : valueA); // Descending
      });
    } else if (cryptoSortOrder === 'valueAsc') {
      return assetsToSort.sort((a, b) => {
        const valueA = parseFloat(a.balance) * parseFloat(a.price);
        const valueB = parseFloat(b.balance) * parseFloat(b.price);
        return (isNaN(valueA) ? 0 : valueA) - (isNaN(valueB) ? 0 : valueB); // Ascending
      });
    }
    return manuallyOrderedCryptoAssets; // Default: manual order
  }, [manuallyOrderedCryptoAssets, cryptoSortOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !active.data.current?.type) return;

    const activeType = active.data.current.type;
    const overId = over.id as string;
    const activeId = active.id as string;

    if (activeId === overId) return;

    if (activeType === 'stable') {
      setStableOrderedIds((items) => {
        const oldIndex = items.indexOf(activeId);
        const newIndex = items.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) return items;
        const newOrder = arrayMove(items, oldIndex, newIndex);
        return newOrder;
      });
    } else if (activeType === 'crypto') {
      setCryptoOrderedIds((items) => {
        const oldIndex = items.indexOf(activeId);
        const newIndex = items.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) return items;
        const newOrder = arrayMove(items, oldIndex, newIndex);
        return newOrder;
      });
    }
  };

  const deleteWalletMutation = trpc.wallet.delete.useMutation({
    onSuccess: (_, variables) => {
      console.log(`Wallet ${variables.id} deleted successfully.`);
      utils.asset.getAll.invalidate();
      utils.wallet.getAll.invalidate();
      setDeletingId(null);
    },
    onError: (error, variables) => {
      console.error(`Failed to delete wallet ${variables.id}:`, error);
      alert(`Error deleting wallet: ${error.message}`);
      setDeletingId(null);
    },
    onMutate: (variables) => {
        setDeletingId(variables.id);
    }
  });

  const handleDelete = (walletId: number) => {
    if (deletingId === walletId) return;
    if (window.confirm('Are you sure you want to delete this wallet and all its assets?')) {
      deleteWalletMutation.mutate({ id: walletId });
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="rounded-xl overflow-hidden">
              <div className="bg-gray-200 dark:bg-gray-700 h-48"></div>
            </div>
          ))}
        </div>
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded my-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, index) => (
            <div key={index + 3} className="rounded-xl overflow-hidden">
              <div className="bg-gray-200 dark:bg-gray-700 h-48"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stableAssets.length === 0 && cryptoAssets.length === 0) {
    return (
      <div className="text-center py-12 px-4 rounded-xl bg-gray-50 dark:bg-gray-800">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-2xl font-bold mb-2">No assets found</h3>
        <p className="text-gray-500 dark:text-gray-400">
          Add a wallet to start tracking your crypto!
        </p>
      </div>
    );
  }

  const renderChangePercentage = (changePercent?: number) => {
    if (changePercent === undefined || changePercent === null) {
      return <span className="text-gray-400">-</span>;
    }
    
    let bgClass: string;
    let textClass: string;
    let arrow: string | null = null;
    let sign = '';

    if (changePercent > 0.1) {
      // Positive change
      bgClass = 'bg-green-100 dark:bg-green-900/30';
      textClass = 'text-green-600 dark:text-green-400';
      arrow = '↗';
      sign = '+';
    } else if (changePercent < -0.1) {
      // Negative change
      bgClass = 'bg-red-100 dark:bg-red-900/30';
      textClass = 'text-red-600 dark:text-red-400';
      arrow = '↘';
      // Negative sign is already part of the number
    } else {
      // Neutral change (-0.1 to +0.1)
      bgClass = 'bg-gray-100 dark:bg-gray-700/50';
      textClass = 'text-gray-600 dark:text-gray-400';
      arrow = null; // No arrow for neutral
      // Show plus sign for 0.00 to 0.10
      if (changePercent >= 0) {
        sign = '+';
      } 
    }
    
    return (
      <div className={`inline-flex items-center rounded-full px-3 py-1 ${bgClass}`}>
        <span className={`text-sm font-medium ${textClass}`}>
          {arrow && <span className="mr-1">{arrow}</span>}
          {sign}{changePercent.toFixed(2)}%
        </span>
      </div>
    );
  };
  
  const renderActions = (asset: Asset, isDeleting: boolean) => {
    const isMonero = isMoneroWalletAsset && isMoneroWalletAsset(asset);
    
    return (
      <div className="flex space-x-2">
        {isMonero && onUpdateMoneroBalance && (
          <button
            onClick={() => onUpdateMoneroBalance(asset)}
            className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 transition-transform hover:scale-105"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Update Balance
          </button>
        )}
        <button
          onClick={() => handleDelete(asset.walletId)}
          disabled={isDeleting}
          className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-3 py-1 text-sm font-medium text-red-600 dark:text-red-400 transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    );
  };

  // Function to cycle through sort orders
  const cycleSortOrder = (currentOrder: SortOrder, setOrder: React.Dispatch<React.SetStateAction<SortOrder>>) => {
    if (currentOrder === 'manual') setOrder('valueDesc');
    else if (currentOrder === 'valueDesc') setOrder('valueAsc');
    else setOrder('manual');
  };

  // Function to get button text/icon for sort state
  const getSortButtonContent = (order: SortOrder) => {
    if (order === 'valueDesc') return 'Value ↓';
    if (order === 'valueAsc') return 'Value ↑';
    return 'Manual Order'; // Or just an icon like ↕️
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-8"> 
        {/* --- Stable Assets Section --- */}
        {stableAssets.length > 0 && (
          <section>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-semibold">Stable Assets</h2>
              <button 
                onClick={() => cycleSortOrder(stableSortOrder, setStableSortOrder)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${stableSortOrder !== 'manual' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              >
                {getSortButtonContent(stableSortOrder)}
              </button>
            </div>
            <SortableContext
              // IMPORTANT: Use stableOrderedIds here for DND context, even if display is sorted
              items={stableOrderedIds} 
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Render the potentially sorted list */}
                {displayedStableAssets.map((asset) => (
                  <SortableAssetCard
                    key={asset.uniqueId}
                    asset={asset}
                    isDeleting={asset.walletId > 0 && deletingId === asset.walletId} 
                    renderActions={renderActions}
                    renderChangePercentage={renderChangePercentage}
                  />
                ))}
              </div>
            </SortableContext>
          </section>
        )}

        {/* --- Crypto Assets Section --- */}
        {cryptoAssets.length > 0 && (
          <section>
             <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-semibold">Crypto Assets</h2>
               <button 
                onClick={() => cycleSortOrder(cryptoSortOrder, setCryptoSortOrder)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${cryptoSortOrder !== 'manual' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              >
                 {getSortButtonContent(cryptoSortOrder)}
              </button>
            </div>
            <SortableContext
               // IMPORTANT: Use cryptoOrderedIds here for DND context
              items={cryptoOrderedIds}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                 {/* Render the potentially sorted list */}
                {displayedCryptoAssets.map((asset) => (
                  <SortableAssetCard
                    key={asset.uniqueId}
                    asset={asset}
                    isDeleting={asset.walletId > 0 && deletingId === asset.walletId}
                    renderActions={renderActions}
                    renderChangePercentage={renderChangePercentage}
                  />
                ))}
              </div>
            </SortableContext>
          </section>
        )}
      </div>
    </DndContext>
  );
} 