'use client';

import React, { useState, useMemo } from 'react';

interface Asset {
  id: number | string;
  walletId: number | string;
  symbol: string;
  name: string;
  balance: string;
  price: string;
  lastUpdated: string;
  dailyChange?: number;
  weeklyChange?: number;
  monthlyChange?: number;
}

interface AssetTableProps {
  assets: Asset[];
  isLoading: boolean;
}

type SortKey = keyof Asset | 'value';
type SortDirection = 'ascending' | 'descending';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

const SortIcon = ({ direction }: { direction: SortDirection }) => {
  return direction === 'ascending' ? 
    <span className="ml-1">▲</span> : 
    <span className="ml-1">▼</span>;
};

export function AssetTable({ assets, isLoading }: AssetTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const displayedTotalValue = useMemo(() => assets.reduce((sum, asset) => {
    const balance = parseFloat(asset.balance);
    const price = parseFloat(asset.price);
    const value = isNaN(balance) || isNaN(price) ? 0 : balance * price;
    return sum + value;
  }, 0), [assets]);

  const sortedAssets = useMemo(() => {
    const sortableAssets = [...assets];
    if (sortConfig !== null) {
      sortableAssets.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        if (sortConfig.key === 'value') {
          aValue = parseFloat(a.balance) * parseFloat(a.price);
          bValue = parseFloat(b.balance) * parseFloat(b.price);
        } else if (sortConfig.key === 'balance' || sortConfig.key === 'price') {
          aValue = parseFloat(a[sortConfig.key]);
          bValue = parseFloat(b[sortConfig.key]);
        } else if (sortConfig.key === 'dailyChange' || sortConfig.key === 'weeklyChange' || sortConfig.key === 'monthlyChange') {
            aValue = a[sortConfig.key] ?? -Infinity;
            bValue = b[sortConfig.key] ?? -Infinity;
        } else {
          aValue = a[sortConfig.key as keyof Asset]?.toString().toLowerCase() || '';
          bValue = b[sortConfig.key as keyof Asset]?.toString().toLowerCase() || '';
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableAssets;
  }, [assets, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-md mb-2"></div>
        {[...Array(3)].map((_, index) => (
          <div key={index} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-md mb-2"></div>
        ))}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
        No assets found.
      </div>
    );
  }

  const renderChangePercentage = (changePercent?: number) => {
    if (changePercent === undefined) return <span className="text-gray-400">-</span>;
    
    const isPositive = changePercent >= 0;
    return (
      <span 
        className={isPositive ? 'text-green-500' : 'text-red-500'}
      >
        {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
      </span>
    );
  };
  
  const renderSortableHeader = (key: SortKey, label: string, className: string = '') => (
    <button 
      type="button"
      onClick={() => requestSort(key)}
      className={`flex items-center justify-end text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 ${className}`}
    >
      {label}
      {sortConfig?.key === key && <SortIcon direction={sortConfig.direction} />}
    </button>
  );
  
  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-1 gap-3">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-3 hidden md:grid md:grid-cols-12 gap-2">
          <div className="col-span-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <button 
                type="button"
                onClick={() => requestSort('symbol')}
                className={`flex items-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300`}
            >
                Asset
                {sortConfig?.key === 'symbol' && <SortIcon direction={sortConfig.direction} />}
            </button>
          </div>
          <div className="col-span-2 flex justify-end">
              {renderSortableHeader('balance', 'Balance')}
          </div>
          <div className="col-span-2 flex justify-end">
              {renderSortableHeader('price', 'Price')}
          </div>
          <div className="col-span-1 flex justify-end">
              {renderSortableHeader('dailyChange', '24h %')}
          </div>
          <div className="col-span-1 flex justify-end">
              {renderSortableHeader('weeklyChange', '7d %')}
          </div>
          <div className="col-span-1 flex justify-end">
              {renderSortableHeader('monthlyChange', '30d %')}
          </div>
          <div className="col-span-2 flex justify-end">
              {renderSortableHeader('value', 'Value')}
          </div>
        </div>
        
        {sortedAssets.map((asset) => {
          const balance = parseFloat(asset.balance);
          const price = parseFloat(asset.price);
          const value = isNaN(balance) || isNaN(price) ? 0 : balance * price;

          return (
            <div 
              key={`${asset.walletId}-${asset.symbol}-${asset.id}`}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-2"
            >
              <div className="md:hidden">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div>
                      <div className="text-lg font-medium">{asset.symbol}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{asset.name}</div>
                    </div>
                  </div>
                  <div className="text-right text-lg font-medium">
                    ${value.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 mt-3 border-t border-gray-100 dark:border-gray-800 pt-3">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Balance</div>
                    <div className="text-sm">
                      {balance.toLocaleString('en-US', {
                        minimumFractionDigits: asset.symbol === 'BTC' ? 8 : 2,
                        maximumFractionDigits: asset.symbol === 'BTC' ? 8 : 2,
                      })} {asset.symbol}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Price</div>
                    <div className="text-sm">
                      ${price.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">24h %</div>
                    <div className="text-sm">
                      {renderChangePercentage(asset.dailyChange)}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="hidden md:grid md:grid-cols-12 gap-2 items-center">
                <div className="col-span-3">
                  <div className="text-md font-medium">{asset.symbol}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{asset.name}</div>
                </div>
                <div className="col-span-2 text-right text-sm">
                  {balance.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: asset.symbol === 'BTC' ? 8 : 2,
                  })} {asset.symbol}
                </div>
                <div className="col-span-2 text-right text-sm">
                  ${price.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="col-span-1 text-right text-sm">
                  {renderChangePercentage(asset.dailyChange)}
                </div>
                <div className="col-span-1 text-right text-sm">
                  {renderChangePercentage(asset.weeklyChange)}
                </div>
                <div className="col-span-1 text-right text-sm">
                  {renderChangePercentage(asset.monthlyChange)}
                </div>
                <div className="col-span-2 text-right text-sm font-medium">
                  ${value.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>
          );
        })}
        
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex justify-between items-center">
          <div className="text-sm font-bold">Total</div>
          <div className="text-lg font-bold">
            ${displayedTotalValue.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>
    </div>
  );
} 