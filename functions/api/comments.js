const MAX_NAME_LENGTH = 40;
const MAX_BODY_LENGTH = 600;
const MAX_COMMENTS_PER_RESPONSE = 30;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const pageKey = normalizeText(
    url.searchParams.get("pageKey") || url.searchParams.get("gameSlug"),
    120
  );

  if (!pageKey) {
    return json({ error: "Missing pageKey." }, 400);
  }

  const comments = await listComments(env, pageKey);
  return json({ comments });
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const pageKey = normalizeText(payload.pageKey || payload.gameSlug, 120);
  const name = normalizeText(payload.name || "Visitor", MAX_NAME_LENGTH) || "Visitor";
  const body = normalizeText(payload.comment || payload.body, MAX_BODY_LENGTH);

  if (!pageKey) {
    return json({ error: "Missing pageKey." }, 400);
  }

  if (!body) {
    return json({ error: "Comment cannot be empty." }, 400);
  }

  const db = commentsDb(env);
  if (!db) {
    return json({ error: "Comments database is not configured yet." }, 503);
  }

  const id = crypto.randomUUID();
  await db
    .prepare(`
      INSERT INTO comments (id, page_key, name, body)
      VALUES (?, ?, ?, ?)
    `)
    .bind(id, pageKey, name, body)
    .run();

  const comments = await listComments(env, pageKey);
  return json({ ok: true, comments }, 201);
}

async function listComments(env, pageKey) {
  const db = commentsDb(env);
  if (!db) return [];

  const { results } = await db
    .prepare(`
      SELECT id, name, body, created_at
      FROM comments
      WHERE page_key = ? AND status = 'visible'
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .bind(pageKey, MAX_COMMENTS_PER_RESPONSE)
    .all();

  return (results || []).map((row) => ({
    id: row.id,
    name: row.name,
    body: row.body,
    createdAt: row.created_at,
  }));
}

function commentsDb(env) {
  return env && env.COMMENTS_DB;
}

function normalizeText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
