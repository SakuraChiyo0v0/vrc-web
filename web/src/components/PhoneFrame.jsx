/**
 * 手机版预览（?phone=1）
 *
 * 为什么要用 iframe：媒体查询看的是**视口宽度**，不是容器宽度。
 * 直接在桌面页面上给 #root 设 390px，`@media (max-width:767px)` 依然不触发，
 * 结果就是「桌面布局被塞进窄框」——试过，顶部状态直接叠字。
 * 用同源 iframe 把视口真的变成 390×844，媒体查询、抽屉、两行好友行才会真实生效。
 */
const PHONE_W = 390;
const PHONE_H = 844;

export default function PhoneFrame() {
  const url = new URL(location.href);
  url.searchParams.delete('phone');
  const src = url.pathname + (url.search || '') + url.hash;

  return (
    <div className="flex min-h-full flex-col items-center gap-3 py-6">
      <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--content-tertiary)' }}>
        <span>手机预览 · {PHONE_W}×{PHONE_H}</span>
        <button
          className="chip"
          onClick={() => {
            const u = new URL(location.href);
            u.searchParams.delete('phone');
            localStorage.setItem('vrc-phone-preview', '0');
            location.href = u.toString();
          }}
        >
          退出预览
        </button>
      </div>
      <iframe
        title="手机预览"
        src={src}
        width={PHONE_W}
        height={PHONE_H}
        style={{
          border: '1px solid var(--stroke-default)',
          borderRadius: 18,
          boxShadow: '0 24px 60px -24px rgb(0 0 0 / .35)',
          background: 'var(--surface-canvas)',
        }}
      />
    </div>
  );
}
