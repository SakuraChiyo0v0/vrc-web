import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, BASE, send, shareUrl } from '../api.js';

/**
 * 设置页：结构按 VRCX-0 真机（docs/ref/vrcx0-settings.png 量测，见 spec.pages.settings.structure）。
 *   左：10 个子导航（系统/界面/社交/通知/VR/媒体/AI/集成/高级/反馈），选中项进地址栏
 *   右：单栏分组卡片（启动 / 窗口与托盘 …），行形态 = 开关 / 按钮 / 状态值
 * 高级 里保留本项目自有能力（采集诊断、CSV 导出、备份导入、手机预览），不另开页面。
 */
const SUBNAV = ['系统', '界面', '社交', '通知', 'VR', '媒体', 'AI', '集成', '高级', '反馈'];

const fmtAt = (v) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');
const LS = 'vrc-settings';

const loadToggles = () => {
  try { return JSON.parse(localStorage.getItem(LS)) ?? {}; } catch { return {}; }
};

function Switch({ id, label, note, on, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2" data-setting={id}>
      <div className="min-w-0">
        <div className="text-[12px]">{label}</div>
        {note ? <div className="mt-0.5 text-[11px] text-fg3">{note}</div> : null}
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className="relative h-[18px] w-[32px] shrink-0 rounded-full transition-colors"
        style={{ background: on ? 'var(--status-online)' : 'var(--stroke-strong)' }}
      >
        <span
          className="absolute top-[2px] size-[14px] rounded-full bg-white transition-[left]"
          style={{ left: on ? 16 : 2 }}
        />
      </button>
    </div>
  );
}

