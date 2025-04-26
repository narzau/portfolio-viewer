import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'page-auth-token';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow requests to /auth and API routes
  if (pathname.startsWith('/auth') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }
  
  // Allow requests for static files, images, etc.
  if (pathname.includes('.') || pathname.startsWith('/_next')) {
      return NextResponse.next();
  }

  // Check for the auth cookie
  const authToken = request.cookies.get(AUTH_COOKIE_NAME);

  if (!authToken) {
    // Redirect to auth page, preserving the original destination
    const loginUrl = new URL('/auth', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If cookie exists, allow the request
  return NextResponse.next();
}

// Specify the paths middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth (auth page itself)
     * - Any file extensions (e.g. .png, .jpg, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|auth|.*\.).*)',
  ],
}; 