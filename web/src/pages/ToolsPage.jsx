import { IconBell, IconSparkle } from '../components/icons.jsx';

/**
 * 工具，对齐真机侧栏「工具」项（docs/ref/nav-inventory.json row 21）。
 * 真机这一页是「多工具集合」，内容没有参考图；这里按真机结构做成工具入口网格：
 * 把我们自建、但真机侧栏里没有独立入口的功能（统计 / 洞察 / 通知 / 日历 / 遇到过的玩家）
 * 收进来，主干侧栏因此与真机一致，功能一个不丢。
 */
const TOOLS = [
  {
    id: 'stats',
    label: '统计',
    hint: '近 7 / 30 天事件量、热力图与最常去的世界',
    keys: ['stats']
  },
  {
    id: 'insights',
    label: '洞察',
    hint: '常一起玩 / 渐行渐远 / 最常遇到的时段',
    keys: ['insights']
  },
  {
    id: 'notifications',
    label: '通知',
    hint: '邀请 / 好友请求 / 群公告（顶栏铃铛同一个入口）',
    keys: ['notifications']
  },
  {
    id: 'calendar',
    label: '日历',
    hint: '按天回看事件，点某天看当天',
    keys: ['calendar']
  },
  {
    id: 'encounters',
    label: '遇到过的玩家',
    hint: '同房遇到过的人、共处次数排行',
    keys: ['encounters']
  }
];

export default function ToolsPage() {
  return (
    <div className="p-4" data-page="tools">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-[13px] font-medium">工具</span>
        <span className="text-[11px] tabular-nums text-fg3" data-count={TOOLS.length}>{TOOLS.length} 个</span>
      </div>
      <div className="world-grid" data-grid="tools">
        {TOOLS.map((t) => (
          <a
            key={t.id}
            href={`#/${t.id}`}
            className="card block p-2.5 no-underline"
            data-tool={t.id}
          >
            <span className="mb-1 flex items-center gap-1.5 text-[12px]">
              {t.id === 'notifications' ? <IconBell size={14} /> : t.id === 'insights' ? <IconSparkle size={14} /> : null}
              <span className="truncate">{t.label}</span>
            </span>
            <span className="block truncate text-[11px] text-fg3">{t.hint}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
