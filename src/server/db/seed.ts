import { db } from './index';
import { dailyPrices, portfolioSnapshots, performanceMetrics } from './schema';
import { format, subDays } from 'date-fns';

async function seed() {
  console.log('🌱 Starting database seed...');

  // Generate price data for the last 30 days
  const today = new Date();
  
  // Insert BTC price data
  console.log('Inserting BTC price history...');
  for (let i = 0; i < 30; i++) {
    const date = format(subDays(today, 30 - i), 'yyyy-MM-dd');
    const basePrice = 25000 + (i * 150) + (Math.random() * 500 - 250);
    
    await db.insert(dailyPrices).values({
      symbol: 'BTC',
      date,
      openPrice: (basePrice - (Math.random() * 200)).toString(),
      highPrice: (basePrice + (Math.random() * 300)).toString(),
      lowPrice: (basePrice - (Math.random() * 300)).toString(),
      closePrice: (basePrice + (Math.random() * 200 - 100)).toString(),
      volume: (20000000000 + (Math.random() * 15000000000)).toString(),
      marketCap: (500000000000 + (i * 2000000000)).toString()
    });
  }

  // Insert ETH price data
  console.log('Inserting ETH price history...');
  for (let i = 0; i < 30; i++) {
    const date = format(subDays(today, 30 - i), 'yyyy-MM-dd');
    const basePrice = 1700 + (i * 10) + (Math.random() * 40 - 20);
    
    await db.insert(dailyPrices).values({
      symbol: 'ETH',
      date,
      openPrice: (basePrice - (Math.random() * 15)).toString(),
      highPrice: (basePrice + (Math.random() * 25)).toString(),
      lowPrice: (basePrice - (Math.random() * 25)).toString(),
      closePrice: (basePrice + (Math.random() * 15 - 7.5)).toString(),
      volume: (10000000000 + (Math.random() * 7000000000)).toString(),
      marketCap: (210000000000 + (i * 1000000000)).toString()
    });
  }

  // Insert SOL price data
  console.log('Inserting SOL price history...');
  for (let i = 0; i < 30; i++) {
    const date = format(subDays(today, 30 - i), 'yyyy-MM-dd');
    const basePrice = 18 + (i * 0.2) + (Math.random() * 1 - 0.5);
    
    await db.insert(dailyPrices).values({
      symbol: 'SOL',
      date,
      openPrice: (basePrice - (Math.random() * 0.3)).toString(),
      highPrice: (basePrice + (Math.random() * 0.5)).toString(),
      lowPrice: (basePrice - (Math.random() * 0.5)).toString(),
      closePrice: (basePrice + (Math.random() * 0.3 - 0.15)).toString(),
      volume: (700000000 + (Math.random() * 500000000)).toString(),
      marketCap: (7500000000 + (i * 50000000)).toString()
    });
  }

  // Create portfolio snapshots for the last 30 days
  console.log('Creating portfolio snapshots...');
  for (let i = 0; i < 30; i++) {
    const date = format(subDays(today, 30 - i), 'yyyy-MM-dd');
    
    // Base values with some randomness and gradual growth
    const btcValue = 10000 + (i * 100) + (Math.random() * 300 - 150);
    const ethValue = 7500 + (i * 75) + (Math.random() * 200 - 100);
    const solValue = 5000 + (i * 50) + (Math.random() * 150 - 75);
    const otherValue = 2500 + (i * 25) + (Math.random() * 100 - 50);
    const totalValue = btcValue + ethValue + solValue + otherValue;
    
    await db.insert(portfolioSnapshots).values({
      date,
      totalValue: totalValue.toString(),
      btcValue: btcValue.toString(),
      ethValue: ethValue.toString(),
      solValue: solValue.toString(),
      otherValue: otherValue.toString()
    });
  }

  // Create performance metrics
  console.log('Creating performance metrics...');
  
  // Base growth percentages with slight randomness
  const dailyChange = 0.5 + (Math.random() * 1 - 0.5);
  const weeklyChange = 3.2 + (Math.random() * 2 - 1);
  const monthlyChange = 8.5 + (Math.random() * 3 - 1.5);
  const threeMonthChange = 15.7 + (Math.random() * 4 - 2);
  const sixMonthChange = 27.8 + (Math.random() * 5 - 2.5);
  const ytdChange = 32.4 + (Math.random() * 6 - 3);
  const yearlyChange = 45.6 + (Math.random() * 8 - 4);
  
  await db.insert(performanceMetrics).values({
    date: format(today, 'yyyy-MM-dd'),
    dailyChange: dailyChange.toString(),
    weeklyChange: weeklyChange.toString(),
    monthlyChange: monthlyChange.toString(),
    threeMonthChange: threeMonthChange.toString(),
    sixMonthChange: sixMonthChange.toString(),
    ytdChange: ytdChange.toString(),
    yearlyChange: yearlyChange.toString()
  });

  console.log('✅ Seed completed successfully!');
}

// Run the seed function
seed()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  }); 