// Server-side helpers: the admin bearer token never reaches the browser —
// pages and route handlers call the Custos API from the server.
import { cookies } from 'next/headers';
import { authorizeIssuerSession } from './issuer-auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const ADMIN_TOKEN = process.env.ADMIN_BEARER_TOKEN ?? 'dev-admin-token-change-me';

export async function apiGet<T>(path: string): Promise<T> {
  await authorizeIssuerSession((await cookies()).get('custos_session')?.value);
  const res = await fetch(`${API_URL}${path}`, {
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  await authorizeIssuerSession((await cookies()).get('custos_session')?.value);
  return post<T>(path, body);
}

class ApiError extends Error {
  constructor(public readonly status: number, path: string) { super(`API ${path} → ${status}`); }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, path);
  return res.json() as Promise<T>;
}

// These two server-only operations intentionally precede dashboard sign-in.
export function requestLoginChallenge(): Promise<{ nonce: string; expiresAt: string }> {
  return post('/v1/dashboard/challenges', {});
}

export async function consumeLoginChallenge(nonce: string): Promise<boolean> {
  try { await post('/v1/dashboard/challenges/consume', { nonce }); return true; }
  catch (error) { if (error instanceof ApiError && error.status === 401) return false; throw error; }
}
