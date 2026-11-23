/**
 * 98 统一空态：小图标 + 一行说明 +（可选）副文案。
 * 真机各页空态都是这个形状：淡色描边图标居中、标题 13px、说明 12px 灰。
 * 用法：<Empty title="还没有收藏" hint="在上面填世界 / 用户 ID 加一条" icon="star" />
 */
const ICONS = {
  inbox: 'M4 13.5V19h16v-5.5M4 13.5 6.5 5h11L20 13.5M4 13.5h4.2l1 2h5.6l1-2H20',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19c0-2.8 2.5-4.5 5.5-4.5s5.5 1.7 5.5 4.5M16 11.5a2.5 2.5 0 1 0 0-5M17 14.8c2 .5 3.5 1.9 3.5 4.2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2',
  star: 'm12 4 2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.8-5 2.8 1-5.6-4-3.9 5.5-.8L12 4Z',
  vr: 'M4 15v-3a8 8 0 0 1 16 0v3M2 15h4v4H4a2 2 0 0 1-2-2v-2ZM22 15h-4v4h2a2 2 0 0 0 2-2v-2Z',
  shield: 'M12 3l7 3v6c0 4.2-2.9 7.5-7 9-4.1-1.5-7-4.8-7-9V6l7-3Z',
  bell: 'M6 9a6 6 0 1 1 12 0c0 3 .8 4.6 1.6 5.6.4.5 0 1.4-.7 1.4H5.1c-.7 0-1.1-.9-.7-1.4C5.2 13.6 6 12 6 9ZM10 19a2 2 0 0 0 4 0'
};

export default function Empty({ title, hint, icon = 'inbox', compact = false }) {
  return (
    <div className={`empty${compact ? ' empty-compact' : ''}`} data-empty="1" data-icon={icon}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={ICONS[icon] ?? ICONS.inbox} />
      </svg>
      <div className="empty-title">{title}</div>
      {hint ? <div className="empty-hint">{hint}</div> : null}
    </div>
  );
}
