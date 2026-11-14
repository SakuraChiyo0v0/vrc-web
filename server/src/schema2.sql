
-- 会话视图：从事件流推导「某人在某世界的停留区间」
create or replace view vrc.v_session as
with ev as (
  select user_id, display_name, kind, location, world_id, world_name, at
    from vrc.friend_event
   where kind in ('online', 'location', 'offline', 'active')
),
ordered as (
  select ev.*,
         lead(at)   over (partition by user_id order by at) as next_at,
         lead(kind) over (partition by user_id order by at) as next_kind
    from ev
)
select user_id, display_name, location, world_id, world_name,
       at as start_at, next_at as end_at,
       round(extract(epoch from (next_at - at)) / 60.0) as minutes
  from ordered
 where kind in ('online', 'location')
   and location is not null
   and location not in ('offline', 'private', 'traveling')
   and next_at is not null;

-- 游戏内日志（log-agent 推上来）
create table if not exists vrc.game_event (
  id           bigserial primary key,
  kind         text not null,
  display_name text,
  user_id      text,
  location     text,
  world_name   text,
  detail       jsonb,
  at           timestamptz not null
);
create index if not exists game_event_at_idx on vrc.game_event (at desc);
create index if not exists game_event_user_idx on vrc.game_event (user_id, at desc);

-- 我自己的位置变化
create table if not exists vrc.self_event (
  id       bigserial primary key,
  kind     text not null,
  location text,
  world_id text,
  at       timestamptz not null default now()
);
create index if not exists self_event_at_idx on vrc.self_event (at desc);
