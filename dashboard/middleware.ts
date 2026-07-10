import { NextResponse, type NextRequest } from 'next/server';
import { devBypass, verifySessionValue } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  if (devBypass()) return NextResponse.next();
  const session = await verifySessionValue(req.cookies.get('custos_session')?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!login|api/auth|_next|favicon.ico).*)'],
};
