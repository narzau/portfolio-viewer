import { migrate } from '../../../server/db/migrations/0001_initial';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await migrate();
    return NextResponse.json({ message: 'Migration completed successfully' });
  } catch (error) {
    console.error('Migration failed:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: (error as Error).message },
      { status: 500 }
    );
  }
} 