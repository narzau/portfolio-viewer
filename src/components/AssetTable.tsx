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
  assets: Asset[];
  isLoading: boolean;
  onUpdateMoneroBalance?: (asset: Asset) => void;
  isMoneroWalletAsset?: (asset: Asset) => boolean;
}

function SortableAssetCard({ asset, isDeleting, renderActions, renderChangePercentage }: {
  asset: Asset;
  isDeleting: boolean;
  renderActions: (asset: Asset, isDeleting: boolean, isMergedBtc: boolean) => React.ReactNode;
  renderChangePercentage: (changePercent?: number) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: asset.uniqueId });

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
        
        {!isMergedBtc && (
          <div className="mt-4 flex justify-end">
            {renderActions(asset, isDeleting, isMergedBtc)}
          </div>
        )}
      </div>
    </div>
  );
}

export function AssetTable({ assets: assetsProp, isLoading, onUpdateMoneroBalance, isMoneroWalletAsset }: AssetTableProps) {
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const utils = trpc.useUtils();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const localStorageKey = 'portfolioAssetOrder_v2';

  useEffect(() => {
    const savedOrder = localStorage.getItem(localStorageKey);
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        if (Array.isArray(parsedOrder)) {
          setOrderedIds(parsedOrder);
        }
      } catch (e) {
        console.error("Failed to parse saved order v2 from localStorage", e);
        localStorage.removeItem(localStorageKey);
      }
    }
  }, []);

  useEffect(() => {
    if (!assetsProp || assetsProp.length === 0) {
        setOrderedIds([]);
        return;
    }

    const currentIds = assetsProp.map(a => a.uniqueId);
    const existingOrder = orderedIds.length > 0 ? orderedIds : currentIds;
    
    const validOrderedIds = existingOrder.filter(id => 
        currentIds.includes(id)
    );

    const newIds = currentIds.filter(id => 
        !validOrderedIds.includes(id)
    );

    const finalOrder = [...validOrderedIds, ...newIds];
    
    if (JSON.stringify(finalOrder) !== JSON.stringify(orderedIds)) {
        setOrderedIds(finalOrder);
    }

  }, [assetsProp]);

  useEffect(() => {
    if (orderedIds.length > 0) {
      localStorage.setItem(localStorageKey, JSON.stringify(orderedIds));
    } else {
      localStorage.removeItem(localStorageKey);
    }
  }, [orderedIds]);

  const displayedAssets = useMemo(() => {
    if (!assetsProp || assetsProp.length === 0) return [];
    
    const assetMap = new Map(assetsProp.map(asset => [asset.uniqueId, asset]));
    
    return orderedIds
        .map(id => assetMap.get(id))
        .filter((asset): asset is Asset => asset !== undefined);
  }, [assetsProp, orderedIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedIds((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        if (oldIndex === -1 || newIndex === -1) return items;
        const newOrder = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem(localStorageKey, JSON.stringify(newOrder)); 
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="rounded-xl overflow-hidden">
              <div className="bg-gray-200 dark:bg-gray-700 h-48"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (assetsProp.length === 0) {
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
  
  const renderActions = (asset: Asset, isDeleting: boolean, isMergedBtc: boolean) => {
    if (isMergedBtc) return null;
    
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={orderedIds}
        strategy={rectSortingStrategy}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {displayedAssets.map((asset) => (
              <SortableAssetCard
                key={asset.uniqueId}
                asset={asset}
                isDeleting={asset.walletId !== -1 && deletingId === asset.walletId}
                renderActions={renderActions}
                renderChangePercentage={renderChangePercentage}
              />
            ))}
          </div>
        </div>
      </SortableContext>
    </DndContext>
  );
} 