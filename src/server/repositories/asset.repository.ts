import { db } from '../db';
import { assets } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface AssetPrice {
  symbol: string;
  price: string;
}

export class AssetRepository {
  async findAll() {
    return await db.select().from(assets);
  }

  async findBySymbol(symbol: string) {
    const result = await db.select().from(assets).where(eq(assets.symbol, symbol));
    return result;
  }

  async updatePrice(symbol: string, price: string) {
    await db.update(assets)
      .set({ 
        price,
        lastUpdated: new Date()
      })
      .where(eq(assets.symbol, symbol));
  }



  async deleteByWalletId(walletId: number) {
    console.log(`[AssetRepository] Deleting assets for walletId: ${walletId}`);
    const result = await db.delete(assets).where(eq(assets.walletId, walletId)).returning();
    console.log(`[AssetRepository] Deleted ${result.length} assets for walletId: ${walletId}`);
    return result;
  }
} 