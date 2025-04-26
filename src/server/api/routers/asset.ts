import { publicProcedure, router } from '../trpc';
import { AssetService } from '../../services/asset.service';

const assetService = new AssetService();

export const assetRouter = router({
  getAll: publicProcedure.query(async () => {
    return await assetService.getAllAssets();
  }),
}); 