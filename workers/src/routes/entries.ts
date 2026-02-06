// ============================================
// ENTRIES ROUTES
// ============================================

import { Env, json, error, parseBody, requireAuth, uuid } from '../index';

interface EntryBody {
  marker_lat: number;
  marker_lng: number;
  form_data: Record<string, string>;
}

export async function handleEntries(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const method = request.method;

  // POST /api/games/:code/entries - Submit entry (public)
  const submitMatch = path.match(/^\/api\/games\/([a-z0-9-]+)\/entries$/i);
  if (submitMatch && method === 'POST') {
    const code = submitMatch[1];

    const game = await env.DB.prepare(`
      SELECT id, status, form_fields FROM games WHERE code = ? OR id = ?
    `).bind(code, code).first<{ id: string; status: string; form_fields: string }>();

    if (!game) return error('Game not found', 404);
    if (game.status !== 'active') return error('This game is not currently accepting entries');

    const body = await parseBody<EntryBody>(request);

    if (body.marker_lat === undefined || body.marker_lng === undefined) {
      return error('Marker location is required');
    }

    // Validate required form fields
    const formFields = JSON.parse(game.form_fields) as { name: string; required: boolean }[];
    for (const field of formFields) {
      if (field.required && !body.form_data?.[field.name]?.trim()) {
        return error(`${field.name} is required`);
      }
    }

    const id = uuid();
    await env.DB.prepare(`
      INSERT INTO entries (id, game_id, marker_lat, marker_lng, form_data)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      id,
      game.id,
      body.marker_lat,
      body.marker_lng,
      JSON.stringify(body.form_data || {})
    ).run();

    return json({ id, message: 'Entry submitted!' }, 201);
  }

  // GET /api/games/:code/entries/results - Public results after reveal
  const resultsMatch = path.match(/^\/api\/games\/([a-z0-9-]+)\/entries\/results$/i);
  if (resultsMatch && method === 'GET') {
    const code = resultsMatch[1];

    const game = await env.DB.prepare(`
      SELECT id, status, treasure_lat, treasure_lng, winner_entry_id, revealed_at
      FROM games WHERE code = ? OR id = ?
    `).bind(code, code).first<{
      id: string; status: string; treasure_lat: number | null; treasure_lng: number | null;
      winner_entry_id: string | null; revealed_at: string | null;
    }>();

    if (!game) return error('Game not found', 404);
    if (!game.revealed_at) return error('Results not yet available', 404);

    // Get winner entry
    let winner = null;
    if (game.winner_entry_id) {
      const w = await env.DB.prepare(
        'SELECT id, form_data, distance_m, marker_lat, marker_lng FROM entries WHERE id = ?'
      ).bind(game.winner_entry_id).first();
      if (w) {
        const fd = JSON.parse(w.form_data as string || '{}');
        winner = {
          id: w.id,
          name: fd.name || fd.email || 'Anonymous',
          distance_m: w.distance_m,
          marker_lat: w.marker_lat,
          marker_lng: w.marker_lng
        };
      }
    }

    // Get total entries count
    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM entries WHERE game_id = ?'
    ).bind(game.id).first<{ count: number }>();

    // If entry_id provided, get that entry's result
    const url = new URL(request.url);
    const entryId = url.searchParams.get('entry_id');
    let myEntry = null;
    if (entryId) {
      const e = await env.DB.prepare(
        'SELECT id, distance_m, marker_lat, marker_lng FROM entries WHERE id = ? AND game_id = ?'
      ).bind(entryId, game.id).first();
      if (e) {
        // Get rank
        const rank = await env.DB.prepare(
          'SELECT COUNT(*) as rank FROM entries WHERE game_id = ? AND distance_m < ?'
        ).bind(game.id, e.distance_m).first<{ rank: number }>();
        myEntry = {
          id: e.id,
          distance_m: e.distance_m,
          marker_lat: e.marker_lat,
          marker_lng: e.marker_lng,
          rank: (rank?.rank || 0) + 1
        };
      }
    }

    return json({
      treasure_lat: game.treasure_lat,
      treasure_lng: game.treasure_lng,
      winner,
      total_entries: countResult?.count || 0,
      my_entry: myEntry
    });
  }

  // GET /api/games/:id/entries - List entries (admin)
  const listMatch = path.match(/^\/api\/games\/([a-f0-9-]+)\/entries$/i);
  if (listMatch && method === 'GET') {
    const auth = requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const gameId = listMatch[1];

    const { results } = await env.DB.prepare(`
      SELECT * FROM entries WHERE game_id = ? ORDER BY created_at DESC
    `).bind(gameId).all();

    const entries = results.map(e => ({
      ...e,
      form_data: JSON.parse(e.form_data as string || '{}')
    }));

    return json(entries);
  }

  // GET /api/games/:id/entries/export - CSV export (admin)
  const exportMatch = path.match(/^\/api\/games\/([a-f0-9-]+)\/entries\/export$/i);
  if (exportMatch && method === 'GET') {
    const auth = requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const gameId = exportMatch[1];

    const game = await env.DB.prepare('SELECT form_fields FROM games WHERE id = ?')
      .bind(gameId).first<{ form_fields: string }>();
    if (!game) return error('Game not found', 404);

    const formFields = JSON.parse(game.form_fields) as { name: string; label: string }[];

    const { results } = await env.DB.prepare(`
      SELECT * FROM entries WHERE game_id = ? ORDER BY distance_m ASC NULLS LAST
    `).bind(gameId).all();

    // Build CSV
    const headers = ['Rank', ...formFields.map(f => f.label), 'Latitude', 'Longitude', 'Distance (m)', 'Submitted'];
    const rows = results.map((e, i) => {
      const formData = JSON.parse(e.form_data as string || '{}');
      return [
        String(i + 1),
        ...formFields.map(f => csvEscape(formData[f.name] || '')),
        String(e.marker_lat),
        String(e.marker_lng),
        e.distance_m != null ? String(e.distance_m) : '',
        String(e.created_at)
      ];
    });

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="entries-${gameId}.csv"`
      }
    });
  }

  return error('Not found', 404);
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
