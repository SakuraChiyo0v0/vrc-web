/**
 * 顶栏图标：1.5px 线性图标，尺寸跟 CSS px（真机截图 110% 下 15–17px → 这里 14–16）。
 * 不引第三方图标库（本项目只依赖 react），路径按 VRCX-0 截图里的形状手写。
 */
const Svg = ({ size = 16, children, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

export const IconSearch = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></Svg>
);

export const IconBell = (p) => (
  <Svg {...p}><path d="M6 9a6 6 0 1112 0c0 5 1.6 6.5 1.6 6.5H4.4S6 14 6 9z" /><path d="M10 19.5a2 2 0 003.8 0" /></Svg>
);

export const IconSparkle = (p) => (
  <Svg {...p}><path d="M12 3.5l1.7 4.6 4.6 1.7-4.6 1.7L12 16l-1.7-4.5L5.7 9.8l4.6-1.7z" /><path d="M18 16.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></Svg>
);

export const IconMoon = (p) => (
  <Svg {...p}><path d="M20.5 14.3A8.5 8.5 0 1110 3.7a7 7 0 0010.5 10.6z" /></Svg>
);

export const IconSun = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" /></Svg>
);

export const IconPin = (p) => (
  <Svg {...p}><path d="M9.5 3.5h5l-1 6 3.5 3.5H7L10.5 9.5z" /><path d="M12 13v7" /></Svg>
);

export const IconSplit = (p) => (
  <Svg {...p}><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M12 5v14" /></Svg>
);

export const IconCollapseRight = (p) => (
  <Svg {...p}><path d="M20 5v14" /><path d="M4 12h11" /><path d="M11.5 8.5L15 12l-3.5 3.5" /></Svg>
);

export const IconMinimize = (p) => (<Svg {...p}><path d="M5 12h14" /></Svg>);
export const IconMaximize = (p) => (<Svg {...p}><rect x="5.5" y="5.5" width="13" height="13" rx="1" /></Svg>);
export const IconClose = (p) => (<Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>);
