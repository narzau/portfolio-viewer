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

interface PriceData {
  date: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  volume?: string;
  marketCap?: string;
}

interface PriceChartProps {
  data: PriceData[];
  symbol: string;
  timeframe?: '24h' | 'week' | 'month' | 'quarter' | 'halfyear' | 'year' | 'ytd';
  isLoading?: boolean;
}

export function PriceChart({ data, symbol, timeframe = 'month', isLoading = false }: PriceChartProps) {
  const [displayType, setDisplayType] = useState<'line' | 'candlestick'>('line');
  
  const chartData = useMemo(() => {
    return data.map(item => ({
      date: item.date, // This could be ISO string from new direct API
      open: parseFloat(item.openPrice),
      high: parseFloat(item.highPrice),
      low: parseFloat(item.lowPrice),
      close: parseFloat(item.closePrice),
      price: parseFloat(item.closePrice), // For line chart
      volume: item.volume ? parseFloat(item.volume) : undefined,
      marketCap: item.marketCap ? parseFloat(item.marketCap) : undefined,
    }));
  }, [data]);

  const timeframeLabel = useMemo(() => {
    switch (timeframe) {
      case '24h': return 'Last 24 Hours';
      case 'week': return '7 Days';
      case 'month': return '30 Days';
      case 'quarter': return '90 Days';
      case 'halfyear': return '180 Days';
      case 'year': return '1 Year';
      case 'ytd': return 'Year to Date';
      default: return '30 Days';
    }
  }, [timeframe]);

  // Calculate price change percentage
  const priceChange = useMemo(() => {
    if (chartData.length < 2) return 0;
    
    // For 24h timeframe, we need a different approach since the data points may be hourly
    if (timeframe === '24h' && chartData.length > 1) {
      const firstPrice = chartData[0].price;
      const lastPrice = chartData[chartData.length - 1].price;
      return ((lastPrice - firstPrice) / firstPrice) * 100;
    }
    
    // For other timeframes, use first and last data points
    const firstPrice = chartData[0].price;
    const lastPrice = chartData[chartData.length - 1].price;
    
    return ((lastPrice - firstPrice) / firstPrice) * 100;
  }, [chartData, timeframe]);

  const priceChangeColor = priceChange >= 0 ? 'var(--color-success)' : 'var(--color-error)';

  // Format function for the X-axis tick labels
  const formatXAxisTick = (value: string) => {
    try {
      const date = new Date(value);
      
      if (timeframe === '24h') {
        // For 24h timeframe, show hours
        return format(date, 'HH:mm');
      } else if (['week', 'month'].includes(timeframe || '')) {
        // For week and month, show day and month
        return format(date, 'MMM dd');
      } else {
        // For longer timeframes, just show month
        return format(date, 'MMM');
      }
    } catch (e) {
      console.error('Error formatting date:', value, e);
      return value;
    }
  };

  // Format function for tooltip labels
  const formatTooltipLabel = (label: string) => {
    try {
      const date = new Date(label);
      
      if (timeframe === '24h') {
        // For 24h, show date and time
        return format(date, 'MMM dd, yyyy HH:mm');
      } else {
        // For other timeframes, just show date
        return format(date, 'MMM dd, yyyy');
      }
    } catch (e) {
      console.error('Error formatting tooltip label:', label, e);
      return label;
    }
  };

  if (isLoading) {
    return (
      <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse">
        <div className="text-gray-400">Loading chart data...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-gray-400">No price data available</div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <div>
          <h3 className="text-xl font-bold">{symbol} Price</h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">{timeframeLabel}</div>
        </div>
        
        <div className="mt-2 sm:mt-0">
          <div className="flex items-center space-x-2">
            <span className="font-medium">${chartData[chartData.length - 1]?.price.toFixed(2)}</span>
            <span 
              className="text-sm" 
              style={{ color: priceChangeColor }}
            >
              {priceChange >= 0 ? '↑' : '↓'} {Math.abs(priceChange).toFixed(2)}%
            </span>
          </div>
          
          <div className="flex mt-2 text-sm">
            <button 
              className={`px-3 py-1 rounded-l-md ${displayType === 'line' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
              onClick={() => setDisplayType('line')}
            >
              Line
            </button>
            <button 
              className={`px-3 py-1 rounded-r-md ${displayType === 'candlestick' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
              onClick={() => setDisplayType('candlestick')}
            >
              OHLC
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
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" className="chart-area-gradient-1" />
                <stop offset="95%" className="chart-area-gradient-1-end" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatXAxisTick}
              dy={10}
            />
            <YAxis 
              domain={['dataMin - 1', 'dataMax + 1']}
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
                displayType === 'line' ? 'Price' : 'Close'
              ]}
              labelFormatter={formatTooltipLabel}
            />
            <Legend />
            
            {displayType === 'line' ? (
              <Area
                type="monotone"
                dataKey="price"
                name={`${symbol} Price`}
                stroke="var(--chart-color-1)"
                fill="url(#colorPrice)"
              />
            ) : (
              <>
                <Area
                  type="monotone"
                  dataKey="close"
                  name="Close"
                  stroke="var(--chart-color-1)"
                  fill="url(#colorPrice)"
                />
                <Area
                  type="monotone"
                  dataKey="open"
                  name="Open"
                  stroke="var(--chart-color-2)"
                  fill="none"
                />
                <Area
                  type="monotone"
                  dataKey="high"
                  name="High"
                  stroke="var(--chart-color-3)"
                  fill="none"
                />
                <Area
                  type="monotone"
                  dataKey="low"
                  name="Low"
                  stroke="var(--chart-color-4)"
                  fill="none"
                />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
} 