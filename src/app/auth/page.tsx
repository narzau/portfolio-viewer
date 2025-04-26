'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!key) {
      setError('Please enter the access key.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Redirect to the originally requested page or home page
        const returnUrl = localStorage.getItem('returnUrl') || '/';
        localStorage.removeItem('returnUrl'); // Clean up
        router.push(returnUrl);
        // No need to set isLoading false here as we are navigating away
      } else {
        setError(data.error || 'Invalid access key.');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Auth submission error:', err);
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-2xl font-semibold mb-4">Enter Access Key</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Access Key"
          className="px-4 py-2 border rounded text-black"
          disabled={isLoading}
        />
        <button 
          type="submit" 
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? 'Verifying...' : 'Submit'}
        </button>
        {error && <p className="text-red-500">{error}</p>}
      </form>
    </div>
  );
} 