/**
 * 两端各一份 DDL。字段语义一致，只差类型：
 * PG: timestamptz / jsonb / bigserial / boolean
 * SQLite: TEXT(ISO) / TEXT(json) / INTEGER PRIMARY KEY AUTOINCREMENT / INTEGER(0|1)
 */

export const PG = [
  `create schema if not exists vrc`,
  `create table if not exists vrc.account (
     id bigserial primary key,
     vrchat_user_id text unique not null,
     display_name text,
     last_ok_at timestamptz,
     created_at timestamptz not null default now()
   )`,
  `create table if not exists vrc.friend (
     user_id text primary key,
     display_name text, trust_level text, platform text,
     status text, status_description text,
     location text, world_id text, world_name text, group_name text,
     avatar_id text, icon_url text, is_favorite boolean default false,
     updated_at timestamptz not null default now()
   )`,
  `create table if not exists vrc.friend_event (
     id bigserial primary key,
     user_id text, display_name text, kind text not null,
     location text, world_id text, world_name text,
     payload jsonb, at timestamptz not null default now()
   )`,
  `create index if not exists friend_event_at_idx on vrc.friend_event (at desc)`,
  `create index if not exists friend_event_user_idx on vrc.friend_event (user_id, at desc)`,
  `create table if not exists vrc.world (
     id text primary key, name text, author_id text, author_name text,
     capacity int, thumbnail text, updated_at timestamptz not null default now(),
     visits_total bigint, favorites int, popularity int
   )`,
  `create table if not exists vrc.notification (
     id text primary key, type text, sender_user_id text, message text,
     link text, created_at timestamptz, seen boolean default false, payload jsonb
   )`,
  `create table if not exists vrc.game_event (
     id bigserial primary key, kind text not null,
     display_name text, user_id text, location text, world_name text,
     detail jsonb, at timestamptz not null
   )`,
  `create index if not exists game_event_at_idx on vrc.game_event (at desc)`,
  `create table if not exists vrc.self_event (
     id bigserial primary key, kind text not null,
     location text, world_id text, at timestamptz not null default now()
   )`,
  `create index if not exists self_event_at_idx on vrc.self_event (at desc)`,
  `create table if not exists vrc.collector_state (
     id int primary key default 1,
     connected boolean default false,
     last_msg_at timestamptz,
     msg_count bigint default 0,
     last_error text
   )`,
  `insert into vrc.collector_state (id) values (1) on conflict do nothing`,
  // 收藏：分组 + 收藏项（world / friend），pinned 的世界上侧栏
  `create table if not exists vrc.favorite_group (
     id text primary key, name text not null,
     sort_order int default 0, created_at timestamptz not null default now()
   )`,
  `create table if not exists vrc.favorite (
     id text primary key, kind text not null, target_id text not null,
     group_id text, note text, pinned boolean default false,
     sort_order int default 0, created_at timestamptz not null default now(),
     unique (kind, target_id)
   )`,
  `create index if not exists favorite_kind_idx on vrc.favorite (kind, sort_order)`,
  // 分享：世界 / 收藏合集的只读快照
  `create table if not exists vrc.share (
     id text primary key, kind text not null, target_id text,
     title text, payload jsonb, created_at timestamptz not null default now()
   )`,
  // 对外只读 API 令牌
  `create table if not exists vrc.api_token (
     token text primary key, name text, created_at timestamptz not null default now(),
     last_used_at timestamptz
   )`,
  // 第四轮：好友备注 / 标签（只存本地，不写 VRChat）
  `create table if not exists vrc.friend_note (
     user_id text primary key, note text, updated_at timestamptz not null default now()
   )`,
  `create table if not exists vrc.friend_tag (
     id text primary key, user_id text not null, tag text not null,
     created_at timestamptz not null default now(),
     unique (user_id, tag)
   )`,
  `create index if not exists friend_tag_user_idx on vrc.friend_tag (user_id)`,
  // 采集断连告警事件（同一 fingerprint 去重窗口内只记一条）
  `create table if not exists vrc.alert_event (
     id text primary key, fingerprint text not null, level text not null default 'P1',
     source text, message text, created_at timestamptz not null default now(), resolved_at timestamptz
   )`,
  `create index if not exists alert_event_fp_idx on vrc.alert_event (fingerprint, created_at desc)`,
  // 第五轮：好友行为沉淀（会话 / 世界访问 / 资料 diff / 状态历史 / 头像历史）
  `create table if not exists vrc.friend_session (
     id text primary key,
     user_id text not null,
     started_at timestamptz not null, ended_at timestamptz, minutes int,
     location text, world_id text, world_name text, status text
   )`,
  `create index if not exists friend_session_user_idx on vrc.friend_session (user_id, started_at desc)`,
  `create table if not exists vrc.friend_world_visit (
     id text primary key,
     user_id text not null, world_id text, world_name text, location text,
     started_at timestamptz not null, ended_at timestamptz, minutes int
   )`,
  `create index if not exists friend_visit_user_idx on vrc.friend_world_visit (user_id, started_at desc)`,
  `create index if not exists friend_visit_world_idx on vrc.friend_world_visit (world_id)`,
  `create table if not exists vrc.friend_change (
     id bigserial primary key, user_id text not null, field text not null,
     old_value text, new_value text, at timestamptz not null default now()
   )`,
  `create index if not exists friend_change_user_idx on vrc.friend_change (user_id, at desc)`,
  `create table if not exists vrc.friend_status_history (
     id bigserial primary key, user_id text not null, status text, description text,
     at timestamptz not null default now()
   )`,
  `create index if not exists friend_status_user_idx on vrc.friend_status_history (user_id, at desc)`,
  `create table if not exists vrc.friend_avatar_history (
     id bigserial primary key, user_id text not null, kind text not null, value text,
     at timestamptz not null default now()
   )`,
  `create index if not exists friend_avatar_user_idx on vrc.friend_avatar_history (user_id, at desc)`,
  // 老库补列
  `alter table vrc.friend add column if not exists icon_url text`,
  `alter table vrc.friend_event add column if not exists icon_url text`,
  `alter table vrc.friend add column if not exists tags text`,
  `alter table vrc.friend add column if not exists trust_rank int`,
  // 106 世界详情：官方访问量/收藏数/热度（collector 拉到就写，拉不到留空）
  `alter table vrc.world add column if not exists visits_total bigint`,
  `alter table vrc.world add column if not exists favorites int`,
  `alter table vrc.world add column if not exists popularity int`,
];