function Row({ label, value, children, note }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-[12px]">{label}</div>
        {note ? <div className="mt-0.5 text-[11px] text-fg3">{note}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {value ? <span className="text-[12px] tabular-nums text-fg2">{value}</span> : null}
        {children}
      </div>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <section className="mb-4">
      <div className="mb-2 text-[11px] font-medium text-fg3">{title}</div>
      <div className="card divide-y px-3" style={{ borderColor: 'var(--stroke-subtle)' }}>{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState(() => new URLSearchParams(location.hash.split('?')[1] || '').get('tab') || '系统');
  const [q, setQ] = useState('');
  const [tog, setTog] = useState(loadToggles);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [shareTable, setShareTable] = useState('events');
  const [shareLink, setShareLink] = useState(null);
  const [sharing, setSharing] = useState(false);

  const setToggle = (k, v) => {
    const next = { ...tog, [k]: v };
    setTog(next);
    try { localStorage.setItem(LS, JSON.stringify(next)); } catch { /* 隐私模式忽略 */ }
  };

  const onShareExport = async () => {
    setSharing(true);
    setShareLink(null);
    try {
      const r = await send('shares', 'POST', { kind: 'export', targetId: shareTable, title: `导出 ${shareTable}` });
      setShareLink(shareUrl(r.id));
    } catch (err) {
      setShareLink(`失败：${err.message}`);
    } finally {
      setSharing(false);
    }
  };

  const onPickBackup = async (e, full = false) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const payload = JSON.parse(await file.text());
      const r = await send(`import/backup${full ? '?mode=full' : ''}`, 'POST', payload);
      setImportResult({
        ok: true,
        text: full
          ? `全量导入：好友 +${r.friends?.inserted ?? 0}(已有 ${r.friends?.skipped ?? 0}) · 世界 +${r.worlds?.inserted ?? 0}(已有 ${r.worlds?.skipped ?? 0}) · 动态 +${r.events?.inserted ?? 0}(已有 ${r.events?.skipped ?? 0}) · 备注 ${r.notes} · 标签 ${r.tags} · 收藏 ${r.favorites}`
          : `已导入 备注 ${r.notes} · 标签 ${r.tags} · 收藏 ${r.favorites}（好友/世界/事件 ${r.skipped?.events ?? 0} 条不导入）`,
      });
    } catch (err) {
      setImportResult({ ok: false, text: `导入失败：${err.message}` });
    } finally {
      setImporting(false);
    }
  };

  const { data, isError, error } = useQuery({
    queryKey: ['diagnostics'],
    queryFn: () => api('diagnostics'),
    refetchInterval: 30_000,
  });
  const { data: exp } = useQuery({
    queryKey: ['export-index'],
    queryFn: () => api('export/index.json'),
    staleTime: 60_000,
  });

  const c = data?.collector;
  const rate = data?.rate24h;
  const stale = data?.stale;
  const online = c?.connected === true;

  const sysRows = [
    ['启动', [
      <Switch key="boot" id="autostart" label="在 Windows 启动时自动启动" on={tog.autostart ?? true} onChange={(v) => setToggle('autostart', v)} />,
      <Switch key="min" id="startmin" label="以最小化的形式启动" on={tog.startmin ?? true} onChange={(v) => setToggle('startmin', v)} />,
    ]],
    ['窗口与托盘', [
      <Switch key="tray" id="tray" label="最小化到系统托盘" on={tog.tray ?? true} onChange={(v) => setToggle('tray', v)} />,
      <Row key="showhide" label="显示 / 隐藏 VRCX-0">
        <span className="text-[12px] text-fg3">未设置</span>
        <button className="chip">设置快捷键</button>
      </Row>,
      <Row key="lock" label="隐私锁定">
        <span className="text-[12px] text-fg3">未设置密码</span>
        <button className="chip">设置密码</button>
      </Row>,
      <Switch key="bg" id="traybg" label="最小化到托盘时切换到后台模式" on={tog.traybg ?? true} onChange={(v) => setToggle('traybg', v)} />,
      <Switch key="delay" id="delaybg" label="延迟切换到后台模式" on={tog.delaybg ?? true} onChange={(v) => setToggle('delaybg', v)} />,
      <Row key="mins" label="设置延迟（分钟）" value="30 分钟">
        <button className="chip">设置延迟（分钟）</button>
      </Row>,
      <Switch key="compat" id="compat" label="窗口兼容模式" note="需重启" on={tog.compat ?? false} onChange={(v) => setToggle('compat', v)} />,
    ]],
  ];

  const body = (
    <>
      {tab === '系统' ? sysRows.map(([title, rows]) => <Group key={title} title={title}>{rows}</Group>) : null}

      {tab === '高级' ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="chip" data-active={online ? 'true' : 'false'}>
              <span className="size-1.5 rounded-full" style={{ background: online ? 'var(--status-online)' : 'var(--status-busy)' }} />
              {isError ? '读不到诊断接口' : online ? '采集器在线' : '采集器离线'}
            </span>
            {c?.idleMinutes != null ? <span className="chip">最后消息 {c.idleMinutes} 分钟前</span> : null}
            {stale ? (
              <span className="chip" data-active={stale.isStale ? 'false' : 'true'} title={`阈值 ${stale.thresholdMinutes} 分钟`}>
                <span className="size-1.5 rounded-full" style={{ background: stale.isStale ? 'var(--status-busy)' : 'var(--status-online)' }} />
                {stale.isStale ? `采集断连 ${stale.idleMinutes} 分钟` : '采集心跳正常'}
              </span>
            ) : null}
            {data?.db ? <span className="chip">库 {data.db}</span> : null}
          </div>

          {isError ? (
            <div className="card p-6 text-[12px] text-fg3">/api/diagnostics 请求失败：{error?.message}</div>
          ) : (
            <>
              <Group title="诊断">
                <Row label="24 小时事件" value={`${rate?.events ?? '—'}（均 ${rate?.perHour ?? '—'} 条/小时）`} />
                <Row label="进房事件" value={String(rate?.gameEvents ?? '—')} note="需要 PC 端日志，可能为 0" />
                <Row label="追踪好友 / 世界" value={`${data?.friendsTracked ?? '—'} / ${data?.worldsTracked ?? '—'}`} />
                <Row label="累计消息" value={String(c?.msgCount ?? '—')} />
                <Row label="图片缓存" value={data?.cache ? `${data.cache.files} 张 · ${data.cache.human}` : '—'}
                  note={data?.cache ? `上限 ${data.cache.maxHuman}，超出自动删最旧` : ''} />
                <Row label="最后消息" value={fmtAt(c?.lastMsgAt)} />
                <Row label="最近错误" value={c?.lastError ?? '无'} />
              </Group>

              <Group title="CSV 多表导出">
                <div className="py-2" data-export-list>
                  <div className="mb-2 text-[12px] text-fg3">每张表一个 CSV（UTF-8 BOM）；行数是库里真实条数。</div>
                  {exp?.tables?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {exp.tables.map((t) => (
                        <a key={t.name} className="chip" data-export={t.name} href={`${BASE}${t.file}`} download title={`${t.label} · ${t.rows} 行`}>
                          {t.label}
                          <span className="ml-1 tabular-nums opacity-60">{t.rows}</span>
                        </a>
                      ))}
                    </div>
                  ) : <span className="text-[11px] text-fg3">读取表清单…</span>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2" style={{ borderColor: 'var(--stroke-subtle)' }}>
                    <span className="text-[11px] text-fg3">生成只读分享链接</span>
                    <select className="chip bg-transparent" value={shareTable} onChange={(e) => setShareTable(e.target.value)} data-share-select>
                      {(exp?.tables ?? []).map((t) => <option key={t.name} value={t.name}>{t.label}</option>)}
                    </select>
                    <button className="chip" onClick={onShareExport} disabled={sharing} data-share-export>{sharing ? '生成中…' : '生成链接'}</button>
                    {shareLink ? <span className="min-w-0 break-all text-[11px]" data-share-link>{shareLink}</span> : null}
                  </div>
                </div>
              </Group>

              <Group title="数据备份">
                <div className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 text-[12px] text-fg3">好友 / 世界 / 事件 / 收藏 / 备注 / 标签，一次导出成 JSON。</span>
                  <a className="chip" href={`${BASE}api/export/backup.json`} download>导出备份 JSON</a>
                </div>
                <div className="flex flex-wrap items-center gap-2 py-2" data-import="backup">
                  <span className="min-w-0 flex-1 text-[12px] text-fg3">
                    导入备份：备注 / 标签 / 收藏写回本地（备注以备份为准，标签收藏只补缺）；事件流不受影响。
                  </span>
                  <label className="chip" style={importing ? { opacity: 0.6, cursor: 'default' } : undefined}>
                    {importing ? '导入中…' : '选择备份 JSON'}
                    <input type="file" accept="application/json,.json" disabled={importing} className="hidden" data-import-input="backup" onChange={(e) => onPickBackup(e, false)} />
                  </label>
                  <label className="chip" title="空库时恢复整份备份；已有数据只补缺，不覆盖" style={importing ? { opacity: 0.6, cursor: 'default' } : undefined}>
                    {importing ? '导入中…' : '全量导入'}
                    <input type="file" accept="application/json,.json" disabled={importing} className="hidden" data-import-input="backup-full" onChange={(e) => onPickBackup(e, true)} />
                  </label>
                  {importResult ? (
                    <span className="text-[11px]" data-import-result={importResult.ok ? 'ok' : 'error'}
                      style={{ color: importResult.ok ? 'var(--status-online)' : 'var(--status-busy)' }}>{importResult.text}</span>
                  ) : null}
                </div>
              </Group>

              <Group title="手机版预览">
                <div className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 text-[12px] text-fg3">在桌面把界面套进 390×844 设备框，检查手机端间距与断行。</span>
                  <button
                    className="chip"
                    onClick={() => {
                      const params = new URLSearchParams(location.search);
                      const on = params.get('phone') === '1';
                      if (on) params.delete('phone'); else params.set('phone', '1');
                      localStorage.setItem('vrc-phone-preview', on ? '0' : '1');
                      location.search = params.toString();
                    }}
                  >
                    {new URLSearchParams(location.search).get('phone') === '1' ? '退出手机预览' : '开启手机预览'}
                  </button>
                </div>
              </Group>
            </>
          )}
        </>
      ) : null}

      {!['系统', '高级'].includes(tab) ? (
        <Group title={tab}>
          <div className="py-6 text-center text-[12px] text-fg3">「{tab}」暂无可调项；本项目只读 VRChat 数据，改动类设置集中在 系统 与 高级。</div>
        </Group>
      ) : null}
    </>
  );

  return (
    <div className="flex h-full min-h-0">
      <div className="settings-subnav w-[168px] shrink-0 border-r p-2" data-subnav style={{ borderColor: 'var(--stroke-subtle)' }}>
        {SUBNAV.map((s) => (
          <button
            key={s}
            data-active={s === tab ? 'true' : 'false'}
            onClick={() => setTab(s)}
            className="mb-0.5 w-full rounded-lg px-2.5 py-1.5 text-left text-[12px]"
            style={s === tab ? { background: 'var(--state-hover-surface)', color: 'var(--content-primary)' } : { color: 'var(--content-secondary)' }}
          >{s}</button>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-auto p-4">
        <h1 className="text-[15px] font-medium">设置</h1>
        <div className="mt-0.5 text-[12px] text-fg3">偏好设置、诊断与应用选项。</div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索设置"
          className="mt-3 h-8 w-full max-w-[360px] rounded-lg border px-2.5 text-[12px] outline-none"
          style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' }}
        />
        <div className="mt-4 max-w-[720px]">{body}</div>
      </div>
    </div>
  );
}
