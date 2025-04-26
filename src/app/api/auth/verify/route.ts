import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { settings } from '@/config/settings'; // Use alias if configured, or adjust path

const AUTH_COOKIE_NAME = 'page-auth-token';

export async function POST(request: NextRequest) {
  try {
    const { key } = await request.json();
    const expectedKey = settings.PAGE_ACCESS_KEY;

    if (!expectedKey) {
      console.error('PAGE_ACCESS_KEY is not set in environment variables.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    if (key === expectedKey) {
      // Key is correct, create response and set cookie
      const response = NextResponse.json({ success: true });
      response.cookies.set(AUTH_COOKIE_NAME, 'true', { // Value doesn't need to be secret
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60, // 1 hour
        sameSite: 'lax',
      });
      return response;
    } else {
      // Key is incorrect
      return NextResponse.json({ error: 'Invalid access key.' }, { status: 401 });
    }
  } catch (error) {
    console.error('Auth verification error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
} 