/**
 * Application settings from environment variables
 */

// Load environment variables from .env files
import * as dotenv from 'dotenv';

// First load .env, then override with .env.local if exists
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

export const settings = {
  // Server settings
  PORT: process.env.PORT || '3000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PAGE_ACCESS_KEY: process.env.PAGE_ACCESS_KEY || '',
  
  // API URLs
  API_URL: process.env.API_URL || 'http://localhost:3000/api',
  
  DB_URI: process.env.POSTGRES_URL || '',
  // Authentication
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  
  // External services
  STORAGE_URL: process.env.STORAGE_URL || 'http://localhost:3000/storage',
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || '',
  TIME_TRACKING_API_BASE_URL: process.env.TIME_TRACKING_API_BASE_URL || '',
  TIME_TRACKING_API_KEY: process.env.TIME_TRACKING_API_KEY || '',
};

export default settings;
