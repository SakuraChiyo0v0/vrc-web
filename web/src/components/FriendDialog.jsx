import { useEffect, useMemo, useState } from 'react';
import { api, imgUrl } from '../api.js';

/**
 * 好友详情：对齐 VRCX-0 的「大模态工作台」——左资料栏 + 右侧水平 tab + 双列卡片。
 * 抽屉那种窄单列在这里装不下（封面、属性、四张卡要并列），所以改成居中弹窗。
 */

const TABS = [
  ['info', '信息'],
  ['mutual', '共同好友'],
  ['groups', '群组'],
  ['worlds', '创建的世界'],
  ['favworlds', '收藏的世界'],
  ['avatars', '创建的模型'],
  ['activity', '活动记录'],
  ['json', '原始 JSON'],
];

const LANG = { language_zho: '中文', language_yue: '粤语', language_eng: '英语', language_jpn: '日语', language_kor: '韩语' };
const STATUS_TEXT = { active: '在线', 'join me': '可加入', 'ask me': '需询问', busy: '忙碌', offline: '离线' };
const PLATFORM = { standalonewindows: 'PC', android: 'Quest', ios: 'iOS' };

const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const fmtMin = (m) => (m == null ? '—' : m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分` : `${m} 分钟`);

export default function FriendDialog({ id, onClose }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('info');
  const [err, setErr] = useState(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null);
    setErr(null);
    api(`friend/${encodeURIComponent(id)}`)
      .then((j) => alive && setData(j))
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const p = data?.profile;
  const counts = data?.counts ?? {};
  const worlds = data?.worlds ?? [];
  const events = data?.events ?? [];
  const langs = useMemo(() => (p?.tags ?? []).filter((t) => LANG[t]).map((t) => LANG[t]), [p]);
  const trust = p?.trust_level ?? '—';
  const status = STATUS_TEXT[p?.status] ?? p?.status ?? '—';

  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="fd-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fd-card" role="dialog" aria-label="好友详情">
        <button type="button" className="fd-close" title="关闭 (Esc)" onClick={onClose}>✕</button>
        {/* ── 左：资料栏 ── */}
        <aside className="fd-left">
          <div className="fd-cover">
            {p?.icon_url ? <img src={imgUrl(p.icon_url)} alt="" /> : null}
          </div>
          <div className="fd-avatar">
            {p?.icon_url
              ? <img src={imgUrl(p.icon_url)} alt="" />
              : <span>{(p?.display_name ?? '?').slice(0, 1).toUpperCase()}</span>}
            <i data-s={p?.status} />
          </div>

          <div className="fd-namepill">
            <span className="fd-dot" data-s={p?.status} />
            <strong>{p?.display_name ?? id}</strong>
          </div>

          <ul className="fd-attrs">
            <li><span className="k">关系</span><b>好友</b></li>
            <li><span className="k">信任</span><b>{trust}{p?.trust_rank != null ? `（等级 ${p.trust_rank}）` : ''}</b></li>
            <li><span className="k">平台</span><b>{PLATFORM[p?.platform] ?? p?.platform ?? '—'}</b></li>
            {langs.length ? <li><span className="k">语言</span><b>{langs.join(' ')}</b></li> : null}
            {p?.group_name ? <li><span className="k">展示群组</span><b className="truncate">{p.group_name}</b></li> : null}
          </ul>

          <div className="fd-sep" />
          <ul className="fd-kv">
            <li><span>玩家 ID</span><b title={id}>{id.slice(0, 14)}… <button type="button" onClick={() => copy(id, 'id')}>{copied === 'id' ? '已复制' : '复制'}</button></b></li>
            <li><span>VRChat 链接</span><b><a href={`https://vrchat.com/home/user/${id}`} target="_blank" rel="noreferrer">打开</a></b></li>
            <li><span>允许克隆模型</span><b>—</b></li>
            <li><span>账号创建</span><b>—</b></li>
          </ul>
        </aside>

        {/* ── 右：tab + 卡片 ── */}
        <section className="fd-right">
          <nav className="fd-tabs">
            {TABS.map(([k, label]) => {
              const n = ccount(k, counts, worlds, events, langs);
              return (
                <button key={k} type="button" data-on={tab === k} onClick={() => setTab(k)}>
                  {label}{n != null ? <em>{n}</em> : null}
                </button>
              );
            })}
          </nav>

          {err ? <div className="fd-empty">读取失败（{err}），稍后再试</div> : null}
          {!err && !p ? <div className="fd-empty">读取中…</div> : null}

          {p && tab === 'info' ? (
            <div className="fd-grid">
              <article className="fd-panel wide">
                <h4>当前状态</h4>
                <div className="fd-statusline">
                  <span className="fd-region">{region(p.location)}</span>
                  <b>{status}</b>
                  {p.status_description?.trim() ? <span className="fd-sub">{p.status_description}</span> : null}
                </div>
                <div className="fd-world">
                  <span title={p.world_id || ''}>
                    {p.world_name || (p.location === 'private' ? '私密世界'
                      : p.world_id ? `世界 ${p.world_id.slice(5, 13)}` : '不在世界里')}
                  </span>
                  {p.world_id ? <a href={`https://vrchat.com/home/world/${p.world_id}`} target="_blank" rel="noreferrer">打开世界</a> : null}
                </div>
                <div className="fd-sub">最近更新 {fmtDate(p.updated_at)}</div>
              </article>

              <article className="fd-panel">
                <h4>个人资料详情</h4>
                <div className="fd-label">展示群组</div>
                <div className="fd-group">
                  {p.group_name ? <><b>{p.group_name}</b><span className="fd-sub">当前代表群组</span></> : <span className="fd-sub">—</span>}
                </div>
                <div className="fd-label" style={{ marginTop: 12 }}>头像</div>
                <div className="fd-sub">{p.avatar_id ? p.avatar_id.slice(0, 18) + '…' : '—'}</div>
              </article>

              <article className="fd-panel wide">
                <h4>个人简介</h4>
                <div className="fd-bio">{p.status_description?.trim() ? p.status_description : <span className="fd-none">暂无简介</span>}</div>
              </article>

              <article className="fd-panel">
                <h4>活动摘要</h4>
                <dl className="fd-sum">
                  <div><dt>最后活动时间</dt><dd>{fmtDate(p.updated_at)}</dd></div>
                  <div><dt>见面的次数</dt><dd>{counts.sessions != null ? `${counts.sessions} 次` : '—'}</dd></div>
                  <div><dt>一起游玩的时长</dt><dd>{fmtMin(data?.minutes)}</dd></div>
                  <div><dt>常去的世界</dt><dd>{counts.worlds ?? '—'} 个</dd></div>
                  <div><dt>成为好友时间</dt><dd className="fd-sub">VRChat 未提供</dd></div>
                </dl>
              </article>
            </div>
          ) : null}

          {p && tab === 'activity' ? (
            <div className="fd-list">
              {events.length === 0 ? <div className="fd-empty">暂无活动记录</div> : events.slice(0, 80).map((e) => (
                <div key={e.id} className="fd-row">
                  <span>{fmtDate(e.at)}</span>
                  <b>{e.kind}</b>
                  <span className="fd-sub truncate">{e.world_name || e.location || ''}</span>
                </div>
              ))}
            </div>
          ) : null}

          {p && tab === 'worlds' ? (
            <div className="fd-list">
              {worlds.length === 0 ? <div className="fd-empty">暂无记录</div> : worlds.map((w) => (
                <div key={w.world_id ?? w.world} className="fd-row">
                  <b className="truncate">{w.world}</b>
                  <span className="fd-sub">{w.meets} 次 · {w.minutes ?? '—'} 分钟</span>
                </div>
              ))}
            </div>
          ) : null}

          {p && tab === 'json' ? (
            <pre className="fd-json">{JSON.stringify(data, null, 2)}</pre>
          ) : null}

          {p && ['mutual', 'groups', 'favworlds', 'avatars'].includes(tab) ? (
            <div className="fd-empty">{TABS.find((t) => t[0] === tab)?.[1]}：VRChat 未提供该组数据</div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function ccount(k, counts, worlds, events, langs) {
  switch (k) {
    case 'mutual': return 0;
    case 'groups': return 0;
    case 'worlds': return counts.worlds ?? worlds.length;
    case 'favworlds': return 0;
    case 'avatars': return 0;
    case 'activity': return counts.events ?? events.length;
    default: return null;
  }
}

function region(loc) {
  const m = /region\(([a-z]+)\)/.exec(loc ?? '');
  return m ? m[1].toUpperCase() : '—';
}
