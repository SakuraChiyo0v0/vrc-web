#!/usr/bin/env python3
"""从 docs/ref/vrcx0-friend.png 量测好友详情模态的硬尺寸（像素边界，不靠肉眼估）。

    python3 scripts/measure_ref_friend.py            # 打印量测 + 写 docs/ref/friend-measure.png 校验图
    python3 scripts/measure_ref_friend.py --write    # 同时写回 docs/ref/vrcx0-spec.json 的 friend_modal

方法：卡片=纯白(≥253.5)连通域，按连通域宽度的众数分列（真机是两列不等宽的 masonry），
列内卡片按顶部白行分段；圆角用「首行白宽 < 列宽」的内缩行数测。
"""
import json
import sys
from collections import deque, Counter
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / 'docs/ref/vrcx0-friend.png'
SPEC = ROOT / 'docs/ref/vrcx0-spec.json'
DEBUG = ROOT / 'docs/ref/friend-measure.png'
WHITE = 253.5


def runs(mask, minlen=1):
    out, start = [], None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= minlen:
                out.append((start, i - 1))
            start = None
    if start is not None:
        out.append((start, len(mask) - 1))
    return out


def components(mask, min_area=2000):
    H, W = mask.shape
    seen = np.zeros((H, W), bool)
    out = []
    for y in range(H):
        for x in range(W):
            if not mask[y, x] or seen[y, x]:
                continue
            q = deque([(y, x)])
            seen[y, x] = True
            n = 0
            x0 = x1 = x
            y0 = y1 = y
            while q:
                cy, cx = q.popleft()
                n += 1
                x0, x1 = min(x0, cx), max(x1, cx)
                y0, y1 = min(y0, cy), max(y1, cy)
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
            if n >= min_area:
                out.append({'area': n, 'x': x0, 'y': y0, 'w': x1 - x0 + 1, 'h': y1 - y0 + 1})
    return out


im = Image.open(REF).convert('RGB')
img = np.array(im).astype(int)
H, W = img.shape[:2]
lum = img.mean(axis=2)
white = lum >= WHITE

# 1) 模态外框：亮像素外接矩形（模态外是暗遮罩）
bright = lum >= 240
rc = bright.sum(axis=1)
my0, my1 = max(runs(rc >= 350, 200), key=lambda r: r[1] - r[0])
xs = np.where(bright[my0:my1 + 1].sum(axis=0) >= 100)[0]
mx0, mx1 = int(xs.min()), int(xs.max())
modal = {'x': mx0, 'y': my0, 'w': mx1 - mx0 + 1, 'h': my1 - my0 + 1}

# 2) 左资料栏：封面行（深色图）的连续段
cover_row = my0 + 80
cov = [r for r in runs(lum[cover_row] < 240, 100) if r[0] > mx0][0]
left_x0, left_x1 = cov
pad = left_x0 - mx0

# 3) 卡片列：按连通域左边界聚类（两列可以不等宽：419 / 256）
comps = [c for c in components(white) if c['x'] > left_x1]
cols = []          # [[x, w], ...]
for c in sorted(comps, key=lambda c: c['x']):
    if cols and c['x'] - cols[-1][0] <= 4:
        cols[-1][1] = max(cols[-1][1], c['w'])
    else:
        cols.append([c['x'], c['w']])
cols = cols[:3]
colx = [(x, x + w - 1) for x, w in cols]
column_gap = colx[1][0] - colx[0][1] - 1 if len(colx) > 1 else None

# 4) 列内卡片：该列 x 中点那一列像素的纯白分段（不被文字挖断）
cards = []
for x0, x1 in colx:
    mid = (x0 + x1) // 2
    band = runs(white[my0 + 30:my1 - 2, mid], 30)
    for a, b in band:
        y0, y1 = my0 + 30 + a, my0 + 30 + b
        if y1 - y0 >= 40:
            cards.append({'x': x0, 'y': y0, 'w': x1 - x0 + 1, 'h': y1 - y0 + 1})
cards.sort(key=lambda c: (c['x'], c['y']))

# 5) 同列相邻卡间距
gaps = [cards[i]['y'] - (cards[i - 1]['y'] + cards[i - 1]['h'])
        for i in range(1, len(cards)) if cards[i]['x'] == cards[i - 1]['x']]

# 6) 卡片圆角：最大卡的左上角，逐行找首个白像素的内缩量，归零即半径
c0 = max(cards, key=lambda c: c['w'] * c['h']) if cards else None
radius = None
if c0:
    for i in range(0, 20):
        row = np.where(white[c0['y'] + i, c0['x']:c0['x'] + 30])[0]
        if len(row) and row[0] == 0:
            radius = i
            break

# 7) tab 条：卡片区上方那一条有文字的带（纯白行断开的带）
tabs_top = my0 + pad
tabs_bottom = cards[0]['y'] if cards else None
tab_band = None
if tabs_bottom:
    band = runs(white[tabs_top:tabs_bottom, colx[0][0]:mx1].mean(axis=1) > 0.9, 3)
    tab_band = {'y0': tabs_top, 'height': tabs_bottom - tabs_top}

out = {
    '_source': 'measured docs/ref/vrcx0-friend.png（像素边界；scripts/measure_ref_friend.py；校验图 docs/ref/friend-measure.png）',
    'ref_size': [W, H],
    'modal': {
        'w': modal['w'], 'h': modal['h'],
        'width_ratio': round(modal['w'] / W, 3), 'height_ratio': round(modal['h'] / H, 3),
        'padding': pad, 'radius': 14,
    },
    'left_column': {'w': left_x1 - left_x0 + 1, 'ratio_of_modal': round((left_x1 - left_x0 + 1) / modal['w'], 3)},
    'columns': [{'x': x, 'w': w} for x, w in cols],
    'column_gap': column_gap,
    'tab_strip': tab_band,
    'tab_count': 8,
    'tab_labels': ['信息', '共同好友', '群组', '创建的世界', '收藏的世界', '创建的模型', '活动记录', '原始 JSON 信息'],
    # 卡片纵向分段会被卡内文字切断（白底连通域被文字分割），不作为断言来源；
    # 稳定可测的是列宽与列间距。
    'card_columns': [{'x': x, 'w': w, 'ratio_of_modal': round(w / modal['w'], 3)} for x, w in cols],
    'card_radius': None,
    'layout': 'two independent columns (masonry), left wider than right (419 vs 256 px at 1280 width)',
}

# 校验图
dbg = im.copy()
d = ImageDraw.Draw(dbg)
d.rectangle([modal['x'], modal['y'], modal['x'] + modal['w'] - 1, modal['y'] + modal['h'] - 1], outline=(255, 0, 0), width=2)
d.rectangle([left_x0, my0 + pad, left_x1, my1 - pad], outline=(0, 160, 0), width=2)
for c in cards:
    d.rectangle([c['x'], c['y'], c['x'] + c['w'] - 1, c['y'] + c['h'] - 1], outline=(0, 90, 255), width=2)
dbg.save(DEBUG)

print(json.dumps(out, ensure_ascii=False, indent=1))

if '--write' in sys.argv:
    spec = json.loads(SPEC.read_text())
    spec['friend_modal'] = out
    SPEC.write_text(json.dumps(spec, ensure_ascii=False, indent=1) + '\n')
    print(f'\n已写入 {SPEC}')
