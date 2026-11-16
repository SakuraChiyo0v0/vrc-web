import { useEffect } from 'react';

/**
 * 手机预览（?phone=1）：把 #root 套进 390×844 的设备框里，
 * 桌面宽屏也能直接看手机版布局，不影响真实窄屏（媒体查询照旧生效）。
 * 状态存在地址栏，分享链接即可让别人看到同一视图。
 */
export default function PhonePreview() {
  useEffect(() => {
    const on = new URLSearchParams(location.search).get('phone') === '1'
      || localStorage.getItem('vrc-phone-preview') === '1';
    if (on) document.documentElement.dataset.phone = '1';
    else delete document.documentElement.dataset.phone;
  }, []);
  return null;
}
