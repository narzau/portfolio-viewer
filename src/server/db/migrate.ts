import { migrate } from 'drizzle-orm/vercel-postgres/migrator';
import { db } from './index';
import { resolve } from 'path';
import settings from '@/config/settings';

async function main() {
  console.log('Running migrations...');
  
  if (!settings.DB_URI) {
    throw new Error("Database connection string not found. Make sure POSTGRES_URL is set in your .env.local file.");
  }
  
  const migrationsFolder = resolve('./drizzle');
  
  await migrate(db, { migrationsFolder });
  console.log('Migrations completed');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});