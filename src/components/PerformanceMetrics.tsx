'use client';

import { format } from 'date-fns';

interface PerformanceMetricsProps {
  metrics: {
    date: string;
    dailyChange: number;
    weeklyChange: number;
    monthlyChange: number;
    threeMonthChange: number;
    sixMonthChange: number;
    ytdChange: number;
    yearlyChange: number;
    dailyPriceChange?: number;
    weeklyPriceChange?: number;
    monthlyPriceChange?: number;
  } | null;
  isLoading?: boolean;
}

export function PerformanceMetrics({ metrics, isLoading = false }: PerformanceMetricsProps) {
  if (isLoading) {
    return (
      <div className="card p-4">
        <div className="h-48 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse">
          <div className="text-gray-400">Loading performance data...</div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="card p-4">
        <div className="h-48 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-gray-400">No performance data available</div>
        </div>
      </div>
    );
  }

  const renderMetric = (label: string, value: number, isPriceChange: boolean = false) => {
    const isPositive = value >= 0;
    const textColor = isPositive ? 'var(--color-success)' : 'var(--color-error)';
    
    return (
      <div className="flex flex-col text-center p-3">
        <span className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</span>
        <span 
          className="text-lg font-semibold" 
          style={{ color: textColor }}
        >
          {isPositive ? '+' : ''}{value.toFixed(2)}%
        </span>
        {isPriceChange && (
          <span className="text-xs text-gray-500 mt-1">Price only</span>
        )}
      </div>
    );
  };

  const formattedDate = metrics.date ? format(new Date(metrics.date), 'MMM d, yyyy') : '';

  return (
    <div className="card p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Performance Metrics</h3>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          As of {formattedDate}
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 sm:gap-4">
        <div className="flex flex-col">
          <h4 className="text-sm font-medium mb-2 px-3">Total Growth</h4>
          <div className="flex flex-col">
            {renderMetric('24h', metrics.dailyChange)}
            {metrics.dailyPriceChange !== undefined && 
              renderMetric('24h', metrics.dailyPriceChange, true)}
          </div>
        </div>
        
        <div className="flex flex-col">
          <h4 className="text-sm font-medium mb-2 px-3">7 Days</h4>
          <div className="flex flex-col">
            {renderMetric('Balance', metrics.weeklyChange)}
            {metrics.weeklyPriceChange !== undefined && 
              renderMetric('Price', metrics.weeklyPriceChange, true)}
          </div>
        </div>
        
        <div className="flex flex-col">
          <h4 className="text-sm font-medium mb-2 px-3">30 Days</h4>
          <div className="flex flex-col">
            {renderMetric('Balance', metrics.monthlyChange)}
            {metrics.monthlyPriceChange !== undefined && 
              renderMetric('Price', metrics.monthlyPriceChange, true)}
          </div>
        </div>
        
        <div className="flex flex-col">
          <h4 className="text-sm font-medium mb-2 px-3">90 Days</h4>
          <div className="flex flex-col">
            {renderMetric('Balance', metrics.threeMonthChange)}
          </div>
        </div>
        
        <div className="flex flex-col">
          <h4 className="text-sm font-medium mb-2 px-3">180 Days</h4>
          <div className="flex flex-col">
            {renderMetric('Balance', metrics.sixMonthChange)}
          </div>
        </div>
        
        <div className="flex flex-col">
          <h4 className="text-sm font-medium mb-2 px-3">YTD</h4>
          <div className="flex flex-col">
            {renderMetric('Balance', metrics.ytdChange)}
          </div>
        </div>
        
        <div className="flex flex-col">
          <h4 className="text-sm font-medium mb-2 px-3">1 Year</h4>
          <div className="flex flex-col">
            {renderMetric('Balance', metrics.yearlyChange)}
          </div>
        </div>
      </div>
    </div>
  );
} 