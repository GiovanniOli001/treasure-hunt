// ============================================
// AUTH ROUTES
// ============================================

import { Env, json, error, parseBody, createToken, verifyToken, hashPassword, verifyPassword, uuid } from '../index';

interface LoginBody {
  email: string;
  password: string;
}

export async function handleAuth(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const method = request.method;

  // POST /api/auth/login
  if (path === '/api/auth/login' && method === 'POST') {
    const body = await parseBody<LoginBody>(request);

    if (!body.email || !body.password) {
      return error('Email and password are required');
    }

    const user = await env.DB.prepare(`
      SELECT id, email, name, password_hash FROM users WHERE email = ?
    `).bind(body.email.toLowerCase().trim()).first<{
      id: string; email: string; name: string; password_hash: string;
    }>();

    if (!user) {
      return error('Invalid email or password', 401);
    }

    const isValid = await verifyPassword(body.password, user.password_hash);
    if (!isValid) {
      return error('Invalid email or password', 401);
    }

    const token = createToken(
      { userId: user.id, email: user.email, name: user.name },
      env.JWT_SECRET || 'default-secret'
    );

    return json({ token, user: { id: user.id, email: user.email, name: user.name } });
  }

  // GET /api/auth/verify
  if (path === '/api/auth/verify' && method === 'GET') {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return error('Unauthorized', 401);
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token, env.JWT_SECRET || 'default-secret');

    if (!payload) {
      return error('Invalid token', 401);
    }

    return json({ valid: true });
  }

  // POST /api/auth/setup - Create initial admin user (only if no users exist)
  if (path === '/api/auth/setup' && method === 'POST') {
    const count = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>();

    if (count && count.count > 0) {
      return error('Setup already complete. Admin user exists.', 403);
    }

    const body = await parseBody<{ email: string; password: string; name: string }>(request);

    if (!body.email || !body.password || !body.name) {
      return error('Email, password, and name are required');
    }

    const id = uuid();
    const passwordHash = await hashPassword(body.password);

    await env.DB.prepare(`
      INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)
    `).bind(id, body.email.toLowerCase().trim(), passwordHash, body.name.trim()).run();

    const token = createToken(
      { userId: id, email: body.email, name: body.name },
      env.JWT_SECRET || 'default-secret'
    );

    return json({ token, user: { id, email: body.email, name: body.name } });
  }

  return error('Not found', 404);
}
