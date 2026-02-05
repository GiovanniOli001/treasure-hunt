// ============================================
// GAMES ROUTES
// ============================================

import { Env, json, error, parseBody, requireAuth, uuid, haversineDistance } from '../index';

interface GameBody {
  code: string;
  name: string;
  map_config?: object;
  form_fields?: object[];
}

export async function handleGames(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const method = request.method;

  // GET /api/games/:code (public - by code for play page)
  // Matches short codes like "brisbane-2026", not UUIDs
  const codeMatch = path.match(/^\/api\/games\/([a-z0-9-]+)$/i);
  if (codeMatch && method === 'GET') {
    const codeOrId = codeMatch[1];

    // Try as code first (public access), then as ID (admin access)
    let game = await env.DB.prepare(`
      SELECT id, code, name, status, map_config, form_fields, treasure_lat, treasure_lng, winner_entry_id, revealed_at
      FROM games WHERE code = ?
    `).bind(codeOrId).first();

    if (!game) {
      // Try as UUID (admin viewing by ID)
      game = await env.DB.prepare(`
        SELECT id, code, name, status, map_config, form_fields, treasure_lat, treasure_lng, winner_entry_id, revealed_at
        FROM games WHERE id = ?
      `).bind(codeOrId).first();
    }

    if (!game) {
      return error('Game not found', 404);
    }

    return json({
      ...game,
      map_config: JSON.parse(game.map_config as string || '{}'),
      form_fields: JSON.parse(game.form_fields as string || '[]')
    });
  }

  // GET /api/games - List all games (admin)
  if (path === '/api/games' && method === 'GET') {
    const auth = requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const { results } = await env.DB.prepare(`
      SELECT g.*, (SELECT COUNT(*) FROM entries WHERE game_id = g.id) as entry_count
      FROM games g ORDER BY g.created_at DESC
    `).all();

    const games = results.map(g => ({
      ...g,
      map_config: JSON.parse(g.map_config as string || '{}'),
      form_fields: JSON.parse(g.form_fields as string || '[]')
    }));

    return json(games);
  }

  // POST /api/games - Create game (admin)
  if (path === '/api/games' && method === 'POST') {
    const auth = requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const body = await parseBody<GameBody>(request);

    if (!body.code || !body.name) {
      return error('Code and name are required');
    }

    // Validate code format
    if (!/^[a-z0-9-]+$/.test(body.code)) {
      return error('Code must be lowercase letters, numbers, and hyphens only');
    }

    // Check code uniqueness
    const existing = await env.DB.prepare('SELECT id FROM games WHERE code = ?').bind(body.code).first();
    if (existing) {
      return error('A game with this code already exists');
    }

    const id = uuid();
    await env.DB.prepare(`
      INSERT INTO games (id, code, name, map_config, form_fields)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      id,
      body.code,
      body.name.trim(),
      JSON.stringify(body.map_config || {}),
      JSON.stringify(body.form_fields || [])
    ).run();

    const game = await env.DB.prepare('SELECT * FROM games WHERE id = ?').bind(id).first();
    return json({
      ...game,
      map_config: JSON.parse(game!.map_config as string),
      form_fields: JSON.parse(game!.form_fields as string)
    }, 201);
  }

  // PUT /api/games/:id - Update game (admin)
  const updateMatch = path.match(/^\/api\/games\/([a-f0-9-]+)$/i);
  if (updateMatch && method === 'PUT') {
    const auth = requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const id = updateMatch[1];
    const body = await parseBody<Partial<GameBody>>(request);

    const game = await env.DB.prepare('SELECT * FROM games WHERE id = ?').bind(id).first();
    if (!game) return error('Game not found', 404);

    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name.trim());
    }
    if (body.map_config !== undefined) {
      updates.push('map_config = ?');
      values.push(JSON.stringify(body.map_config));
    }
    if (body.form_fields !== undefined) {
      updates.push('form_fields = ?');
      values.push(JSON.stringify(body.form_fields));
    }

    if (updates.length === 0) return error('No fields to update');

    updates.push("updated_at = datetime('now')");
    values.push(id);

    await env.DB.prepare(`
      UPDATE games SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();

    const updated = await env.DB.prepare('SELECT * FROM games WHERE id = ?').bind(id).first();
    return json({
      ...updated,
      map_config: JSON.parse(updated!.map_config as string),
      form_fields: JSON.parse(updated!.form_fields as string)
    });
  }

  // PUT /api/games/:id/treasure - Set treasure location (admin)
  const treasureMatch = path.match(/^\/api\/games\/([a-f0-9-]+)\/treasure$/i);
  if (treasureMatch && method === 'PUT') {
    const auth = requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const id = treasureMatch[1];
    const body = await parseBody<{ lat: number; lng: number }>(request);

    if (body.lat === undefined || body.lng === undefined) {
      return error('lat and lng are required');
    }

    const game = await env.DB.prepare('SELECT id FROM games WHERE id = ?').bind(id).first();
    if (!game) return error('Game not found', 404);

    await env.DB.prepare(`
      UPDATE games SET treasure_lat = ?, treasure_lng = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(body.lat, body.lng, id).run();

    return json({ message: 'Treasure location set' });
  }

  // POST /api/games/:id/reveal - Calculate distances and determine winner (admin)
  const revealMatch = path.match(/^\/api\/games\/([a-f0-9-]+)\/reveal$/i);
  if (revealMatch && method === 'POST') {
    const auth = requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const id = revealMatch[1];

    const game = await env.DB.prepare('SELECT * FROM games WHERE id = ?').bind(id).first<{
      id: string; treasure_lat: number | null; treasure_lng: number | null;
    }>();

    if (!game) return error('Game not found', 404);
    if (!game.treasure_lat || !game.treasure_lng) {
      return error('Treasure location not set');
    }

    // Get all entries
    const { results: allEntries } = await env.DB.prepare(
      'SELECT id, marker_lat, marker_lng FROM entries WHERE game_id = ?'
    ).bind(id).all<{ id: string; marker_lat: number; marker_lng: number }>();

    if (allEntries.length === 0) {
      return error('No entries to evaluate');
    }

    // Calculate distances
    let winnerId = '';
    let minDistance = Infinity;

    for (const entry of allEntries) {
      const distance = haversineDistance(
        entry.marker_lat, entry.marker_lng,
        game.treasure_lat, game.treasure_lng
      );

      // Update entry distance
      await env.DB.prepare(
        'UPDATE entries SET distance_m = ? WHERE id = ?'
      ).bind(Math.round(distance * 100) / 100, entry.id).run();

      if (distance < minDistance) {
        minDistance = distance;
        winnerId = entry.id;
      }
    }

    // Update game with winner
    await env.DB.prepare(`
      UPDATE games SET winner_entry_id = ?, revealed_at = datetime('now'), status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(winnerId, id).run();

    // Get winner details
    const winner = await env.DB.prepare('SELECT * FROM entries WHERE id = ?').bind(winnerId).first();

    return json({
      winner: {
        ...winner,
        form_data: JSON.parse(winner!.form_data as string)
      },
      total_entries: allEntries.length,
      closest_distance_m: Math.round(minDistance * 100) / 100
    });
  }

  // POST /api/games/:id/status - Change game status (admin)
  const statusMatch = path.match(/^\/api\/games\/([a-f0-9-]+)\/status$/i);
  if (statusMatch && method === 'POST') {
    const auth = requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const id = statusMatch[1];
    const body = await parseBody<{ status: string }>(request);

    if (!['draft', 'active', 'ended'].includes(body.status)) {
      return error('Status must be draft, active, or ended');
    }

    const game = await env.DB.prepare('SELECT id FROM games WHERE id = ?').bind(id).first();
    if (!game) return error('Game not found', 404);

    await env.DB.prepare(`
      UPDATE games SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(body.status, id).run();

    return json({ message: `Game status changed to ${body.status}` });
  }

  // DELETE /api/games/:id - Delete game (admin)
  const deleteMatch = path.match(/^\/api\/games\/([a-f0-9-]+)$/i);
  if (deleteMatch && method === 'DELETE') {
    const auth = requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const id = deleteMatch[1];

    const game = await env.DB.prepare('SELECT id FROM games WHERE id = ?').bind(id).first();
    if (!game) return error('Game not found', 404);

    await env.DB.prepare('DELETE FROM entries WHERE game_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM games WHERE id = ?').bind(id).run();

    return json({ message: 'Game deleted' });
  }

  return error('Not found', 404);
}
