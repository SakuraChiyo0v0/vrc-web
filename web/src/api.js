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
