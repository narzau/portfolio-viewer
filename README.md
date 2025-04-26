# Crypto Portfolio Viewer

A Next.js application to track your cryptocurrency portfolio across different wallets.

## Features

- Track balances across multiple wallet types (Solana, Ethereum, Bitcoin)
- Automatic price updates
- Portfolio visualization with charts
- Historical price tracking
- Responsive UI

## Supported Wallets

- Solana (Phantom)
- Ethereum (Metamask)
- Bitcoin (Sparrow)

## Tech Stack

- Next.js 15 with App Router
- TypeScript
- tRPC for API
- Drizzle ORM
- Vercel Postgres for the database
- TailwindCSS for styling
- Recharts for data visualization

## Prerequisites

- Node.js 18+ and npm
- Vercel account for deployment
- Vercel Postgres database

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```
POSTGRES_URL=
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=
POSTGRES_USER=
POSTGRES_HOST=
POSTGRES_PASSWORD=
POSTGRES_DATABASE=
```

These can be obtained from the Vercel dashboard after setting up a Postgres database.

## Getting Started

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

4. Run the database migrations by visiting:

```
http://localhost:3000/api/migrate
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Deployment

The application is designed to be deployed on Vercel:

1. Connect your repository to Vercel
2. Set up the environment variables in Vercel dashboard
3. Deploy the application

## API Integration Notes

### Solana

The application uses `@solana/web3.js` to query Solana wallets. For USDC on Solana, the token mint address is: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`.

### Ethereum

The application uses `ethers.js` to query Ethereum wallets. For USDC on Ethereum, the token contract address is: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`.

### Bitcoin

The application uses the Blockchain.info API to query Bitcoin wallet balances.

### Price Data

The application uses the CoinGecko API for cryptocurrency price data.
