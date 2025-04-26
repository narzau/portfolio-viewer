'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';

interface PortfolioSnapshot {
  date: string;
  totalValue: number;
  btcValue?: number;
  ethValue?: number;
  solValue?: number;
  otherValue?: number;
}

interface PortfolioGrowthProps {
  data: PortfolioSnapshot[];
  period: '24h' | 'week' | 'month' | 'quarter' | 'halfyear' | 'year' | 'ytd';
  onPeriodChange: (period: '24h' | 'week' | 'month' | 'quarter' | 'halfyear' | 'year' | 'ytd') => void;
  isLoading?: boolean;
}

export function PortfolioGrowth({ 
  data, 
  period, 
  onPeriodChange, 
  isLoading = false 
}: PortfolioGrowthProps) {
  const [showBreakdown, setShowBreakdown] = useState(true);

  const chartData = useMemo(() => {
    return data.map(item => ({
      date: item.date,
      total: item.totalValue,
      btc: item.btcValue || 0,
      eth: item.ethValue || 0,
      sol: item.solValue || 0,
      other: item.otherValue || 0,
    }));
  }, [data]);

  // Calculate growth percentage
  const growthPercentage = useMemo(() => {
    if (chartData.length < 2) return 0;
    
    const firstValue = chartData[0].total;
    const lastValue = chartData[chartData.length - 1].total;
    
    return ((lastValue - firstValue) / firstValue) * 100;
  }, [chartData]);

  const growthColor = growthPercentage >= 0 ? 'var(--color-success)' : 'var(--color-error)';

  const timeframeLabel = useMemo(() => {
    switch (period) {
      case '24h': return 'Last 24 Hours';
      case 'week': return '7 Days';
      case 'month': return '30 Days';
      case 'quarter': return '90 Days';
      case 'halfyear': return '180 Days';
      case 'year': return '1 Year';
      case 'ytd': return 'Year to Date';
      default: return '30 Days';
    }
  }, [period]);

  if (isLoading) {
    return (
      <div className="card p-4 h-[400px]">
        <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse">
          <div className="text-gray-400">Loading portfolio data...</div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="card p-4 h-[400px]">
        <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-gray-400">No portfolio data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6">
        <div>
          <h3 className="text-xl font-bold">Portfolio Growth</h3>
          <div className="mt-1 flex items-center space-x-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">{timeframeLabel}</span>
            <span 
              className="text-sm font-medium" 
              style={{ color: growthColor }}
            >
              {growthPercentage >= 0 ? '↑' : '↓'} {Math.abs(growthPercentage).toFixed(2)}%
            </span>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 mt-4 lg:mt-0">
          <div className="inline-flex rounded-md shadow-sm">
            <button
              type="button"
              onClick={() => onPeriodChange('24h')}
              className={`px-3 py-1.5 text-xs font-medium rounded-l-lg ${
                period === '24h' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              24H
            </button>
            <button
              type="button"
              onClick={() => onPeriodChange('week')}
              className={`px-3 py-1.5 text-xs font-medium ${
                period === 'week' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              7D
            </button>
            <button
              type="button"
              onClick={() => onPeriodChange('month')}
              className={`px-3 py-1.5 text-xs font-medium ${
                period === 'month' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              30D
            </button>
            <button
              type="button"
              onClick={() => onPeriodChange('quarter')}
              className={`px-3 py-1.5 text-xs font-medium ${
                period === 'quarter' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              90D
            </button>
            <button
              type="button"
              onClick={() => onPeriodChange('halfyear')}
              className={`px-3 py-1.5 text-xs font-medium ${
                period === 'halfyear' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              180D
            </button>
            <button
              type="button"
              onClick={() => onPeriodChange('year')}
              className={`px-3 py-1.5 text-xs font-medium ${
                period === 'year' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              1Y
            </button>
            <button
              type="button"
              onClick={() => onPeriodChange('ytd')}
              className={`px-3 py-1.5 text-xs font-medium rounded-r-lg ${
                period === 'ytd' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              YTD
            </button>
          </div>
          
          <div className="inline-flex rounded-md shadow-sm">
            <button
              type="button"
              onClick={() => setShowBreakdown(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-l-lg ${
                showBreakdown 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Breakdown
            </button>
            <button
              type="button"
              onClick={() => setShowBreakdown(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-r-lg ${
                !showBreakdown 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Total
            </button>
          </div>
        </div>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{
              top: 10,
              right: 30,
              left: 0,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" className="chart-area-gradient-1" />
                <stop offset="95%" className="chart-area-gradient-1-end" />
              </linearGradient>
              <linearGradient id="colorBtc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-color-2)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--chart-color-2)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorEth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-color-3)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--chart-color-3)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorSol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-color-4)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--chart-color-4)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorOther" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-color-5)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--chart-color-5)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => format(new Date(value), 'MMM dd')}
              dy={10}
            />
            <YAxis 
              tickFormatter={(value) => `$${value.toLocaleString('en-US', { 
                notation: 'compact',
                compactDisplay: 'short'
              })}`} 
              dx={-10}
            />
            <Tooltip 
              formatter={(value: number) => [
                `$${value.toLocaleString('en-US', { 
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`,
                undefined
              ]}
              labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
            />
            <Legend />
            
            {showBreakdown ? (
              <>
                <Area
                  type="monotone"
                  dataKey="btc"
                  name="Bitcoin"
                  stackId="1"
                  stroke="var(--chart-color-2)"
                  fill="url(#colorBtc)"
                />
                <Area
                  type="monotone"
                  dataKey="eth"
                  name="Ethereum"
                  stackId="1"
                  stroke="var(--chart-color-3)"
                  fill="url(#colorEth)"
                />
                <Area
                  type="monotone"
                  dataKey="sol"
                  name="Solana"
                  stackId="1"
                  stroke="var(--chart-color-4)"
                  fill="url(#colorSol)"
                />
                <Area
                  type="monotone"
                  dataKey="other"
                  name="Other Assets"
                  stackId="1"
                  stroke="var(--chart-color-5)"
                  fill="url(#colorOther)"
                />
              </>
            ) : (
              <Area
                type="monotone"
                dataKey="total"
                name="Total Value"
                stroke="var(--chart-color-1)"
                fill="url(#colorTotal)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
} 