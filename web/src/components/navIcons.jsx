/**
 * 侧栏导航图标：14px 线性矢量，路径按 VRCX-0 侧栏截图里的形状手写。
 *
 * 为什么不用字体字符：第 32 轮实测 `⧉`(U+29C9) 在 Chromium 字体链里缺字 —— 渲染成 6.6px 的
 * 豆腐框（与 U+E000 私有区同宽），「遇到过的玩家」整行图标变方框。同类问题在动态页类型列
 * 已经踩过一次（⌖ U+2316）。导航 21 行一律改成内联 SVG，跨平台不再依赖字体覆盖。
 */
const Svg = ({ children }) => (
  <svg
    className="nav-glyph" viewBox="0 0 16 16" width="14" height="14"
    aria-hidden="true" focusable="false" fill="none" stroke="currentColor"
    strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const NAV_ICON = {
  overview: <Svg><path d="M8 1.6l4.6 6.4L8 14.4 3.4 8z" /><path d="M8 5.4l2.2 2.6L8 10.6 5.8 8z" /></Svg>,
  feed: <Svg><path d="M2.6 4h10.8M2.6 8h10.8M2.6 12h7.2" /></Svg>,
  friends: <Svg><circle cx="8" cy="8" r="5.6" /><circle cx="8" cy="8" r="1.8" fill="currentColor" stroke="none" /></Svg>,
  gamelog: <Svg><circle cx="8" cy="8" r="5.6" /><path d="M8 4.6V8l2.4 1.6" /></Svg>,
  sessions: <Svg><path d="M8 1.8L14.2 8 8 14.2 1.8 8z" /></Svg>,
  players: <Svg><circle cx="8" cy="8" r="5.6" /><path d="M6 6.6h.01M10 6.6h.01" /><path d="M5.6 9.6a3.2 3.2 0 004.8 0" /></Svg>,
  search: <Svg><circle cx="7.2" cy="7.2" r="4.2" /><path d="M10.4 10.4l3 3" /></Svg>,
  fav: <Svg><path d="M8 1.9l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.7 4.2 13.7l.7-4.3-3.1-3 4.3-.6z" /></Svg>,
  favorites: <Svg><path d="M8 1.9l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.7 4.2 13.7l.7-4.3-3.1-3 4.3-.6z" /></Svg>,
  worlds: <Svg><rect x="2.4" y="2.4" width="11.2" height="11.2" rx="1.4" /><path d="M2.4 6h11.2M6 6v7.6" /></Svg>,
  calendar: <Svg><rect x="2.4" y="3.2" width="11.2" height="10.4" rx="1.4" /><path d="M2.4 6.4h11.2M5.6 1.8v2.4M10.4 1.8v2.4" /><path d="M5.6 9h.01M8 9h.01M10.4 9h.01M5.6 11.2h.01M8 11.2h.01" /></Svg>,
  social: <Svg><circle cx="5.2" cy="5.2" r="2.4" /><circle cx="10.8" cy="10.8" r="2.4" /><path d="M7.6 7.6l1.6 1.6" /></Svg>,
  friendlist: <Svg><path d="M2.6 4.4h10.8M2.6 8h10.8M2.6 11.6h10.8" /><path d="M1.6 2.4v11.2" /></Svg>,
  friendlog: <Svg><path d="M13 8a5 5 0 11-1.6-3.7" /><path d="M13.2 2.6v3h-3" /></Svg>,
  moderation: <Svg><path d="M8 1.8l5 2v4.3c0 3-2 5.3-5 6.1-3-.8-5-3.1-5-6.1V3.8z" /><path d="M8 5v6.4" /></Svg>,
  encounters: <Svg><rect x="2.4" y="2.4" width="8" height="8" rx="1.2" /><path d="M5.6 13.6h6.8a1.2 1.2 0 001.2-1.2V5.6" /></Svg>,
  notifications: <Svg><path d="M5.2 6.6a2.8 2.8 0 015.6 0c0 2.6.8 3.4.8 3.4H4.4s.8-.8.8-3.4z" /><path d="M6.9 12.2a1.4 1.4 0 002.2 0" /></Svg>,
  stats: <Svg><path d="M3 12.4V8.6M8 12.4V3.6M13 12.4V6.4" /><path d="M1.8 14h12.4" /></Svg>,
  insights: <Svg><path d="M6.6 2.2l1.1 2.8 2.8 1.1-2.8 1.1-1.1 2.8-1.1-2.8L2.7 6.1l2.8-1.1z" /><path d="M11.6 9.4l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z" /></Svg>,
  settings: <Svg><circle cx="8" cy="8" r="2.2" /><path d="M8 1.8v1.8M8 12.4v1.8M1.8 8h1.8M12.4 8h1.8M3.6 3.6l1.3 1.3M11.1 11.1l1.3 1.3M12.4 3.6l-1.3 1.3M4.9 11.1l-1.3 1.3" /></Svg>,
  collapse: <Svg><path d="M2.6 2.6v10.8" /><path d="M13 8H5.8" /><path d="M8.6 5.2L5.4 8l3.2 2.8" /></Svg>
};
