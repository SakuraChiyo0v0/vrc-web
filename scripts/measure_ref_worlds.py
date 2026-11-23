#!/usr/bin/env python3
"""量 VRCX-0 真机截图里的世界卡片（探索→热门页的主网格）。

    python3 scripts/measure_ref_worlds.py           # 读 docs/ref/vrcx0-search.png
    -> docs/ref/worlds-measure.json 并把结果并入 docs/ref/vrcx0-spec.json 的 worlds

口径同 measure_ref_footer.py：截图 UI 缩放 110%，数值按截图像素记
（spec 里的数字就是 CSS px，chrome/结构断言直接比）。

为什么用 search 的截图：docs/ref/vrcx0-worlds.png（#/favorites/worlds）当时选中的
是空的本地收藏夹，中栏只有空态，没有卡片可量；#/explore 的热门网格用的是同一套
世界卡片组件，网格 3 列，可直接量。

量测区间：内容面板 x283..1349（右缘被好友栏 1349 切掉），网格第一行 y540 起。
卡片是无边框的「缩略图 + 标题 + 副信息」块：缩略图 4:3 圆角、文字左缩进 14、
两行文字（标题 / 作者·访问），下缘留白到下一行。

注意：截图里缩略图是 #EEEEEE 占位（封面未加载），所以这一轮量的是**盒模型**
（位置/尺寸/比例/圆角/间距），量不到封面图本身。
"""
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOT = os.path.join(ROOT, "docs/ref/vrcx0-search.png")
OUT = os.path.join(ROOT, "docs/ref/worlds-measure.json")
SPEC = os.path.join(ROOT, "docs/ref/vrcx0-spec.json")

a = np.asarray(Image.open(SHOT).convert("RGB")).astype(int)
g = a.mean(axis=2)
H, W = g.shape

X0, X1 = 283, 1349  # 内容面板，切掉右侧好友栏
Y0, Y1 = 500, 990   # 网格区


def segments(y, thr=252, minlen=4):
    """一行里连续非白段（卡片缩略图/文字块）"""
    m = g[y, X0:X1] < thr
    out, s = [], None
    for i, v in enumerate(m):
        if v and s is None:
            s = i
        elif (not v) and s is not None:
            if i - s >= minlen:
                out.append([X0 + s, X0 + i - 1])
            s = None
    if s is not None:
        out.append([X0 + s, X1 - 1])
    return out


def bbox(x0, x1, y0, y1, thr=200):
    m = g[y0:y1, x0:x1] < thr
    ys, xs = np.where(m)
    if not len(ys):
        return None
    return {
        "x": int(x0 + xs.min()), "y": int(y0 + ys.min()),
        "w": int(xs.max() - xs.min() + 1), "h": int(ys.max() - ys.min() + 1),
    }


# ---- 网格列：一行穿过三张卡的缩略图 ---- #
cols = segments(600)
if len(cols) != 3:
    raise SystemExit(f"网格列数 {len(cols)} != 3：{cols}")
card_w = [c[1] - c[0] + 1 for c in cols]
col_gap = [cols[i + 1][0] - cols[i][1] - 1 for i in range(len(cols) - 1)]
card_x0 = cols[0][0]
grid_w = cols[-1][1] - cols[0][0] + 1

# ---- 缩略图带：整行非白像素几乎铺满（三张缩略图都是占位灰） ---- #
rowfill = np.array([(g[y, card_x0:cols[-1][1] + 1] < 250).sum() for y in range(Y0, Y1)])
solid = rowfill > grid_w * 0.7
bands, s = [], None
for i, v in enumerate(solid):
    if v and s is None:
        s = i
    elif (not v) and s is not None:
        if i - s >= 20:
            bands.append([Y0 + s, Y0 + i - 1])
        s = None
if s is not None:
    bands.append([Y0 + s, Y1 - 1])
if len(bands) < 2:
    raise SystemExit(f"可见缩略图带不足两行：{bands}")

img_top, img_bottom = bands[0]
thumb_h = img_bottom - img_top + 1
next_top = bands[1][0]
row_pitch = next_top - img_top

