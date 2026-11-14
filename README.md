# vrc-web

自建的 VRChat 数据面板：NAS 常驻采集好友动态与游戏内日志，浏览器查看，数据落 PostgreSQL。

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

首次启动自动建表（schema `vrc`）。

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