export const SQLITE = [
  `create table if not exists account (
     id integer primary key autoincrement,
     vrchat_user_id text unique not null,
     display_name text,
     last_ok_at text,
     created_at text not null default (datetime('now'))
   )`,
  `create table if not exists friend (
     user_id text primary key,
     display_name text, trust_level text, platform text,
     status text, status_description text,
     location text, world_id text, world_name text, group_name text,
     avatar_id text, icon_url text, is_favorite integer default 0,
     updated_at text not null default (datetime('now'))
   )`,
  `create table if not exists friend_event (
     id integer primary key autoincrement,
     user_id text, display_name text, kind text not null,
     location text, world_id text, world_name text,
     payload text, at text not null default (datetime('now'))
   )`,
  `create index if not exists friend_event_at_idx on friend_event (at desc)`,
  `create index if not exists friend_event_user_idx on friend_event (user_id, at desc)`,
  `create table if not exists world (
     id text primary key, name text, author_id text, author_name text,
     capacity integer, thumbnail text, updated_at text not null default (datetime('now')),
     visits_total integer, favorites integer, popularity integer
   )`,
  `create table if not exists notification (
     id text primary key, type text, sender_user_id text, message text,
     link text, created_at text, seen integer default 0, payload text
   )`,
  `create table if not exists game_event (
     id integer primary key autoincrement, kind text not null,
     display_name text, user_id text, location text, world_name text,
     detail text, at text not null
   )`,
  `create index if not exists game_event_at_idx on game_event (at desc)`,
  `create table if not exists self_event (
     id integer primary key autoincrement, kind text not null,
     location text, world_id text, at text not null default (datetime('now'))
   )`,
  `create index if not exists self_event_at_idx on self_event (at desc)`,
  `create table if not exists collector_state (
     id integer primary key default 1,
     connected integer default 0,
     last_msg_at text,
     msg_count integer default 0,
     last_error text
   )`,
  `insert or ignore into collector_state (id) values (1)`,
  `create table if not exists favorite_group (
     id text primary key, name text not null,
     sort_order integer default 0, created_at text not null default (datetime('now'))
   )`,
  `create table if not exists favorite (
     id text primary key, kind text not null, target_id text not null,
     group_id text, note text, pinned integer default 0,
     sort_order integer default 0, created_at text not null default (datetime('now')),
     unique (kind, target_id)
   )`,
  `create index if not exists favorite_kind_idx on favorite (kind, sort_order)`,
  `create table if not exists share (
     id text primary key, kind text not null, target_id text,
     title text, payload text, created_at text not null default (datetime('now'))
   )`,
  `create table if not exists api_token (
     token text primary key, name text,
     created_at text not null default (datetime('now')), last_used_at text
   )`,
  `create table if not exists friend_note (
     user_id text primary key, note text, updated_at text not null default (datetime('now'))
   )`,
  `create table if not exists friend_tag (
     id text primary key, user_id text not null, tag text not null,
     created_at text not null default (datetime('now')),
     unique (user_id, tag)
   )`,
  `create index if not exists friend_tag_user_idx on friend_tag (user_id)`,
  `create table if not exists alert_event (
     id text primary key, fingerprint text not null, level text not null default 'P1',
     source text, message text, created_at text not null default (datetime('now')), resolved_at text
   )`,
  `create index if not exists alert_event_fp_idx on alert_event (fingerprint, created_at desc)`,
  `create table if not exists friend_session (
     id text primary key, user_id text not null,
     started_at text not null, ended_at text, minutes integer,
     location text, world_id text, world_name text, status text
   )`,
  `create index if not exists friend_session_user_idx on friend_session (user_id, started_at desc)`,
  `create table if not exists friend_world_visit (
     id text primary key, user_id text not null, world_id text, world_name text, location text,
     started_at text not null, ended_at text, minutes integer
   )`,
  `create index if not exists friend_visit_user_idx on friend_world_visit (user_id, started_at desc)`,
  `create index if not exists friend_visit_world_idx on friend_world_visit (world_id)`,
  `create table if not exists friend_change (
     id integer primary key autoincrement, user_id text not null, field text not null,
     old_value text, new_value text, at text not null default (datetime('now'))
   )`,
  `create index if not exists friend_change_user_idx on friend_change (user_id, at desc)`,
  `create table if not exists friend_status_history (
     id integer primary key autoincrement, user_id text not null, status text, description text,
     at text not null default (datetime('now'))
   )`,
  `create index if not exists friend_status_user_idx on friend_status_history (user_id, at desc)`,
  `create table if not exists friend_avatar_history (
     id integer primary key autoincrement, user_id text not null, kind text not null, value text,
     at text not null default (datetime('now'))
   )`,
  `create index if not exists friend_avatar_user_idx on friend_avatar_history (user_id, at desc)`,
  `alter table friend add column tags text`,
  `alter table friend add column trust_rank integer`,
  `alter table world add column visits_total integer`,
  `alter table world add column favorites integer`,
  `alter table world add column popularity integer`,
];

export function ddlFor(dialect) {
  return dialect === 'sqlite' ? SQLITE : PG;
}
