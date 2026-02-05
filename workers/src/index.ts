// ============================================
// TREASURE HUNT APP - API
// ============================================

import { handleAuth } from './routes/auth';
import { handleGames } from './routes/games';
import { handleEntries } from './routes/entries';

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// ============================================
// HELPERS
// ============================================

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function uuid(): string {
  return crypto.randomUUID();
}

export async function parseBody<T>(request: Request): Promise<T> {
  return request.json() as Promise<T>;
}

// ============================================
// JWT
// ============================================

export function createToken(payload: object, secret: string): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, exp: Date.now() + 86400000 }));
  const signature = btoa(secret + header + body);
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string, secret: string): object | null {
  try {
    const [header, body, signature] = token.split('.');
    const expectedSig = btoa(secret + header + body);
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(atob(body));
    if (payload.exp < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

export function requireAuth(request: Request, env: Env): object | Response {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return error('Unauthorized', 401);
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token, env.JWT_SECRET || 'default-secret');
  if (!payload) {
    return error('Invalid token', 401);
  }
  return payload;
}

// ============================================
// HAVERSINE DISTANCE
// ============================================

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ============================================
// PASSWORD HASHING
// ============================================

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'treasure-hunt-salt-2026');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// ============================================
// CORS
// ============================================

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function addCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders()).forEach(([key, value]) => {
    newHeaders.set(key, value as string);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

// ============================================
// ROUTER
// ============================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let response: Response;

      if (path.startsWith('/api/auth')) {
        response = await handleAuth(request, env, path);
      } else if (path.startsWith('/api/games') && path.includes('/entries')) {
        response = await handleEntries(request, env, path);
      } else if (path.startsWith('/api/games')) {
        response = await handleGames(request, env, path);
      } else {
        response = json({ message: 'Treasure Hunt API', version: '1.0.0' });
      }

      return addCorsHeaders(response);

    } catch (err) {
      console.error('API Error:', err);
      return addCorsHeaders(error('Internal server error', 500));
    }
  }
};
