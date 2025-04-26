CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" serial NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"name" text NOT NULL,
	"balance" numeric(24, 8) DEFAULT '0' NOT NULL,
	"price" numeric(24, 8) DEFAULT '0',
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"price" numeric(24, 8) NOT NULL,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;