'use client';

import { useState } from 'react';
import { MoneroBalanceForm } from './MoneroBalanceForm';

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

interface Wallet {
  id: number;
  name: string;
  address: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MoneroWalletViewProps {
  wallet: Wallet;
  asset?: Asset | null;
  onUpdate: () => void;
}

export function MoneroWalletView({ wallet, asset, onUpdate }: MoneroWalletViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleBalanceUpdated = () => {
    onUpdate();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const renderChangePercentage = (changePercent?: number) => {
    if (changePercent === undefined || changePercent === null) {
      return <span className="text-gray-400">-</span>;
    }
    
    const isPositive = changePercent >= 0;
    return (
      <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
        {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
      </span>
    );
  };

  const currentBalance = asset ? asset.balance : '0';
  const currentPrice = asset ? parseFloat(asset.price) : 0;
  const value = parseFloat(currentBalance) * currentPrice;
  
  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-bold flex items-center">
          <span className="mr-2">🔒</span> {wallet.name}
        </h2>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-500 hover:text-blue-700 text-sm"
        >
          {isExpanded ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
        <div>
          <div className="text-sm text-gray-500">Balance</div>
          <div className="text-lg font-medium">
            {parseFloat(currentBalance).toFixed(6)} XMR
          </div>
        </div>
        
        <div>
          <div className="text-sm text-gray-500">Price</div>
          <div className="text-lg font-medium flex items-center">
            {formatCurrency(currentPrice)}
            <span className="ml-2">{renderChangePercentage(asset?.changePercent24h)}</span>
          </div>
        </div>
        
        <div>
          <div className="text-sm text-gray-500">Value</div>
          <div className="text-lg font-medium">{formatCurrency(value)}</div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="mt-4">
          <div className="text-sm text-gray-500 mb-1">Wallet Address</div>
          <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-md mb-4 break-all">
            <code className="text-xs">{wallet.address}</code>
          </div>
          
          <MoneroBalanceForm 
            walletId={wallet.id}
            currentBalance={currentBalance}
            onBalanceUpdated={handleBalanceUpdated}
          />
        </div>
      )}
    </div>
  );
} 