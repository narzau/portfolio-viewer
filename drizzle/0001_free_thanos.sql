CREATE TABLE "daily_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"date" date NOT NULL,
	"open_price" numeric(24, 8) NOT NULL,
	"high_price" numeric(24, 8) NOT NULL,
	"low_price" numeric(24, 8) NOT NULL,
	"close_price" numeric(24, 8) NOT NULL,
	"volume" numeric(36, 8),
	"market_cap" numeric(36, 8)
);
--> statement-breakpoint
CREATE TABLE "performance_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"daily_change" numeric(10, 2),
	"weekly_change" numeric(10, 2),
	"monthly_change" numeric(10, 2),
	"three_month_change" numeric(10, 2),
	"six_month_change" numeric(10, 2),
	"ytd_change" numeric(10, 2),
	"yearly_change" numeric(10, 2),
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"total_value" numeric(24, 8) NOT NULL,
	"btc_value" numeric(24, 8),
	"eth_value" numeric(24, 8),
	"sol_value" numeric(24, 8),
	"other_value" numeric(24, 8)
);
