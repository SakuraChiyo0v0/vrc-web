/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
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
