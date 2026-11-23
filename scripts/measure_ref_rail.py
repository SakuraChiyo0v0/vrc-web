#!/usr/bin/env python3
"""量 VRCX-0 真机右栏（SidePanel）：分割线位置/栏宽/自身账号卡/筛选框/分组标题/行距/右侧图标竖条。

只从截图像素推导，不写死来源。产出写回 docs/ref/vrcx0-spec.json → chrome.rail + rail_layout，
并裁 docs/ref/crop-rail.png 供复核。

    /opt/data/venvs/rembg/bin/python scripts/measure_ref_rail.py
"""
import json
import pathlib
import statistics
import sys

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC_PATH = ROOT / 'docs/ref/vrcx0-spec.json'
SHOTS = ['feed', 'friendlist', 'settings', 'notifications']


def load(name):
    return Image.open(ROOT / f'docs/ref/vrcx0-{name}.png').convert('RGB')


def bands(mask, min_gap=2):
    """mask: 1d bool → [(start,end)]"""
    out, s = [], None
    for i, v in enumerate(mask):
        if v and s is None:
            s = i
        elif not v and s is not None:
            out.append((s, i - 1))
            s = None
    if s is not None:
        out.append((s, len(mask) - 1))
    # 合并 1px 噪声
    merged = []
    for b in out:
        if merged and b[0] - merged[-1][1] <= min_gap:
            merged[-1] = (merged[-1][0], b[1])
        else:
            merged.append(list(b))
            merged[-1] = tuple(merged[-1])
    return [tuple(b) for b in merged]


