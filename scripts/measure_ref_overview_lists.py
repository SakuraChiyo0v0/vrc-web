#!/usr/bin/env python3
"""量 VRCX-0 真机截图右栏三个榜单（相处最久 / 相处变少 / 常遇见的路人）。

    python3 scripts/measure_ref_overview_lists.py     # 读 docs/ref/legacy/vrcx0-overview.png
    -> docs/ref/overview-lists-measure.json 并把结果并入 docs/ref/vrcx0-spec.json 的 overview.lists

口径同 measure_ref_footer.py：截图 UI 缩放 110%，数值按截图像素记（chrome_parity/断言直接当 CSS px 比）。
右栏在 x1272..1560（标题左缘 1272，数值/长条右缘 ~1530），宽 300 不含卡片边框 —— 页面上三块面板没有卡片边框。
"""
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOT = os.path.join(ROOT, "docs/ref/legacy/vrcx0-overview.png")
OUT = os.path.join(ROOT, "docs/ref/overview-lists-measure.json")
SPEC = os.path.join(ROOT, "docs/ref/vrcx0-spec.json")

a = np.asarray(Image.open(SHOT).convert("RGB")).astype(int)
g = a.mean(axis=2)
H, W = g.shape

X0, X1 = 1240, 1660  # 右栏搜索窗（切掉 1681 的右边框）


def bbox(x0, x1, y0, y1, thr=250):
    m = g[y0:y1, x0:x1] < thr
    ys, xs = np.where(m)
    if not len(ys):
        return None
    return {
        "x": int(x0 + xs.min()), "y": int(y0 + ys.min()),
        "w": int(xs.max() - xs.min() + 1), "h": int(ys.max() - ys.min() + 1),
    }


def bands(y0, y1, x0=X0, x1=X1, thr=150, minpx=3, minh=4):
    """行内暗像素连续段 = 一行文字/头像带"""
    dark = (g[y0:y1, x0:x1] < thr).sum(axis=1)
    out, s = [], None
    for i, v in enumerate(dark):
        if v > minpx and s is None:
            s = i
        elif v <= minpx and s is not None:
            if i - s >= minh:
                out.append([y0 + s, y0 + i])
            s = None
    return out


# ---- 面板标题：真机截图里三块面板只有第一块展开，后两块只露标题 ----
def wide_bands(y0, y1, minw=90, hmin=14, hmax=30):
    """整行暗像素带 + 横向跨度≥minw 的才算标题/副标题（排除头像/名字碎片）"""
    out = []
    for (b0, b1) in bands(y0, y1, thr=200):
        if not (hmin <= b1 - b0 <= hmax):
            continue
        m = g[b0:b1, X0:X1] < 200
        xs = np.where(m.any(axis=0))[0]
        if len(xs) and xs.max() - xs.min() >= minw:
            out.append({"y0": b0, "y1": b1, "x": X0 + int(xs.min()), "x1": X0 + int(xs.max()),
                        "text_h": b1 - b0})
    return out

# 标题一在副标题上方；先取 y200..340 的第一条宽带
t1 = wide_bands(200, 345)[0]
sub_bands = wide_bands(t1["y1"] + 6, t1["y1"] + 60, minw=60, hmin=14, hmax=26)
sub = sub_bands[0]

# ---- 首名头像（圆形大图）：副标题下方最大块 ----
hero_av = bbox(X0, 1408, sub["y1"] + 10, 520, 250)
hero_name = bbox(1420, 1660, hero_av["y"], hero_av["y"] + 60, 160)
hero_val = bbox(1420, 1660, hero_av["y"] + 60, hero_av["y"] + 130, 235)

# ---- 紧凑行：左缘 60px 竖条里只有头像（名字从 x1345 起），按竖条连续块找每行头像 ----
mask = g[:, 1272:1332] < 252
runs, st = [], None
for y in range(hero_av["y"] + hero_av["h"], H - 5):
    v = mask[y].sum()
    if v > 0 and st is None:
        st = y
    elif v == 0 and st is not None:
        if y - st > 2:
            runs.append([st, y])
        st = None
merged = []
for rr in runs:
    if merged and rr[0] - merged[-1][1] <= 14:
        merged[-1][1] = rr[1]
    else:
        merged.append(rr)
rows = []
for (y0, y1) in merged:
    if y1 - y0 < 40:
        continue  # 文字/反锯齿碎块
    av = bbox(X0, 1330, y0, y1, 252)
    name = bbox(1330, 1470, av["y"], av["y"] + av["h"], 180)
    bar = bbox(1470, 1620, av["y"], av["y"] + av["h"], 252)
    rows.append({"avatar": av, "name": name, "bar": bar})

