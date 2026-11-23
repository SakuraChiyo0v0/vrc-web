import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';

/**
 * 玩家管理，结构逐条对齐真机 docs/ref/vrcx0-moderation.png（crop-moderation-head.png）：
 *   工具栏：筛选（chip）· 搜索 · 刷新
 *   表格列（5）：时间 · 类型 · 来源 · 目标 · 操作（垃圾桶）
 *   行距 41.5（=spec.pages.moderation.row_pitch），无复选框列、无子导航。
 *
 * 数据：VRChat 本地输出日志不含屏蔽/静音记录，采集器取不到；等接入 VRCX 数据库导入
 * （/api/moderation）后按真机字段填。没有数据时保留表头 + 空态，不编造记录。
 */

const KIND_LABEL = { block: '屏蔽', mute: '静音' };

/** 真机时间列：第一行日期（10月14日），第二行时分（22:55） */
const dayOf = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};
const hmOf = (iso) => new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

export default function ModerationPage() {
  const [q, setQ] = useState('');
  const [kinds, setKinds] = useState([]);
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['moderation'],
    // 服务端还没有这个接口（404）时按「无记录」处理，不弹错误
    queryFn: () => api('moderation').catch(() => ({ items: [] })),
    retry: false
  });

  const items = data?.items ?? [];
  const needle = q.trim().toLowerCase();
  const rows = useMemo(() => items.filter((r) => {
    if (kinds.length && !kinds.includes(r.kind)) return false;
    if (!needle) return true;
    return [r.source, r.target, KIND_LABEL[r.kind]].some((v) => String(v ?? '').toLowerCase().includes(needle));
  }), [items, kinds, needle]);

  const toggleKind = (k) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const inputStyle = { borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)', color: 'var(--content-primary)' };

  return (
    <div className="p-4" data-page="moderation">
      {/* 真机工具栏：筛选 chip · 搜索 · 刷新 */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          className="chip"
          data-filter-toggle="1"
          aria-pressed={kinds.length > 0}
          onClick={() => toggleKind(kinds.length ? '' : 'block')}
          style={kinds.length ? { borderColor: 'var(--stroke-strong)', color: 'var(--content-primary)' } : undefined}
        >
          筛选 {kinds.length ? '· 1' : ''}
        </button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索"
          aria-label="搜索"
          className="h-8 min-w-0 flex-1 rounded-lg border px-2.5 text-[12px] outline-none sm:w-56 sm:flex-none"
          style={inputStyle}
        />
        <span className="text-[12px] text-fg3" data-total={rows.length}>{rows.length} 条</span>
        <button className="chip ml-auto" data-refresh="moderation" onClick={() => refetch()} disabled={isFetching} aria-label="刷新">
          刷新
        </button>
      </div>

      {kinds.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-2" data-filter-panel="1">
          {Object.keys(KIND_LABEL).map((k) => {
            const on = kinds.includes(k);
            return (
              <button
                key={k}
                className="chip"
                data-kind={k}
                data-on={on ? '1' : '0'}
                aria-pressed={on}
                onClick={() => toggleKind(k)}
                style={on ? { borderColor: 'var(--stroke-strong)', color: 'var(--content-primary)' } : undefined}
              >
                {KIND_LABEL[k]}
              </button>
            );
          })}
          <button className="chip" data-reset="1" onClick={() => setKinds([])}>清空类型</button>
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <table className="tbl mod-tbl">
          <thead>
            <tr>
              <th style={{ width: 150 }}>时间</th>
              <th style={{ width: 100 }}>类型</th>
              <th>来源</th>
              <th>目标</th>
              <th style={{ width: 56 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id ?? `${r.at}-${r.target}`} data-moderation={r.id}>
                <td className="tabular-nums" data-label="时间">
                  <span className="block">{dayOf(r.at)}</span>
                  <span className="block text-[11px] text-fg3">{hmOf(r.at)}</span>
                </td>
                <td data-label="类型">
                  <span className="chip" data-kind-label={r.kind}>{KIND_LABEL[r.kind] ?? r.kind}</span>
                </td>
                <td data-label="来源">{r.source ?? '—'}</td>
                <td data-label="目标">{r.target ?? '—'}</td>
                <td data-label="操作">
                  <button className="chip" data-delete={r.id} disabled title="删除记录">✕</button>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr data-empty="1">
                <td colSpan={5} className="text-center text-[12px] text-fg3" style={{ height: 120 }}>
                  还没有屏蔽或静音记录 —— VRChat 本地日志不记录这类操作，接入 VRCX 数据库导入后会显示。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
