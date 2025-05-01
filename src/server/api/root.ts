import { router } from './trpc';
import { walletRouter } from './routers/wallet';
import { assetRouter } from './routers/asset';

export const appRouter = router({
  wallet: walletRouter,
  asset: assetRouter,
});

export type AppRouter = typeof appRouter;