const BASE = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/';

export async function api(path) {
  const r = await fetch(BASE + 'api/' + path);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}
