import { ROLES, act, newRun, visibleRun } from './game.js';
export const APPEARANCES = ['jade','bronze','bone','amethyst'];
const reply = (body, status = 200) => Response.json(body, {
  status,
  headers: {'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'}
});
const columns = 'name, role, appearance, run, revision';
function present(row, now) {
  return row && {
    profile:{name:row.name, role:row.role, appearance:row.appearance},
    run:visibleRun(JSON.parse(row.run), now),
    revision:row.revision
  };
}
export async function api(req, db, userId) {
  if (!userId) return reply({error:'Войди, чтобы открыть доску.'}, 401);
  const path = new URL(req.url).pathname;
  const now = Date.now();
  const select = () => db.prepare(`SELECT ${columns} FROM players WHERE user_id = ?`).bind(userId).first();
  if (req.method === 'GET' && path === '/api/player') {
    return reply({player:present(await select(), now), now});
  }
  if (req.method !== 'POST' || !['/api/player','/api/move'].includes(path)) return reply({error:'Маршрут не найден.'}, 404);
  const origin = req.headers.get('origin');
  if ((origin && origin !== new URL(req.url).origin) || !/^application\/json(?:;|$)/i.test(req.headers.get('content-type') || '')) {
    return reply({error:'Недопустимый запрос.'}, 403);
  }
  let body;
  try { const raw = await req.text(); if (raw.length <= 2048) body = JSON.parse(raw); } catch {}
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({error:'Неверные данные.'}, 400);
  if (path === '/api/player') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!/^[\p{L}\p{N}][\p{L}\p{N} _’'-]{1,23}$/u.test(name) || !Object.hasOwn(ROLES, body.role) || !APPEARANCES.includes(body.appearance)) {
      return reply({error:'Укажи имя из 2–24 букв и цифр, выбери класс и облик.'}, 400);
    }
    const run = newRun(body.role);
    await db.prepare('INSERT INTO players (user_id, name, role, appearance, run) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO NOTHING')
      .bind(userId, name, body.role, body.appearance, JSON.stringify(run)).run();
    return reply({player:present(await select(), now), now});
  }
  const row = await select();
  if (!row) return reply({error:'Сначала создай персонажа.'}, 404);
  if (row.revision !== body.revision) return reply({error:'Доска обновилась в другой вкладке.', player:present(row, now), now}, 409);
  let run;
  try { run = act(JSON.parse(row.run), row.role, body.action, body, now); }
  catch (err) { return reply({error:err.message, player:present(row, now), now}, 400); }
  const changed = await db.prepare('UPDATE players SET run = ?, revision = revision + 1 WHERE user_id = ? AND revision = ?')
    .bind(JSON.stringify(run), userId, body.revision).run();
  if (!changed.meta.changes) return reply({error:'Доска обновилась в другой вкладке.', player:present(await select(), now), now}, 409);
  return reply({player:present({...row, run:JSON.stringify(run), revision:row.revision + 1}, now), now});
}
