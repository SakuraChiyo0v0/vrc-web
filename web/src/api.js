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
 *
 * `size` 可选：VRChat 图片地址最后一段是边长档（…/3/256 这种 3=版本、256=边长），
 * 库里存的都是 256 档，世界卡片 316px 宽、详情大图更宽，按 256 直接拉会糊。
 * 传 size 就换掉最后一段（512/1024 都实测可取），不传保持原样。
 */
export function imgUrl(u, size) {
  if (!u) return '';
  const url = size ? String(u).replace(/\/(\d{2,4})$/, `/${size}`) : u;
  return `${BASE}api/img?u=${encodeURIComponent(url)}`;
}
