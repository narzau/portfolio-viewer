'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '../../../lib/trpc/client';

type WalletType = 'solana' | 'ethereum' | 'bitcoin';

export default function NewWallet() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<WalletType>('solana');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createWallet = trpc.wallet.create.useMutation({
    onSuccess: () => {
      router.push('/');
    },
    onError: (error) => {
      setError(error.message);
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!name || !address) {
      setError('Name and address are required');
      setIsSubmitting(false);
      return;
    }

    try {
      // Create the wallet
      await createWallet.mutateAsync({
        name,
        address,
        type,
      });
    } catch (err) {
      // Error is handled by the mutation onError
      console.error("Submission error caught in component:", err);
    }
  };

  return (
    <main className="container mx-auto px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Add New Wallet</h1>
            <Link
              href="/"
              className="text-blue-500 hover:text-blue-600 text-sm"
            >
              ← Back to Dashboard
            </Link>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Wallet Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="My Solana Wallet"
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="type" className="block text-sm font-medium mb-1">
                Wallet Type
              </label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as WalletType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              >
                <option value="solana">Solana</option>
                <option value="ethereum">Ethereum</option>
                <option value="bitcoin">Bitcoin</option>
              </select>
            </div>

            <div className="mb-6">
              <label htmlFor="address" className="block text-sm font-medium mb-1">
                Wallet Address
              </label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder={
                  type === 'solana'
                    ? 'e.g., 7sFVsfdAVjMxDRr8SkXGjUcxFM3JPkQZwMW6e6H6LB5j'
                    : type === 'ethereum'
                    ? 'e.g., 0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
                    : 'e.g., 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
                }
                required
              />
            </div>

            <div className="flex justify-end">
              <Link
                href="/"
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md mr-2"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Adding...' : 'Add Wallet'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
} 