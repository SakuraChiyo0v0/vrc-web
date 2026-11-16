/**
 * 搜索框粘贴 VRChat 链接 / 裸 ID 直达（69）。
 *
 * 支持：
 *   usr_xxxxxxxx-xxxx-...（32 位 uuid）
 *   wrld_xxxxxxxx-xxxx-...
 *   https://vrchat.com/home/user/usr_...
 *   https://vrchat.com/home/world/wrld_...
 *   https://vrchat.com/home/launch?worldId=wrld_...
 *   vrcx://user/usr_...  vrcx://world/wrld_...  vrchat://launch?id=wrld_...:12345
 * 附带尾缀（`:12345~region(jp)` / `?id=`）会被剥掉。
 *
 * 返回 { type: 'user' | 'world', id } 或 null。
 */
const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const BARE = new RegExp(`\\b(usr|wrld)_(${UUID})`, 'i');

export function parseVrcTarget(raw) {
  const text = String(raw ?? '').trim();
  if (!text || text.length > 300) return null;

  // 只认「整段输入就是一个 ID / 链接」的情况，避免把普通搜索词当 ID
  if (!/^(usr_|wrld_|https?:\/\/|vrcx:\/\/|vrchat:\/\/)/i.test(text)) return null;

  const m = text.match(BARE);
  if (!m) return null;
  // 链接里可能带 worldId=wrld_xxx，也可能 usr_ 出现在 query 里；以第一个命中的前缀为准
  return { type: m[1].toLowerCase() === 'usr' ? 'user' : 'world', id: `${m[1].toLowerCase()}_${m[2].toLowerCase()}` };
}

/** 直接给抽屉用：useful for tests too */
export function vrcTargetLabel(t) {
  if (!t) return '';
  return t.type === 'user' ? `直接打开好友 ${t.id}` : `直接打开世界 ${t.id}`;
}
