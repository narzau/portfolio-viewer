import { pgTable, serial, text, decimal, timestamp, varchar } from 'drizzle-orm/pg-core';

export const wallets = pgTable('wallets', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  type: text('type').notNull(), // "solana", "ethereum", "bitcoin", "monero"
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const assets = pgTable('assets', {
  id: serial('id').primaryKey(),
  walletId: serial('wallet_id').references(() => wallets.id),
  symbol: varchar('symbol', { length: 20 }).notNull(),
  name: text('name').notNull(),
  balance: decimal('balance', { precision: 24, scale: 8 }).notNull().default('0'),
  price: decimal('price', { precision: 24, scale: 8 }).default('0'),
  lastUpdated: timestamp('last_updated').defaultNow(),
});

// Portfolio snapshots for tracking growth
export const portfolioSnapshots = pgTable('portfolio_snapshots', {
  id: serial('id').primaryKey(),
  date: varchar('date', { length: 255 }).notNull(),
  totalValue: decimal('total_value', { precision: 24, scale: 8 }).notNull(),
  btcValue: decimal('btc_value', { precision: 24, scale: 8 }),
  ethValue: decimal('eth_value', { precision: 24, scale: 8 }),
  solValue: decimal('sol_value', { precision: 24, scale: 8 }),
  otherValue: decimal('other_value', { precision: 24, scale: 8 })
}); 