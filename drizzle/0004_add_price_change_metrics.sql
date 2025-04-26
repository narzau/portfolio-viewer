-- Add price-based change metrics to performance_metrics table
ALTER TABLE "performance_metrics" ADD COLUMN "daily_price_change" numeric(10, 2);
ALTER TABLE "performance_metrics" ADD COLUMN "weekly_price_change" numeric(10, 2);
ALTER TABLE "performance_metrics" ADD COLUMN "monthly_price_change" numeric(10, 2); 