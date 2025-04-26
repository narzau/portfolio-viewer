'use client';

interface DashboardHeaderProps {
  totalBalance: number;
}

export function DashboardHeader({ totalBalance }: DashboardHeaderProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h1 className="text-2xl font-bold mb-2">My Portfolio</h1>
      <div className="flex justify-between items-end">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Balance</p>
          <p className="text-3xl font-bold">${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">Last Updated</p>
          <p className="text-sm">{new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
} 