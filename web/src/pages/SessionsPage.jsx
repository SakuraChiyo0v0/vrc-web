import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import Empty from '../components/Empty.jsx';

/**
 * 房间历史（VRCX-0 #/room-history）：主从结构
 *   左列表 353px（= 真机量测 spec.pages.sessions.structure.left_list_w）：
 *     工具条「自己」+ 搜索/按日 分段 · 「N条房间访问记录」· 按日期分组的记录行（行距 39.5）
 *   右详情：未选中时空态「未选择房间 / 选择一条房间记录以查看详情」
 * 行 4 列：时间 · 地区徽标 · 房间名 · 时长（无表头）
 */

const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const dayKey = (iso) =>
  new Date(new Date(iso).getTime() + 8 * 3600e3).toISOString().slice(0, 10);

const dayLabel = (key) => {
  const [y, m, d] = key.split('-');
  const wd = WD[new Date(`${key}T00:00:00+08:00`).getDay()];
  return `${y}年${Number(m)}月${Number(d)}日${wd}`;
};

const hm = (iso) =>
  new Date(new Date(iso).getTime() + 8 * 3600e3).toISOString().slice(11, 16);

function dur(sec) {
  if (sec == null) return '进行中';
  if (sec < 60) return `${sec}秒`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}分钟`;
  return `${Math.floor(m / 60)}小时${m % 60 ? `${m % 60}分钟` : ''}`;
}

export default function SessionsPage() {
  const { data } = useQuery({ queryKey: ['my-sessions'], queryFn: () => api('my-sessions') });
  const [mode, setMode] = useState('day'); // 按日 / 搜索
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);

  const rows = useMemo(() => {
    const list = data?.sessions ?? [];
    const hit = q.trim().toLowerCase();
    return hit ? list.filter((s) => String(s.world ?? '').toLowerCase().includes(hit)) : list;
  }, [data, q]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const s of rows) {
      const k = dayKey(s.start_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    }
    return [...map.entries()];
  }, [rows]);

  const detail = sel ?? null;

  return (
    <div className="sess-page">
      <div className="sess-list">
        <div className="sess-tools">
          <button className="sess-self" type="button" title="数据来源：自己">
            <span className="sess-self-ico" aria-hidden="true">◍</span>
            <span className="sess-self-name">自己</span>
            <span className="sess-caret" aria-hidden="true">▾</span>
          </button>
          <div className="sess-seg" role="group" aria-label="视图">
            <button type="button" data-active={mode === 'search'} onClick={() => setMode('search')}>
              搜索
            </button>
            <button type="button" data-active={mode === 'day'} onClick={() => setMode('day')}>
              按日
            </button>
          </div>
        </div>

        {mode === 'search' ? (
          <div className="sess-search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索房间"
              aria-label="搜索房间"
            />
          </div>
        ) : null}

        <div className="sess-count">{rows.length}条房间访问记录</div>

        <div className="sess-scroll">
          {rows.length === 0 ? (
            <Empty icon="clock" title={'还没有行程记录'} hint={'下次进 VRChat 换世界时会自动记录。'} />
          ) : (
            groups.map(([day, items]) => (
              <div key={day}>
                <div className="sess-group">{dayLabel(day)}</div>
                {items.map((s, i) => (
                  <button
                    key={`${day}-${i}`}
                    type="button"
                    data-list-row="true"
                    data-active={detail === s ? 'true' : undefined}
                    className="sess-row"
                    onClick={() => setSel(s)}
                  >
                    <span className="sess-time" data-cell="时间">{hm(s.start_at)}</span>
                    {s.region ? (
                      <span className="sess-reg" data-cell="地区">{s.region}</span>
                    ) : (
                      <span className="sess-reg" data-cell="地区" data-off="true" />
                    )}
                    <span className="sess-name" data-cell="房间名" title={s.world ?? s.location}>
                      {s.world ?? s.location}
                    </span>
                    <span className="sess-dur" data-cell="时长">{dur(s.seconds ?? (s.minutes != null ? s.minutes * 60 : null))}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sess-detail">
        {detail ? (
          <div className="sess-detail-in">
            <div className="sess-detail-world">{detail.world ?? detail.location}</div>
            <div className="sess-detail-meta">
              <span>{dayLabel(dayKey(detail.start_at))}</span>
              <span>·</span>
              <span className="tabular-nums">
                {hm(detail.start_at)} – {detail.end_at ? hm(detail.end_at) : '现在'}
              </span>
              <span>·</span>
              <span>{dur(detail.seconds ?? (detail.minutes != null ? detail.minutes * 60 : null))}</span>
            </div>
            <div className="sess-detail-loc">{detail.location}</div>
          </div>
        ) : (
          <div className="sess-detail-empty">
            <div className="sess-detail-title">未选择房间</div>
            <div className="sess-detail-hint">选择一条房间记录以查看详情</div>
          </div>
        )}
      </div>
    </div>
  );
}
