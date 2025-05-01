import { db } from '../db';
import { wallets, assets } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface WalletData {
  name: string;
  address: string;
  type: 'solana' | 'ethereum' | 'bitcoin' | 'monero';
}

export class WalletRepository {
  async findAll() {
    return await db.select().from(wallets);
  }

  async findById(id: number) {
    const result = await db.select().from(wallets).where(eq(wallets.id, id));
    return result[0];
  }

  async findWalletAssets(walletId: number) {
    return await db.select().from(assets).where(eq(assets.walletId, walletId));
  }

  async create(data: WalletData) {
    const result = await db.insert(wallets).values(data).returning();
    return result[0];
  }

  // Add method to delete a wallet by ID
  async deleteById(id: number) {
    console.log(`[WalletRepository] Deleting wallet with id: ${id}`);
    const result = await db.delete(wallets).where(eq(wallets.id, id)).returning();
    console.log(`[WalletRepository] Delete result for id ${id}:`, result);
    return result;
  }

  // Find wallet by address
  async findByAddress(address: string) {
    const result = await db.select().from(wallets).where(eq(wallets.address, address));
    return result[0]; // Return the first match or undefined
  }
} 