'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client'; // Assuming alias is set

type WalletType = 'solana' | 'ethereum' | 'bitcoin' | 'arbitrum';

export default function NewWalletPage() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<WalletType>('ethereum');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const utils = trpc.useUtils();

  const createWalletMutation = trpc.wallet.create.useMutation({
    onSuccess: () => {
      utils.asset.getAll.invalidate(); // Invalidate asset list to show new wallet/assets
      utils.wallet.getAll.invalidate(); // Invalidate wallet list
      router.push('/'); // Redirect back to homepage
    },
    onError: (err: { message: string }) => {
      setError(err.message || 'Failed to add wallet.');
      setIsLoading(false);
    },
  });

  const validateAddress = (address: string, type: WalletType): boolean => {
    if (!address) return false;
    
    switch (type) {
      case 'ethereum':
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      case 'solana':
        // Basic Solana address validation (base58 encoded, typically 32-44 chars)
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      case 'bitcoin':
        // Basic Bitcoin address validation
        return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[ac-hj-np-z02-9]{39,59}$/.test(address);
      default:
        return false;
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!name) {
      setError('Please enter a wallet name.');
      setIsLoading(false);
      return;
    }

    if (!address) {
      setError('Please enter a wallet address.');
      setIsLoading(false);
      return;
    }

    if (!validateAddress(address, type)) {
      setError(`Invalid ${type} address format.`);
      setIsLoading(false);
      return; 
    }
    
    createWalletMutation.mutate({ 
        name, 
        address, 
        type 
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Add New Wallet</h1>
      <form onSubmit={handleSubmit} className="max-w-md flex flex-col gap-4 p-4 border rounded-lg shadow-lg">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">Wallet Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Wallet"
            className="w-full px-3 py-2 border rounded text-black disabled:bg-gray-100"
            disabled={isLoading}
          />
        </div>
        
        <div>
          <label htmlFor="type" className="block text-sm font-medium mb-1">Wallet Type</label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as WalletType)}
            className="w-full px-3 py-2 border rounded text-black disabled:bg-gray-100"
            disabled={isLoading}
          >
            <option value="ethereum">Ethereum</option>
            <option value="arbitrum">Arbitrum</option>
            <option value="solana">Solana</option>
            <option value="bitcoin">Bitcoin</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="address" className="block text-sm font-medium mb-1">Wallet Address</label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={
              type === 'solana'
                ? 'e.g., 7sFVsfdAVjMxDRr8SkXGjUcxFM3JPkQZwMW6e6H6LB5j'
                : type === 'ethereum'
                ? 'e.g., 0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
                : 'e.g., 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
            }
            className="w-full px-3 py-2 border rounded text-black disabled:bg-gray-100"
            disabled={isLoading}
          />
        </div>
        
        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button 
          type="submit" 
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? 'Adding...' : 'Add Wallet'}
        </button>
        <button 
          type="button" 
          onClick={() => router.back()} 
          className="bg-gray-300 hover:bg-gray-400 text-black py-2 px-4 rounded disabled:opacity-50"
          disabled={isLoading}
        >
           Cancel
        </button>
      </form>
    </div>
  );
} 