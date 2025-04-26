'use client';

interface Wallet {
  id: number;
  name: string;
  type: 'solana' | 'ethereum' | 'bitcoin';
  address: string;
}

interface WalletListProps {
  wallets: Wallet[];
  isLoading: boolean;
  selectedWalletId: number | null;
  onSelectWallet: (id: number | null) => void;
}

export function WalletList({ wallets, isLoading, selectedWalletId, onSelectWallet }: WalletListProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-md mb-2"></div>
        ))}
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
        No wallets added yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div 
        className={`p-3 rounded-md cursor-pointer ${
          selectedWalletId === null 
            ? 'bg-blue-100 dark:bg-blue-900' 
            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        onClick={() => onSelectWallet(null)}
      >
        <p className="font-medium">All Wallets</p>
      </div>
      
      {wallets.map((wallet) => (
        <div 
          key={wallet.id}
          className={`p-3 rounded-md cursor-pointer ${
            selectedWalletId === wallet.id 
              ? 'bg-blue-100 dark:bg-blue-900' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          onClick={() => onSelectWallet(wallet.id)}
        >
          <div className="flex items-center">
            <div className="flex-1">
              <p className="font-medium">{wallet.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate w-56">
                {wallet.address}
              </p>
            </div>
            <div className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700">
              {wallet.type}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 