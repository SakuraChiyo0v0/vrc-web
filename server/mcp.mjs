#!/usr/bin/env node
/**
 * 只读 MCP 服务器（stdio，JSON-RPC 2.0，按行分隔）。
 * 暴露三个查询工具：insights / players / friends —— 数据全部来自本库，不写任何东西。
 *
 *   node server/mcp.mjs              # 挂到 MCP 客户端（如 Claude Desktop / Hermes）
 *   node server/mcp.mjs --selftest   # 连库跑一遍三个工具，打印 ok 并退出
 */
import readline from 'node:readline';
import { openDb } from './src/db/index.js';
import { dbUrl } from './src/config.js';
import { createStore } from './src/lib/store.js';

const iso = (v) => (v instanceof Date ? v.toISOString() : v);

const TOOLS = [
  {
    name: 'insights',
    description: '社交洞察：常一起玩的人、渐行渐远的人、最常遇到的小时分布',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: '回看天数，默认 90' },
        limit: { type: 'number', description: '每段条数，默认 10' },
      },
    },
  },
  {
    name: 'players',
    description: '同房遇到过的玩家列表（按次数排序）',
    inputSchema: {
      type: 'object',
      properties: {
        min_meets: { type: 'number', description: '最少遇到次数，默认 1' },
      },
    },
  },
  {
    name: 'friends',
    description: '好友列表与当前位置',
    inputSchema: {
      type: 'object',
      properties: {
        online_only: { type: 'boolean', description: '只看在线，默认 false' },
      },
    },
  },
];

async function buildStore() {
  const db = await openDb(dbUrl());
  const T = (n) => db.tbl(n);
  return { db, store: createStore({ db, T, iso }) };
}

async function callTool(store, name, args = {}) {
  if (name === 'insights') return store.insights({ days: args.days ?? 90, limit: args.limit ?? 10 });
  if (name === 'players') return { players: (await store.players({ minMeets: args.min_meets ?? 1 })).slice(0, 100) };
  if (name === 'friends') return { friends: await store.friends({ onlineOnly: !!args.online_only }) };
  throw new Error(`未知工具：${name}`);
}

if (process.argv.includes('--selftest')) {
  const { db, store } = await buildStore();
  try {
    const ins = await callTool(store, 'insights', { days: 90 });
    const pl = await callTool(store, 'players', { min_meets: 1 });
    const fr = await callTool(store, 'friends', {});
    const ok = ins && Array.isArray(ins.companions?.items)
      && Array.isArray(pl.players) && Array.isArray(fr.friends);
    console.log(`selftest insights=companions:${ins.companions.items.length},fading:${ins.fading.items.length},hours:${ins.hours.total} `
      + `players:${pl.players.length} friends:${fr.friends.length} db=${db.dialect}`);
    console.log(ok ? 'ok' : 'fail');
    if (!ok) process.exitCode = 1;
  } finally {
    await db.close();
  }
} else {
  const { db, store } = await buildStore();
  const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');

  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let req;
    try { req = JSON.parse(line); } catch { return; }
    const { id, method, params } = req;
    if (id === undefined) return; // 通知（notifications/initialized 等）不回应
    try {
      if (method === 'initialize') {
        send({
          jsonrpc: '2.0', id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'vrc-web', version: '1.0.0' },
          },
        });
      } else if (method === 'tools/list') {
        send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
      } else if (method === 'tools/call') {
        const out = await callTool(store, params?.name, params?.arguments ?? {});
        send({
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: JSON.stringify(out) }], isError: false },
        });
      } else if (method === 'ping') {
        send({ jsonrpc: '2.0', id, result: {} });
      } else {
        send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
      }
    } catch (e) {
      send({ jsonrpc: '2.0', id, error: { code: -32000, message: e.message } });
    }
  });
  rl.on('close', async () => {
    await db.close();
    process.exit(0);
  });
}
