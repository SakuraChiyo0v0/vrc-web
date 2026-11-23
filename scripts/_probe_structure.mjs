/**
 * 临时探针：dump 各页面「结构类」DOM 事实（表头、tab、chips、按钮、卡片列数），
 * 供 structure_parity.mjs 写断言时对照 spec.pages[*].structure。不入库。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = pw;

const ROOT = '/opt/data/apps/vrc-web';
const BASE = process.argv[2] || 'http://127.0.0.1:8897/vrc';
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/ref/vrcx0-spec.json'), 'utf8'));
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const targets = Object.entries(SPEC.pages).filter(([, v]) => v.structure).map(([k, v]) => [k, v.structure]);
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1688, height: 1028 }, deviceScaleFactor: 1 });
const out = {};
try {
  for (const [name, st] of targets) {
    await page.goto(`${BASE}/#/${name}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);
    out[name] = await page.evaluate(() => {
      const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
      const ws = document.querySelector('.workspace') || document.body;
      const ths = [...ws.querySelectorAll('thead th')].map(txt);
      const tabs = [...ws.querySelectorAll('[role="tab"]')].map(txt);
      const btns = [...ws.querySelectorAll('button, [role="button"]')].map(txt).filter(Boolean);
      const chips = [...ws.querySelectorAll('.chip, [class*="chip"]')].map(txt).filter(Boolean);
      const heads = [...ws.querySelectorAll('h1,h2,h3,h4,.group-head,[class*="group-head"]')].map(txt).filter(Boolean);
      // 内容面板里所有可见叶子的 x 起点聚类，用来数网格列
      const cards = [...ws.querySelectorAll('.card, [class*="card"]')].filter((e) => e.getBoundingClientRect().height > 40);
      const xs = [...new Set(cards.map((c) => Math.round(c.getBoundingClientRect().x)))].sort((a, b) => a - b);
      return {
        textSample: txt(ws).slice(0, 400),
        ths, tabs, btns: btns.slice(0, 40), chips: chips.slice(0, 20), heads: heads.slice(0, 20),
        tableCount: ws.querySelectorAll('table').length,
        cardCount: cards.length, cardXs: xs
      };
    });
  }
} finally { await browser.close(); }

for (const [name, st] of targets) {
  console.log('='.repeat(72));
  console.log(name, JSON.stringify(st));
  console.log(JSON.stringify(out[name], null, 1));
}