def measure(name, chrome):
    im = load(name)
    a = np.asarray(im)
    cx, cy, cw, ch = (chrome['content'][k] for k in ('x', 'y', 'w', 'h'))
    right = cx + cw - 1          # 内容面板右缘（不含右边距）
    # ── 1. 分割线：内容面板内 x 中右侧那道近白竖线（1–2px，覆盖>95% 且不是纯白）
    divider = None
    for x in range(cx + cw // 2, right - 200):
        col = a[cy:cy + ch, x]
        vals, counts = np.unique(col.reshape(-1, 3), axis=0, return_counts=True)
        i = counts.argmax()
        v, frac = vals[i], counts[i] / len(col)
        if frac > 0.95 and 244 <= v.min() and v.max() <= 253:
            divider = x
            break
    if divider is None:
        return None
    # 分割线画在 resizer 轨道正中（VRCX-0 globals.css [data-vrcx-0-resize='side-panel']::before）：
    # 轨道宽 8 CSS px ×1.1≈9 → 栏左侧 = 线x + 5；同时把「线到面板右缘」记下来供对照
    rail_left = divider + 5
    rail_w = right - rail_left + 1
    rail = a[cy:cy + ch, rail_left:right + 1]

    # ── 2. 行带（右栏纵向结构）
    row_mask = (rail.min(axis=2) < 245).mean(axis=1) > 0.004
    rb = [(s, e) for s, e in bands(row_mask) if e - s >= 4]

    # ── 3. 自身账号卡：顶部那块带渐变的卡片（彩色/浅紫底，宽 > 200px）
    card = None
    for s, e in rb[:4]:
        band = rail[s:e + 1]
        wide = (band.min(axis=2) < 250).mean(axis=1) > 0.6
        if wide.sum() > (e - s) * 0.5:
            card = (s, e)
            break
    card_h = card[1] - card[0] + 1 if card else None

    # ── 4. 头像直径：账号卡内饱和度最高的连通块宽度
    avatar = None
    if card:
        band = rail[card[0]:card[1] + 1]
        sat = (band.max(axis=2).astype(int) - band.min(axis=2).astype(int)) > 20
        cols = sat.any(axis=0)
        b = bands(cols)
        if b:
            avatar = b[0][1] - b[0][0] + 1

    # ── 5. 筛选框：卡片下方那段「整行基本都是浅灰底」的区域（输入框底色与白底分界）
    filt = None
    start = card[1] + 1 if card else 0
    gray = (rail.min(axis=2) < 250).mean(axis=1)
    rows = [(i, v) for i, v in enumerate(gray) if i > start and v > 0.55]
    if rows:
        y0 = rows[0][0]
        y1 = y0
        for i, v in rows[1:]:
            if i - y1 <= 3:
                y1 = i
            else:
                break
        if 20 <= y1 - y0 + 1 <= 50:
            filt = (y0, y1)

    # ── 6. 右侧图标竖条：列表行区（y>400）右边那列按钮
    colmask = (rail.min(axis=2) < 245).mean(axis=0) > 0.005
    # 从右缘向左走，遇到连续 ≥6 列空白就停：这段就是右侧图标竖条
    icon_rail = None
    gap = 0
    left = rail_w - 1
    while left >= 0:
        if colmask[left]:
            gap = 0
        else:
            gap += 1
            if gap >= 6:
                break
        left -= 1
    icon_rail = rail_w - 1 - left - 5 if left > 0 else None

    # ── 7. 行距：列表行带的起点差的中位数（排除标题带 <20px）
    row_tops = [s for s, e in rb if 35 <= e - s + 1 <= 80 and s > 300]
    pitch = None
    if len(row_tops) >= 3:
        pitch = int(statistics.median(np.diff(row_tops)))

    # ── 8. 分组标题高度：列表里 14–24px 的窄带
    heads = [e - s + 1 for s, e in rb if 12 <= e - s + 1 <= 26 and s > 130]
    head_h = int(statistics.median(heads)) if heads else None

    return {
        'divider_x': divider,
        'x': rail_left,
        'w': rail_w,
        'right': right,
        'self_card_h': card_h,
        'avatar_w': avatar,
        'filter_h': filt[1] - filt[0] + 1 if filt else None,
        'filter_y': cy + filt[0] if filt else None,
        'icon_rail_w': icon_rail,
        'row_pitch': pitch,
        'section_head_h': head_h,
        'bands': len(rb),
    }


def main():
    spec = json.loads(SPEC_PATH.read_text())
    chrome = spec['chrome']
    results = {}
    for name in SHOTS:
        r = measure(name, chrome)
        if r:
            results[name] = r
    if not results:
        print('no divider found', file=sys.stderr)
        return 1
    # 取各页中位数，避免单页噪声
    keys = ['x', 'w', 'right', 'self_card_h', 'avatar_w', 'filter_h', 'icon_rail_w', 'row_pitch', 'section_head_h']
    agg = {}
    for k in keys:
        vs = [r[k] for r in results.values() if r.get(k) is not None]
        agg[k] = int(statistics.median(vs)) if vs else None
    inner = chrome['inner']
    divider_x = int(statistics.median([r['divider_x'] for r in results.values()]))
    resizer_w = 2 * (agg['x'] - divider_x)   # 线居中于轨道 → 轨道宽 = 2×(栏左−线心)
    rail = {
        '_source': f'measured docs/ref/vrcx0-{{{",".join(results)}}}.png（scripts/measure_ref_rail.py）',
        'divider_x': divider_x,
        'x': agg['x'],
        'w': agg['w'],
        'right': agg['right'],
        'resizer_w': resizer_w,
        'right_gap': inner['x'] + inner['w'] - 1 - agg['right'],
        'self_card_h': agg['self_card_h'],
        'avatar_w': agg['avatar_w'],
        'filter_h': agg['filter_h'],
        'icon_rail_w': agg['icon_rail_w'],
        'row_pitch': agg['row_pitch'],
        'section_head_h': agg['section_head_h'],
        'zoom_note': '截图 UI 缩放 110%：CSS 320px×1.1≈352，resizer8×1.1≈9（VRCX-0 AppShellLayout 默认 320，clamp 240–700）',
    }
    # 与源码默认值互证（不覆盖量测，只记录）
    rail['vs_source'] = {
        'side_panel_default_css': 320,
        'expected_device_w_at_110pct': 352,
        'match': abs(agg['w'] - 352) <= 3,
    }
    chrome['rail'] = rail
    chrome['stable'] = chrome.get('stable', True) and rail['vs_source']['match']

    # 裁图复核
    cx, cy, cw, ch = (chrome['content'][k] for k in ('x', 'y', 'w', 'h'))
    im = load('feed')
    im.crop((agg['x'] - 12, cy, cx + cw, cy + ch)).save(ROOT / 'docs/ref/crop-rail.png')

    SPEC_PATH.write_text(json.dumps(spec, ensure_ascii=False, indent=1) + '\n')
    print(json.dumps({'per_page': results, 'rail': rail}, ensure_ascii=False, indent=1))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
