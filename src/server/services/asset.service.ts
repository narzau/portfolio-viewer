import { db } from '../db';
import { AssetRepository } from '../repositories/asset.repository';
import { WalletRepository } from '../repositories/wallet.repository';
import * as schema from '../db/schema';
import { and, eq } from 'drizzle-orm';
import { format } from 'date-fns';
import { CryptoApiService } from './crypto-api.service';
import { GoogleSheetsService } from './googleSheets.service';

// Define a type that matches the structure returned by repository.findAll()
// Inferring from usage or repository definition is best, but defining explicitly works.
// Assuming it includes properties like id, walletId, symbol, name, balance, price, lastUpdated
interface DbAsset {
  id: number;
  walletId: number;
  symbol: string;
  name: string;
  balance: string; // Assuming string based on usage below
  price: string | null; // Assuming string or null
  lastUpdated: Date | null;
}

export class AssetService {
  private repository: AssetRepository;
  private cryptoApiService: CryptoApiService;
  private walletRepository: WalletRepository;
  private googleSheetsService: GoogleSheetsService;

  constructor() {
    this.repository = new AssetRepository();
    this.cryptoApiService = new CryptoApiService();
    this.walletRepository = new WalletRepository();
    this.googleSheetsService = new GoogleSheetsService();
  }

  async getAllAssets(): Promise<DbAsset[]> {
    // 1. Fetch regular assets from DB
    const dbAssets = await this.repository.findAll();
    let combinedAssets: DbAsset[] = dbAssets; // Initialize with DB assets

    // 2. Fetch unclaimed gains from Google Sheets
    try {
      const unclaimedGainsValue = await this.googleSheetsService.getUnclaimedGains();
      
      // 3. Create a virtual asset object for unclaimed gains
      // Use a non-conflicting ID and walletId (e.g., negative numbers)
      const virtualUnclaimedGainsAsset: DbAsset = {
        id: -2, // Unique virtual ID
        walletId: -2, // Unique virtual wallet ID
        symbol: 'USDC', // Use USDC symbol to reuse its logo
        name: 'Unclaimed Gains',
        balance: unclaimedGainsValue.toString(),
        price: '1', // Price is always 1 for USD representation
        lastUpdated: new Date() // Use current time as last updated
      };
      
      // 4. Append the virtual asset to the list
      combinedAssets = [...dbAssets, virtualUnclaimedGainsAsset];

    } catch (error) {
      console.error("Failed to fetch or process unclaimed gains, returning only DB assets:", error);
      // If fetching gains fails, return only the database assets
      // Optionally, you could throw the error if you want the whole request to fail
    }

    // 5. Return the combined list
    return combinedAssets;
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

  // Add method to update price for a specific wallet's asset
  async updateAssetPriceByWallet(walletId: number, symbol: string, price: number) {
    const priceString = price.toString();
    
    // Find the asset for this wallet
    const existingAssets = await db.select().from(schema.assets).where(
      and(eq(schema.assets.walletId, walletId), eq(schema.assets.symbol, symbol))
    );
    
    if (existingAssets.length > 0) {
      // Update the specific asset
      await db.update(schema.assets)
        .set({ 
          price: priceString,
          lastUpdated: new Date()
        })
        .where(and(eq(schema.assets.walletId, walletId), eq(schema.assets.symbol, symbol)));
      
      return { success: true };
    } else {
      // If the asset doesn't exist yet, create it
      await this.updateAssetBalance(walletId, symbol, symbol, 0, price);
      return { success: true };
    }
  }

  async updateAssetBalance(walletId: number, symbol: string, name: string | null, balance: number, price: number | null) {
    // Find existing asset
    const existingAssets = await db.select().from(schema.assets).where(and(eq(schema.assets.walletId, walletId), eq(schema.assets.symbol, symbol)));
    
    const dataToSet: Partial<typeof schema.assets.$inferInsert> = {
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
        await db.update(schema.assets).set(dataToSet).where(and(eq(schema.assets.walletId, walletId), eq(schema.assets.symbol, symbol)));
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
        const result = await db.insert(schema.assets).values(insertData).returning();
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
      const allAssets = await this.getAllAssets(); // Will include virtual asset, potentially update prices?
      console.log(`[AssetService] Found ${allAssets.length} assets.`);
      
      console.log(`[AssetService] Updating asset prices (excluding virtual)...`);
      for (const asset of allAssets) {
        // Skip price update for virtual assets like Unclaimed Gains (walletId < 0)
        if (asset.walletId < 0) {
            console.log(`[AssetService] -> Skipping price update for virtual asset ${asset.name} (${asset.symbol})`);
            continue;
        }
        console.log(`[AssetService] -> Updating price for ${asset.symbol}`);
        try {
          const currentPrice = await this.cryptoApiService.getCurrentPrice(asset.symbol);
          console.log(`[AssetService] -> Fetched price for ${asset.symbol}: ${currentPrice}`);
          if (currentPrice !== null && !isNaN(currentPrice)) { 
            // Use updateAssetPriceByWallet for accuracy if multiple wallets have same symbol
            await this.updateAssetPriceByWallet(asset.walletId, asset.symbol, currentPrice);
            console.log(`[AssetService] -> Successfully updated price for ${asset.symbol} in wallet ${asset.walletId} DB`);
          } else {
            console.warn(`[AssetService] -> Received invalid price (${currentPrice}) for ${asset.symbol}, skipping update.`);
          }
        } catch (error) {
          console.error(`[AssetService] -> Error updating price for ${asset.symbol} in wallet ${asset.walletId}:`, error);
        }
      }
      console.log(`[AssetService] Finished updating asset prices.`);
      
      console.log(`[AssetService] Refreshing assets after price update...`);
      // Important: Re-fetch assets *after* price updates to get correct values for snapshot
      const updatedAssets = await this.repository.findAll(); // Fetch only DB assets for snapshot
      console.log(`[AssetService] Refreshed ${updatedAssets.length} DB assets for snapshot.`);
      
      console.log(`[AssetService] Calculating portfolio values from DB assets...`);
      let totalValue = 0;
      let btcValue = 0;
      let ethValue = 0;
      let solValue = 0;
      let otherValue = 0;
      
      // Calculate snapshot ONLY from real database assets
      updatedAssets.forEach(asset => {
        const balance = parseFloat(asset.balance as string);
        const price = parseFloat(asset.price as string); // Use the updated price
        if (isNaN(balance) || isNaN(price)) return; 
        const value = balance * price;
        totalValue += value;
        if (asset.symbol === 'BTC') btcValue += value;
        else if (asset.symbol === 'ETH') ethValue += value;
        else if (asset.symbol === 'SOL') solValue += value;
        else otherValue += value;
      });
      console.log(`[AssetService] Calculated snapshot total value: ${totalValue}`);
      
      // Upsert snapshot (Insert or Update)
      console.log(`[AssetService] Upserting snapshot for date: ${formattedDate}`);
      await db.insert(schema.portfolioSnapshots)
          .values({
            date: formattedDate,
            totalValue: totalValue.toString(),
            btcValue: btcValue.toString(),
            ethValue: ethValue.toString(),
            solValue: solValue.toString(),
            otherValue: otherValue.toString()
          })
          .onConflictDoUpdate({
              target: schema.portfolioSnapshots.date, // Assuming date is unique constraint
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
      return { success: true, totalValue }; // Return total value from DB assets only
    } catch (error) {
        console.error(`[AssetService] CRITICAL ERROR in createPortfolioSnapshot:`, error);
        throw new Error(`Failed to create portfolio snapshot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}