// ============================================
// AUTH ROUTES
// ============================================

import { Env, json, error, parseBody, createToken, verifyToken, requireAuth, hashPassword, verifyPassword, uuid } from '../index';

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

  // GET /api/auth/users - List admin users (admin only)
  if (path === '/api/auth/users' && method === 'GET') {
    const auth = requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const { results } = await env.DB.prepare(
      'SELECT id, email, name, created_at FROM users ORDER BY created_at'
    ).all();

    return json(results);
  }

  // POST /api/auth/users - Create a new admin user (admin only)
  if (path === '/api/auth/users' && method === 'POST') {
    const auth = requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const body = await parseBody<{ email: string; password: string; name: string }>(request);

    if (!body.email || !body.password || !body.name) {
      return error('Email, password, and name are required');
    }

    if (body.password.length < 6) {
      return error('Password must be at least 6 characters');
    }

    // Check for duplicate email
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(body.email.toLowerCase().trim()).first();
    if (existing) {
      return error('A user with this email already exists');
    }

    const id = uuid();
    const passwordHash = await hashPassword(body.password);

    await env.DB.prepare(`
      INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)
    `).bind(id, body.email.toLowerCase().trim(), passwordHash, body.name.trim()).run();

    return json({ id, email: body.email.toLowerCase().trim(), name: body.name.trim() }, 201);
  }

  // DELETE /api/auth/users/:id - Delete an admin user (admin only)
  const deleteMatch = path.match(/^\/api\/auth\/users\/([a-f0-9-]+)$/i);
  if (deleteMatch && method === 'DELETE') {
    const auth = requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const id = deleteMatch[1];

    // Prevent deleting yourself
    const payload = auth as { userId: string };
    if (payload.userId === id) {
      return error('Cannot delete your own account');
    }

    // Check user count - don't allow deleting the last admin
    const count = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>();
    if (count && count.count <= 1) {
      return error('Cannot delete the only admin user');
    }

    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    return json({ message: 'User deleted' });
  }

  return error('Not found', 404);
}
