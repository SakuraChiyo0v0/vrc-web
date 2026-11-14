-- VRC Web · 采集与展示所需的最小 schema
create schema if not exists vrc;

create table if not exists vrc.account (
  id              bigserial primary key,
  vrchat_user_id  text unique not null,
  display_name    text,
  cookie_enc      bytea,
  cookie_iv       bytea,
  last_ok_at      timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists vrc.friend (
  user_id            text primary key,
  display_name       text,
  trust_level        text,
  platform           text,
  status             text,
  status_description text,
  location           text,
  world_id           text,
  world_name         text,
  group_name         text,
  avatar_id          text,
  is_favorite        boolean default false,
  updated_at         timestamptz not null default now()
);

create table if not exists vrc.friend_event (
  id          bigserial primary key,
  user_id     text,
  display_name text,
  kind        text not null,
  location    text,
  world_id    text,
  world_name  text,
  payload     jsonb,
  at          timestamptz not null default now()
);
create index if not exists friend_event_at_idx on vrc.friend_event (at desc);
create index if not exists friend_event_user_idx on vrc.friend_event (user_id, at desc);

create table if not exists vrc.world (
  id         text primary key,
  name       text,
  author_id  text,
  author_name text,
  capacity   int,
  thumbnail  text,
  updated_at timestamptz not null default now()
);

create table if not exists vrc.notification (
  id             text primary key,
  type           text,
  sender_user_id text,
  message        text,
  link           text,
  created_at     timestamptz,
  seen           boolean default false,
  payload        jsonb
);

create table if not exists vrc.collector_state (
  id         int primary key default 1,
  connected  boolean default false,
  last_msg_at timestamptz,
  msg_count  bigint default 0,
  last_error text
);
insert into vrc.collector_state (id) values (1) on conflict do nothing;
