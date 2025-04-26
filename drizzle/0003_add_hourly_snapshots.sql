-- Convert date column to varchar to support timestamps for hourly snapshots
ALTER TABLE "portfolio_snapshots" ALTER COLUMN "date" TYPE varchar(255);

-- Add is_hourly and timestamp column
ALTER TABLE "portfolio_snapshots" ADD COLUMN "is_hourly" boolean DEFAULT false;
ALTER TABLE "portfolio_snapshots" ADD COLUMN "timestamp" timestamp DEFAULT now(); 