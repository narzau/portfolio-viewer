import { db } from '../db';
import { AssetRepository } from '../repositories/asset.repository';
import { WalletRepository } from '../repositories/wallet.repository';
import { assets, portfolioSnapshots } from '../db/schema';
import { and, eq } from 'drizzle-orm';
import { format } from 'date-fns';
import { CryptoApiService } from './crypto-api.service';

export class AssetService {
  private repository: AssetRepository;
  private cryptoApiService: CryptoApiService;
  private walletRepository: WalletRepository;

  constructor() {
    this.repository = new AssetRepository();
    this.cryptoApiService = new CryptoApiService();
    this.walletRepository = new WalletRepository();
  }

  async getAllAssets() {
    return await this.repository.findAll();
  }

  async getAssetsBySymbol(symbol: string) {
    return await this.repository.findBySymbol(symbol);
  }

  async updateAssetPrice(symbol: string, price: number) {
    const priceString = price.toString();
    
    // Update the asset price
    await this.repository.updatePrice(symbol, priceString);
    
    return { success: true };
  }

  async updateAssetBalance(walletId: number, symbol: string, name: string | null, balance: number, price: number | null) {
    // Find existing asset
    const existingAssets = await db.select().from(assets).where(and(eq(assets.walletId, walletId), eq(assets.symbol, symbol)));
    
    const dataToSet: Partial<typeof assets.$inferInsert> = {
        balance: balance.toString(),
        lastUpdated: new Date()
    };
    if (price !== null && price > 0 && !isNaN(price)) {
        dataToSet.price = price.toString();
    } // else: keeps existing price
    if (name !== null && name !== '') { // Only update name if provided
        dataToSet.name = name;
    }

    if (existingAssets.length > 0) {
        // Update
        await db.update(assets).set(dataToSet).where(and(eq(assets.walletId, walletId), eq(assets.symbol, symbol)));
        return { ...existingAssets[0], ...dataToSet };
    } else {
        // Create
        const insertData = {
            walletId,
            symbol,
            name: name || symbol, // Use symbol as fallback name
            balance: balance.toString(),
            price: (price !== null && price > 0 && !isNaN(price)) ? price.toString() : '0',
            lastUpdated: new Date()
        };
        const result = await db.insert(assets).values(insertData).returning();
        return result[0];
    }
  }

  // Method used by WalletService to delete assets before deleting wallet
  async deleteAssetsByWalletId(walletId: number) {
    return await this.repository.deleteByWalletId(walletId);
  }

  // Simplified snapshot function
  async createPortfolioSnapshot() {
    console.log(`[AssetService] createPortfolioSnapshot started at ${new Date().toISOString()}`);
    try {
      const now = new Date();
      const formattedDate = format(now, 'yyyy-MM-dd'); // Use current date for snapshot key
      
      console.log(`[AssetService] Getting all assets...`);
      const allAssets = await this.getAllAssets();
      console.log(`[AssetService] Found ${allAssets.length} assets.`);
      
      console.log(`[AssetService] Updating asset prices...`);
      for (const asset of allAssets) {
        console.log(`[AssetService] -> Updating price for ${asset.symbol}`);
        try {
          const currentPrice = await this.cryptoApiService.getCurrentPrice(asset.symbol);
          console.log(`[AssetService] -> Fetched price for ${asset.symbol}: ${currentPrice}`);
          if (currentPrice !== null && !isNaN(currentPrice)) { 
            await this.updateAssetPrice(asset.symbol, currentPrice);
            console.log(`[AssetService] -> Successfully updated price for ${asset.symbol} in DB`);
          } else {
            console.warn(`[AssetService] -> Received invalid price (${currentPrice}) for ${asset.symbol}, skipping update.`);
          }
        } catch (error) {
          console.error(`[AssetService] -> Error updating price for ${asset.symbol}:`, error);
        }
      }
      console.log(`[AssetService] Finished updating asset prices.`);
      
      console.log(`[AssetService] Refreshing assets after price update...`);
      const updatedAssets = await this.getAllAssets();
      console.log(`[AssetService] Refreshed ${updatedAssets.length} assets.`);
      
      console.log(`[AssetService] Calculating portfolio values...`);
      let totalValue = 0;
      let btcValue = 0;
      let ethValue = 0;
      let solValue = 0;
      let otherValue = 0;
      
      updatedAssets.forEach(asset => {
        const balance = parseFloat(asset.balance as string);
        const price = parseFloat(asset.price as string);
        if (isNaN(balance) || isNaN(price)) return; 
        const value = balance * price;
        totalValue += value;
        if (asset.symbol === 'BTC') btcValue += value;
        else if (asset.symbol === 'ETH') ethValue += value;
        else if (asset.symbol === 'SOL') solValue += value;
        else otherValue += value;
      });
      console.log(`[AssetService] Calculated total value: ${totalValue}`);
      
      // Upsert snapshot (Insert or Update)
      console.log(`[AssetService] Upserting snapshot for date: ${formattedDate}`);
      await db.insert(portfolioSnapshots)
          .values({
            date: formattedDate,
            totalValue: totalValue.toString(),
            btcValue: btcValue.toString(),
            ethValue: ethValue.toString(),
            solValue: solValue.toString(),
            otherValue: otherValue.toString()
          })
          .onConflictDoUpdate({
              target: portfolioSnapshots.date, // Assuming date is unique constraint
              set: {
                  totalValue: totalValue.toString(),
                  btcValue: btcValue.toString(),
                  ethValue: ethValue.toString(),
                  solValue: solValue.toString(),
                  otherValue: otherValue.toString()
              }
          });
      console.log(`[AssetService] Snapshot upserted for ${formattedDate}.`);
      
      console.log(`[AssetService] createPortfolioSnapshot finished successfully.`);
      return { success: true, totalValue };
    } catch (error) {
        console.error(`[AssetService] CRITICAL ERROR in createPortfolioSnapshot:`, error);
        throw new Error(`Failed to create portfolio snapshot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 