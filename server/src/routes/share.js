import crypto from 'node:crypto';
import { buildCsv, isExportName, toCsv } from '../lib/exportTables.js';

/**
 * 分享：把世界或收藏合集做成只读快照（payload 里存当时的内容，之后改动不影响已发出的链接）。
 *   POST /api/shares { kind:'world'|'favorites', targetId?, title? } → { id, url }
 *   GET  /s/:id  服务端渲染的静态页（无脚本、无写操作）
 */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const PAGE = (title, body) => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; padding:24px; background:#111318; color:#e8eaf0;
         font:15px/1.6 -apple-system,"Segoe UI","Noto Sans SC",sans-serif; }
  .wrap { max-width:720px; margin:0 auto; }
  .tag { font-size:12px; letter-spacing:.08em; color:#8b94a7; text-transform:uppercase; }
  h1 { font-size:22px; margin:6px 0 4px; }
  .sub { color:#8b94a7; font-size:13px; margin-bottom:20px; }
  .card { display:flex; gap:14px; align-items:center; padding:12px; border-radius:12px;
          background:#191d25; margin-bottom:10px; }
  .card img { width:96px; height:54px; object-fit:cover; border-radius:8px; background:#222; flex:none; }
  .card .name { font-weight:600; }
  .card .note { color:#8b94a7; font-size:12px; }
  .foot { margin-top:28px; color:#6d7688; font-size:12px; }
  a { color:#7fb6ff; text-decoration:none; }
  .tbl { width:100%; border-collapse:collapse; font-size:13px; }
  .tbl th, .tbl td { text-align:left; padding:6px 8px; border-bottom:1px solid #252a34;
                     white-space:nowrap; max-width:260px; overflow:hidden; text-overflow:ellipsis; }
  .tbl th { color:#8b94a7; font-weight:600; font-size:12px; }
  .scroll { overflow:auto; border-radius:12px; background:#191d25; padding:4px 8px; }
</style></head><body><div class="wrap">${body}
<p class="foot">只读分享 · 由 vrc-web 生成</p></div></body></html>`;

export function registerShareRoutes(app, { db, T, iso }) {
  const snapWorld = async (worldId) => {
    const [w] = await db.query(`select id, name, thumbnail, author_name from ${T('world')} where id = ?`, [worldId]);
    return w ? { id: w.id, name: w.name, thumbnail: w.thumbnail, author: w.author_name } : { id: worldId, name: worldId };
  };

  app.post('/api/shares', async (req, reply) => {
    const rawKind = req.body?.kind;
    const kind = rawKind === 'favorites' || rawKind === 'export' ? rawKind : 'world';
    const title = (req.body?.title ?? '').trim() || null;
    const targetId = String(req.body?.targetId ?? req.body?.target_id ?? '');
    let payload;

    if (kind === 'world') {
      if (!targetId) return reply.code(400).send({ ok: false, error: '缺 targetId' });
      payload = { world: await snapWorld(targetId) };
    } else if (kind === 'export') {
      // 第十五轮：导出快照分享 —— 表名 + 当时前 500 行，之后库变了链接内容不变
      if (!isExportName(targetId)) {
        return reply.code(400).send({ ok: false, error: '不支持分享的表' });
      }
      const { cols, rows } = await buildCsv(targetId, db, T, iso);
      payload = { table: targetId, cols, rows: rows.slice(0, 500), total: rows.length, truncated: rows.length > 500 };
    } else {
      const rows = await db.query(
        `select f.kind, f.target_id, f.note,
                c.name as world_name, c.thumbnail,
                fr.display_name as friend_name, fr.icon_url
           from ${T('favorite')} f
           left join ${T('world')} c on c.id = f.target_id and f.kind = 'world'
           left join ${T('friend')} fr on fr.user_id = f.target_id and f.kind = 'friend'
          order by f.sort_order, f.created_at desc`,
      );
      if (!rows.length) return reply.code(400).send({ ok: false, error: '收藏是空的' });
      payload = {
        items: rows.map((r) => ({
          kind: r.kind,
          name: r.world_name ?? r.friend_name ?? r.target_id,
          thumbnail: r.thumbnail ?? r.icon_url ?? null,
          note: r.note ?? null,
        })),
      };
    }

    const id = crypto.randomBytes(6).toString('base64url');
    await db.query(
      `insert into ${T('share')} (id, kind, target_id, title, payload) values (?,?,?,?,?)`,
      [id, kind, targetId || null, title, JSON.stringify(payload)],
    );
    return { ok: true, id, url: `/s/${id}` };
  });

  app.get('/s/:id', async (req, reply) => {
    const [row] = await db.query(
      `select id, kind, title, payload, created_at from ${T('share')} where id = ?`,
      [req.params.id],
    );
    reply.type('text/html; charset=utf-8');
    if (!row) {
      return reply.code(404).send(PAGE('分享不存在', '<p class="tag">分享</p><h1>这个链接不存在或已失效</h1>'));
    }
    let payload = {};
    try { payload = JSON.parse(row.payload ?? '{}'); } catch { /* 坏快照就只显示标题 */ }

    let body;
    if (row.kind === 'world' && payload.world) {
      const w = payload.world;
      body = `<p class="tag">世界分享</p>
        <h1>${esc(row.title ?? w.name)}</h1>
        <p class="sub">${esc(w.author ? `作者 ${w.author}` : '')}</p>
        <div class="card">
          ${w.thumbnail ? `<img src="${esc(w.thumbnail)}" alt="">` : ''}
          <div><div class="name">${esc(w.name)}</div>
          <div class="note">${esc(w.id)}</div></div>
        </div>`;
    } else if (row.kind === 'export' && Array.isArray(payload.cols)) {
      const cols = payload.cols;
      const rows = Array.isArray(payload.rows) ? payload.rows : [];
      body = `<p class="tag">数据分享</p>
        <h1>${esc(row.title ?? `导出 ${payload.table ?? ''}`)}</h1>
        <p class="sub">共 ${payload.total ?? rows.length} 行${payload.truncated ? `（链接里存前 ${rows.length} 行快照）` : ''} ·
          <a href="/s/${esc(row.id)}/export.csv">下载 CSV</a></p>
        <div class="scroll"><table class="tbl"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(r?.[c] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>`;
    } else {
      const items = Array.isArray(payload.items) ? payload.items : [];
      body = `<p class="tag">收藏合集</p>
        <h1>${esc(row.title ?? `收藏 ${items.length} 项`)}</h1>
        <p class="sub">共 ${items.length} 项</p>
        ${items.map((it) => `<div class="card">
          ${it.thumbnail ? `<img src="${esc(it.thumbnail)}" alt="">` : ''}
          <div><div class="name">${esc(it.name)}</div>
          <div class="note">${esc([it.kind, it.note].filter(Boolean).join(' · '))}</div></div>
        </div>`).join('')}`;
    }
    return reply.send(PAGE(row.title ?? '分享', body));
  });

  /** 导出快照的 CSV 下载（内容来自 share.payload，不读实时表） */
  app.get('/s/:id/export.csv', async (req, reply) => {
    const [row] = await db.query(`select id, kind, payload from ${T('share')} where id = ?`, [req.params.id]);
    let payload = null;
    try { payload = row?.kind === 'export' ? JSON.parse(row.payload ?? '{}') : null; } catch { payload = null; }
    if (!payload || !Array.isArray(payload.cols)) {
      return reply.code(404).type('text/plain; charset=utf-8').send('分享不存在或不是数据快照');
    }
    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="vrc-share-${req.params.id}.csv"`);
    return '\ufeff' + toCsv(payload.cols, Array.isArray(payload.rows) ? payload.rows : []);
  });
}
