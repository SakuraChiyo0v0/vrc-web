export const BASE = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/';

export async function api(path) {
  const r = await fetch(BASE + 'api/' + path);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

/** 写操作：POST / PATCH / DELETE，错误信息取服务端 error 字段 */
export async function send(path, method = 'POST', body) {
  const r = await fetch(BASE + 'api/' + path, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!r.ok) throw new Error(data?.error ?? `${path} → ${r.status}`);
  return data;
}

/** 服务端 /s/:id 在根路径，前端挂在 BASE 下，分享链接要带 BASE */
export function shareUrl(id) {
  return new URL(`${BASE}s/${id}`, location.origin).href;
}

/**
 * 图片走服务端代理：VRChat 的头像/缩略图要带登录 cookie，且是 302 到会过期的签名 CDN，
 * 浏览器直接引用拿不到图。后端 /api/img 取一次落盘缓存，这里只负责拼地址。
 * 空值返回 ''，调用方用 `src || undefined` 即可。
 */
export function imgUrl(u) {
  if (!u) return '';
  return `${BASE}api/img?u=${encodeURIComponent(u)}`;
}