# 末行可能被面板下边界切掉（头像不足 50 高）：只拿完整行算行距/字号
full = [r for r in rows if r["avatar"]["h"] >= 46]
row_pitch = [round(full[i + 1]["avatar"]["y"] - full[i]["avatar"]["y"], 1) for i in range(len(full) - 1)]
avatar_d = round(float(np.median([r["avatar"]["w"] for r in full])), 1)
name_h = round(float(np.median([r["name"]["h"] for r in full])), 1)
bar_h = round(float(np.median([r["bar"]["h"] for r in full])), 1)
bar_x = int(np.median([r["bar"]["x"] for r in full]))
bar_w = [r["bar"]["w"] for r in full]
bar_rgb = a[full[0]["bar"]["y"] + 2, full[0]["bar"]["x"] + 2].tolist()

# ---- 后两块面板标题：末行之下、横向跨度≥90 的带（真机里是「相处变少的人」「常遇见的路人」） ----
below = wide_bands(max(r["avatar"]["y"] + r["avatar"]["h"] for r in rows) + 7, H - 5, minw=90, hmin=14, hmax=30)
t2, t3 = below[0], below[1]

panel_gap = round(t2["y0"] - (full[-1]["avatar"]["y"] + full[-1]["avatar"]["h"]), 1)
bar_right_inset = int(t1["x"] + 300 - (bar_x + 67))

report = {
    "_note": "measure_ref_overview_lists.py：右栏三榜单（相处最久的人/相处变少的人/常遇见的路人）。"
             "首名 hero 行 = 116 圆头像 + 32px 名字 + 名字下方 20px 时长；紧凑行 = 50 圆头像 + 22px 名字 + 右侧灰色相对条"
             "（左端固定 x1481、槽宽 67、栏右内缩 24）。截图只有第一块展开，后两块只露标题。数值=截图像素=CSS px 口径",
    "image": os.path.relpath(SHOT, ROOT),
    "column": {"x": t1["x"], "w": 300, "bg": "#ffffff", "border": None},
    "panels": [
        {"title": "相处最久的人", "title_y": [t1["y0"], t1["y1"]], "text_h": t1["text_h"], "has_rows": True},
        {"title": "相处变少的人", "title_y": [t2["y0"], t2["y1"]], "text_h": t2["text_h"], "has_rows": False},
        {"title": "常遇见的路人", "title_y": [t3["y0"], t3["y1"]], "text_h": t3["text_h"], "has_rows": False},
    ],
    "title": {"x": t1["x"], "y": [t1["y0"], t1["y1"]], "text_h": t1["text_h"], "font_px": 24, "weight": 600},
    "subtitle": {"x": sub["x"], "y": [sub["y0"], sub["y1"]], "text_h": sub["text_h"], "font_px": 18,
                 "gap_below_title": sub["y0"] - t1["y1"]},
    "hero": {
        "avatar": {"d": hero_av["h"], "x": hero_av["x"], "y": hero_av["y"], "radius": "50%"},
        "name": {"x": hero_name["x"], "y": hero_name["y"], "text_h": hero_name["h"], "font_px": 32,
                 "gap_from_avatar": hero_name["x"] - (hero_av["x"] + hero_av["w"])},
        "duration": {"x": hero_val["x"], "y": hero_val["y"], "text_h": hero_val["h"], "font_px": 20,
                     "below_name": hero_val["y"] - (hero_name["y"] + hero_name["h"])},
        "gap_above": hero_av["y"] - sub["y1"],
        "gap_below": full[0]["avatar"]["y"] - (hero_av["y"] + hero_av["h"]),
    },
    "row": {
        "avatar_d": avatar_d, "pitch": round(float(np.median(row_pitch)), 1),
        "name_text_h": name_h, "name_font_px": 22,
        "name_gap_from_avatar": round(float(np.median([r["name"]["x"] - (r["avatar"]["x"] + r["avatar"]["w"]) for r in full])), 1),
        "bar": {"x": bar_x, "h": bar_h, "color": "#%02x%02x%02x" % tuple(bar_rgb), "widths": bar_w,
                "left_fixed": True, "zone_w": 67},
    },
    "section": {"bar_right_inset": bar_right_inset, "panel_gap": panel_gap},
    "source": "VRCX-0 overview 右栏（截图 docs/ref/legacy/vrcx0-overview.png）",
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=1)

# 并入 spec.overview.lists（其余 overview 键保持不变）
with open(SPEC, encoding="utf-8") as f:
    spec = json.load(f)
spec.setdefault("overview", {})["lists"] = report
with open(SPEC, "w", encoding="utf-8") as f:
    json.dump(spec, f, ensure_ascii=False, indent=1)

print(json.dumps({k: report[k] for k in ("column", "title", "subtitle", "hero", "row", "section")},
                 ensure_ascii=False))
