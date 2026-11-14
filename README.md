# vrc-web

自建的 VRChat 数据面板：NAS 常驻采集好友动态与游戏内日志，浏览器查看，数据落 PostgreSQL 或 SQLite。

## 数据库：一套代码，两种后端

| 环境 | 连接串 | 说明 |
|---|---|---|
| 服务器（NAS） | `postgres://user:pass@host:5432/db` | schema `vrc`，首次启动自动建表 |
| Windows / 本机 | `sqlite:./data/vrc.db` | 零依赖，文件不存在自动建 |

判定规则：连接串以 `sqlite:` 开头、或等于 `:memory:`、或结尾是 `.db` / `.sqlite` → SQLite，其余按 PostgreSQL。
两个连接串都不给、又读不到 `VRC_DB_URL_FILE` 时，自动落到 `sqlite:./data/vrc.db`（本机开发零配置）。

代码里只写 `?` 占位符的 SQL，适配层负责翻译（`$1..$n`）、时间类型（timestamptz ↔ ISO 字符串）、
布尔（boolean ↔ 0/1）、JSON（jsonb ↔ TEXT）和表名前缀（`vrc.friend` ↔ `friend`）。
会话、统计这类需要方言函数的计算全部在 JS 里做，所以两端结果一致。

## 能做什么

- **好友位置**：谁在线、在哪个世界、状态与平台
- **动态**：上线 / 下线 / 换房 / 资料变更的实时流水
- **我的行程**：进出过的世界与停留时长
- **玩家**：同房遇到过的人（需要 PC 端日志代理）
- **统计**：近 24 小时事件分布与最热闹的世界
- **通知**：邀请、好友请求、群公告

## 数据从哪来

| 通道 | 内容 | 部署位置 |
|---|---|---|
| VRChat pipeline WebSocket | 好友上下线、换房、头像、状态、通知 | 服务器常驻 |
| VRChat REST API | 好友资料、世界信息（缓存） | 服务器常驻 |
| VRChat `output_log_*.txt` | 房间内玩家进出、播放的视频 | PC 端 `agent/agent.mjs` |

游戏内日志只能在装了 VRChat 的机器上读，所以那部分由一个单文件 agent 推上来；不开 agent 时其余功能正常，只是缺房间内细节。

## 部署

```bash
docker run -d --name vrc-web --restart unless-stopped \
  -p 8790:8790 \
  -e VRC_SESSION_FILE=/secrets/vr-session.json \
  -e VRC_DB_URL_FILE=/secrets/db-url \
  -e VRC_INGEST_TOKEN_FILE=/secrets/ingest.token \
  -v /path/to/vr-session.json:/secrets/vr-session.json:ro \
  -v /path/to/db-url:/secrets/db-url:ro \
  -v /path/to/ingest.token:/secrets/ingest.token:ro \
  ghcr.io/sakurachiyo0v0/vrc-web:latest
```

三个文件：

- `vr-session.json`：`{"cookie": "<VRChat auth cookie>", "userId": "usr_...", "displayName": "..."}`
- `db-url`：`postgres://user:pass@host:5432/db`
- `ingest.token`：任意随机串，PC 端 agent 用它鉴权

首次启动自动建表（PostgreSQL 建在 schema `vrc`，SQLite 直接建在当前库）。

本机开发（Windows / macOS / Linux 都行，不需要装数据库）：

```powershell
set VRC_DB_URL=sqlite:./data/vrc.db
node server/src/index.js
# 或先灌样例数据看界面
node server/scripts/smoke.mjs
```

## PC 端日志代理

```powershell
set VRC_INGEST_URL=http://<nas>:8790
set VRC_INGEST_TOKEN=<ingest.token 的内容>
node agent/agent.mjs
```

只读 `%LOCALAPPDATA%Low\VRChat\VRChat\output_log_*.txt`，不改游戏文件、不用 mod。

## 接口

```
GET  /api/status          采集器状态 + 账号 + 在线数
GET  /api/friends[?online=1]
GET  /api/events?limit=
GET  /api/sessions        好友会话（从事件流推导）
GET  /api/my-sessions     自己的行程
GET  /api/players         同房遇到的人
GET  /api/stats           近 24 小时统计
GET  /api/notifications
POST /ingest/log          PC agent 上报（x-ingest-token）
```

## 已知限制

- 只读：不做加好友、邀请、改状态这类写操作
- 一个 VRChat 账号只允许一条 pipeline 连接，别同时跑两个实例
- 长期 WebSocket 采集在 VRChat 服务条款的灰区，自用为主，控制频率

## License

MIT
