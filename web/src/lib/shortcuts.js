/**
 * 键盘快捷键（68）：Ctrl/⌘ + 数字按侧栏顺序跳页，`?`（Shift+/）打开快捷键表。
 *
 * 纯函数，方便 node 直接跑测试：
 *   resolveShortcut({ key, ctrlKey, metaKey, shiftKey, altKey, inEditable })
 *   → { type: 'navigate', page } | { type: 'help' } | null（不处理，交给浏览器）
 */

/** 侧栏顺序（Sidebar.jsx GROUPS 展开后的顺序，1~9 对应前九个页面） */
export const PAGE_ORDER = [
  'friends', 'feed', 'notifications',
  'friendlist', 'friendlog', 'players',
  'stats', 'insights', 'sessions',
  'gamelog', 'worlds', 'calendar', 'favorites', 'settings'
];

export const PAGE_LABEL = {
  friends: '好友位置',
  feed: '动态',
  notifications: '通知',
  friendlist: '好友列表',
  friendlog: '好友历史',
  players: '玩家',
  stats: '统计',
  insights: '洞察',
  sessions: '我的行程',
  gamelog: '游戏日志',
  worlds: '世界库',
  calendar: '日历',
  favorites: '收藏',
  settings: '设置'
};

const isEditable = (target) => !!target && (
  target.isContentEditable
  || ['INPUT', 'TEXTAREA', 'SELECT'].includes(String(target.tagName ?? '').toUpperCase())
);

export function resolveShortcut(e) {
  if (!e || e.altKey) return null;
  const mod = !!(e.metaKey || e.ctrlKey);
  const key = String(e.key ?? '');

  // `?` 只在非输入态触发：输入框里打问号是正常输入
  if (!mod && key === '?') {
    return isEditable(e.target) ? null : { type: 'help' };
  }

  if (!mod) return null;

  // 输入框里 Ctrl/⌘+数字 仍生效（VRCX useGlobalKeyboardShortcuts 同款）
  if (/^[1-9]$/.test(key)) {
    const page = PAGE_ORDER[Number(key) - 1];
    return page ? { type: 'navigate', page, digit: Number(key) } : null;
  }
  return null;
}
