import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './styles.css';

const qc = new QueryClient({ defaultOptions: { queries: { refetchInterval: 15000, staleTime: 5000 } } });

// 112 PWA：注册外壳 Service Worker（只在生产构建里；dev 下热更新会被缓存搅乱）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      {/* 172 外壳（侧栏/常驻面板/浮层）异常也不整页白屏：根边界兜底，页面级边界仍在其内 */}
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);
