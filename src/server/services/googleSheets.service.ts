import { google } from 'googleapis';
import settings from '../../config/settings'; // Import settings

export class GoogleSheetsService {
  private sheets = google.sheets('v4');
  private apiKey = settings.GOOGLE_API_KEY;
  private spreadsheetId = '1tb352B-WkA39egEzXPfKGi-WKxet6ZL4B14FiTKI-Fo'; // From user's link
  private sheetName = 'test_excel'; // From user's confirmation
  private range = 'A1';

  async getUnclaimedGains(): Promise<number> {
    if (!this.apiKey) {
      console.error('GOOGLE_API_KEY environment variable is not set.');
      throw new Error('Google API key is missing. Cannot fetch unclaimed gains.');
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        key: this.apiKey,
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!${this.range}`,
      });

      const values = response.data.values;
      if (values && values.length > 0 && values[0].length > 0) {
        // Assuming the value is a number, potentially with currency symbols or commas
        const rawValue = values[0][0];
        
        // 1. Replace European decimal comma with standard period
        const valueWithPeriod = String(rawValue).replace(/,/g, '.');
        
        // 2. Remove any remaining non-numeric characters except the period and minus sign
        // (This removes currency symbols, thousands separators like spaces or actual periods if used incorrectly)
        const cleanedValue = valueWithPeriod.replace(/[^\d.-]/g, ''); 
        
        const numericValue = parseFloat(cleanedValue);

        if (isNaN(numericValue)) {
          console.error(`Value in ${this.sheetName}!${this.range} is not a valid number:`, rawValue);
          // Return 0 or throw an error depending on desired behavior
          return 0; 
        }
        console.log(`Fetched unclaimed gains: ${numericValue}`);
        return numericValue;
      } else {
        console.warn(`No value found in ${this.sheetName}!${this.range}. Returning 0.`);
        return 0; // Return 0 if the cell is empty
      }
    } catch (error) {
      // Check if it's an AxiosError or similar structure from googleapis if needed
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error('Error fetching data from Google Sheets:', message, error);
      // Consider more specific error handling based on Google API error codes if needed
      throw new Error(`Failed to fetch unclaimed gains from Google Sheets. ${message}`);
    }
  }
} 