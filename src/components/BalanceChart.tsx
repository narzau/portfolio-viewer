'use client';

import { useMemo } from 'react';
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

interface Asset {
  id: number;
  walletId: number;
  symbol: string;
  name: string;
  balance: string;
  price: string;
  lastUpdated: string;
}

interface BalanceChartProps {
  assets: Asset[];
}

interface ChartDataPoint {
  name: string;
  value: number;
}

export function BalanceChart({ assets }: BalanceChartProps) {
  const chartData = useMemo(() => {
    const assetsBySymbol = assets.reduce<Record<string, Asset[]>>((acc, asset) => {
      acc[asset.symbol] = acc[asset.symbol] || [];
      acc[asset.symbol].push(asset);
      return acc;
    }, {});

    const data: ChartDataPoint[] = Object.entries(assetsBySymbol).map(([symbol, assets]) => {
      const totalBalance = assets.reduce((sum, asset) => {
        const balance = parseFloat(asset.balance);
        const price = parseFloat(asset.price);
        return sum + (balance * price);
      }, 0);

      return {
        name: symbol,
        value: totalBalance,
      };
    });

    // Sort by value descending
    return data.sort((a, b) => b.value - a.value);
  }, [assets]);

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28'];

  if (assets.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={chartData}
        margin={{
          top: 10,
          right: 30,
          left: 0,
          bottom: 0,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis 
          tickFormatter={(value) => `$${value.toLocaleString('en-US', { 
            notation: 'compact',
            compactDisplay: 'short'
          })}`} 
        />
        <Tooltip 
          formatter={(value: number) => [
            `$${value.toLocaleString('en-US', { 
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            'Value'
          ]}
        />
        <Legend />
        {chartData.map((entry, index) => (
          <Area
            key={entry.name}
            type="monotone"
            dataKey="value"
            name={entry.name}
            stackId="1"
            fill={colors[index % colors.length]}
            stroke={colors[index % colors.length]}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}