# ---- 圆角：缩略图左上角逐行首个非白像素的横向内缩 ---- #
# 只在卡片左侧 40px 内找（否则会撞到内容面板的左边线，量出负数）
insets = []
for y in range(img_top, min(img_top + 24, img_bottom)):
    xs = np.where(g[y, card_x0 - 1:card_x0 + 40] < 252)[0]
    if len(xs):
        insets.append(int(xs[0]) - 1)
radius = max(insets) if insets else 0

# ---- 文字带：缩略图下缘到下一行缩略图之间 ---- #
dark = (g[img_bottom + 1:next_top, card_x0:card_x0 + card_w[0]] < 200).sum(axis=1)
tbands, s = [], None
for i, v in enumerate(dark):
    if v > 2 and s is None:
        s = i
    elif v <= 2 and s is not None:
        tbands.append([img_bottom + 1 + s, img_bottom + i])
        s = None
if s is not None:
    tbands.append([img_bottom + 1 + s, next_top - 1])
if len(tbands) < 2:
    raise SystemExit(f"卡片文字带不足两条：{tbands}")
title_band, meta_band = tbands[0], tbands[1]
title_box = bbox(card_x0, card_x0 + card_w[0], title_band[0], title_band[1] + 1)
meta_box = bbox(card_x0, card_x0 + card_w[0], meta_band[0], meta_band[1] + 1)
if not title_box or not meta_box:
    raise SystemExit("标题/副信息量不到")

measure = {
    "_source": "measured docs/ref/vrcx0-search.png（scripts/measure_ref_worlds.py）：探索→热门的世界卡片网格",
    "_note": "缩略图在截图里是 #EEEEEE 占位（封面未加载），量的是盒模型不是封面图",
    "ref_size": [int(W), int(H)],
    "grid": {
        "x": int(card_x0),
        "w": int(grid_w),
        "columns": len(cols),
        "col_gap": int(round(float(np.median(col_gap)))),
        "row_pitch": int(row_pitch),
    },
    "card": {
        "w": int(round(float(np.median(card_w)))),
        "thumb_h": int(thumb_h),
        "thumb_aspect": round(float(np.median(card_w)) / thumb_h, 3),
        "thumb_radius": int(radius),
        "pad_x": int(title_box["x"] - card_x0),
        "title_from_thumb": int(title_box["y"] - img_bottom - 1),
        "title_h": int(title_box["h"]),
        "title_color": [int(v) for v in a[title_band[0] + 1, title_box["x"] + 1]],
        "meta_from_title": int(meta_box["y"] - title_band[1] - 1),
        "meta_h": int(meta_box["h"]),
        "text_bottom_gap": int(next_top - meta_band[1] - 1),
    },
}

with open(OUT, "w") as f:
    json.dump(measure, f, ensure_ascii=False, indent=1)
    f.write("\n")

spec = json.load(open(SPEC))
spec["worlds"] = {
    "_source": measure["_source"],
    "grid_columns": measure["grid"]["columns"],
    "grid_columns_md": 2,
    "col_gap": measure["grid"]["col_gap"],
    "row_pitch": measure["grid"]["row_pitch"],
    "card_w": measure["card"]["w"],
    "thumb_aspect": measure["card"]["thumb_aspect"],
    "thumb_radius": measure["card"]["thumb_radius"],
    "pad_x": measure["card"]["pad_x"],
    "title_from_thumb": measure["card"]["title_from_thumb"],
    "title_h": measure["card"]["title_h"],
    "meta_from_title": measure["card"]["meta_from_title"],
    "meta_h": measure["card"]["meta_h"],
    "text_bottom_gap": measure["card"]["text_bottom_gap"],
    "head_columns": 4,
    "min_cards": 3,
    "decor_px_range": [16, 20],
}
with open(SPEC, "w") as f:
    json.dump(spec, f, ensure_ascii=False, indent=1)
    f.write("\n")

print(json.dumps(measure, ensure_ascii=False, indent=1))
print(f"\n-> {os.path.relpath(OUT, ROOT)} + spec.worlds")
