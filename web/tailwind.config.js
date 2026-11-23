/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    // 移动形态 = 窄 (≤767) 或矮 (≤500，手机横屏 844×390 一类)。
    // 用 raw 让 md: 前缀跟着 styles.css 的同一条件走，否则横屏会出现「抽屉侧栏 + 桌面顶栏（☰ 被隐藏）」的死锁。
    screens: {
      md: { raw: '(min-width: 768px) and (min-height: 501px)' }
    },
    extend: {
      colors: {
        canvas: 'var(--surface-canvas)',
        shell: 'var(--surface-shell)',
        panel: 'var(--surface-panel)',
        raised: 'var(--surface-raised)',
        fg: 'var(--content-primary)',
        fg2: 'var(--content-secondary)',
        fg3: 'var(--content-tertiary)',
        subtle: 'var(--stroke-subtle)',
        stroke: 'var(--stroke-default)',
        strong: 'var(--stroke-strong)',
        hover: 'var(--state-hover-surface)',
        selected: 'var(--state-selected-surface)'
      },
      borderRadius: { DEFAULT: '8px', md: '8px', lg: '10px', xl: '12px' }
    }
  },
  plugins: []
};
