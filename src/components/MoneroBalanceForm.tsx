'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

interface MoneroBalanceFormProps {
  walletId: number;
  currentBalance: string;
  onBalanceUpdated: () => void;
}

export function MoneroBalanceForm({ walletId, currentBalance, onBalanceUpdated }: MoneroBalanceFormProps) {
  const [balance, setBalance] = useState(currentBalance);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMoneroMutation = trpc.wallet.updateMoneroBalance.useMutation({
    onSuccess: () => {
      setIsUpdating(false);
      setError(null);
      onBalanceUpdated();
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
    <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md">
      <h3 className="text-md font-semibold mb-2">Update XMR Balance</h3>
      <p className="text-sm text-gray-500 mb-3">
        Due to the privacy features of Monero, the balance needs to be updated manually.
      </p>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md flex-grow"
          placeholder="Enter XMR amount"
        />
        <button
          type="submit"
          disabled={isUpdating}
          className="btn-primary px-4 py-2 rounded-md whitespace-nowrap"
        >
          {isUpdating ? 'Updating...' : 'Update Balance'}
        </button>
      </form>
    </div>
  );
} 