#!/usr/bin/env python3
"""量 VRCX-0 真机截图里侧栏底部（SidebarFooter）与窗口底部状态栏的结构。

    python3 scripts/measure_ref_footer.py        # 读 docs/ref/vrcx0-overview.png
    -> docs/ref/footer-measure.json

口径（和 measure_ref_nav.py 一致：截图 UI 缩放 110%，数值按截图像素记，chrome_parity 直接当 CSS px 比）：
  - 侧栏 x6..x283（右边框 x288，#e3e3e3），底色 #f5f5f5。
  - 文字带 = 该行暗像素连续段；侧栏 y>900 的两条 = 设置 / 收起导航栏。
  - 状态栏 = 底部 #f5f5f5 区块（上方 y996 分隔线），里面按颜色找圆点、按暗像素找文字。
"""
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOT = os.path.join(ROOT, "docs/ref/vrcx0-overview.png")
OUT = os.path.join(ROOT, "docs/ref/footer-measure.json")

im = Image.open(SHOT).convert("RGB")
a = np.asarray(im).astype(int)
H, W = a.shape[:2]

# ---- 侧栏底部：文字带 ----
xs0, xs1 = 10, 275
strip = a[:, xs0:xs1]
dark = (strip.mean(axis=2) < 150).sum(axis=1)
bands = []
start = None
for y, v in enumerate(dark):
    if v > 3 and start is None:
        start = y
    elif v <= 3 and start is not None:
        if y - start >= 6:
            bands.append([start, y])
        start = None
tail = [b for b in bands if b[0] > 900]


# ---- 侧栏底线/右边框 ----
col_bg = a[:, 200].tolist()
sidebar_border_x = None
for x in range(270, 300):
    if abs(int(a[700, x].mean()) - 227) <= 4:
        sidebar_border_x = x
        break

# ---- 状态栏：从底部往上找 #f5f5f5 区块 ----
def is_bar(y):
    row = a[y, 600:1200]
    return abs(row.mean() - 245) < 3


y_bottom = next(y for y in range(H - 1, H - 60, -1) if is_bar(y))
y_top = y_bottom
while y_top > 0 and is_bar(y_top - 1):
    y_top -= 1
bar_top_border = y_top - 1  # 分隔线那一行

# 侧栏底部只到底部状态栏上边界为止（状态栏那行文字属于通栏，不算侧栏 footer）
tail = [b for b in tail if b[1] < y_top]


# 状态点：绿/灰圆点（绿 #68d043，灰 #b5b5b5）。取状态栏里圆点最多的那一行
def dot_count(y):
    r = a[y, :600]
    g = (np.abs(r[:, 0] - 104) < 50) & (np.abs(r[:, 1] - 208) < 50) & (np.abs(r[:, 2] - 67) < 60)
    gy = np.abs(r.mean(axis=1) - 181) < 14
    return int((g | gy).sum())


mid = max(range(y_top, y_bottom + 1), key=dot_count)
row = a[mid, :600]
dots = []
x = 0
while x < 600:
    px = row[x]
    green = abs(px[0] - 104) < 50 and abs(px[1] - 208) < 50 and abs(px[2] - 67) < 60
    gray = abs(px.mean() - 181) < 14
    if green or gray:
        s = x
        while x < 600:
            p = row[x]
            g2 = abs(p[0] - 104) < 50 and abs(p[1] - 208) < 50 and abs(p[2] - 67) < 60
            g3 = abs(p.mean() - 181) < 14
            if not (g2 or g3):
                break
            x += 1
        # 圆点 ≥6px 宽；文字笔画多是 1–3px 竖条
        if x - s >= 6:
            # 圆点在竖直方向 6px 内都该是同色：拿整块判绿/灰，避免取到抗锯齿边缘
            blk = a[mid - 3:mid + 4, s:x]
            g = (np.abs(blk[:, :, 0] - 104) < 50) & (np.abs(blk[:, :, 1] - 208) < 50) & (np.abs(blk[:, :, 2] - 67) < 60)
            dots.append({"x": s, "w": x - s, "color": "green" if g.mean() > 0.3 else "gray", "y": mid})
    else:
        x += 1

# 文字：状态栏内的暗像素列段
tb = a[y_top:y_bottom + 1, :600].mean(axis=2)
# 灰字（#a0 左右）在 <170 下会被漏掉，用 <220
cols = (tb < 220).sum(axis=0)
runs = []
start = None
for x, v in enumerate(cols):
    if v > 0 and start is None:
        start = x
    elif v == 0 and start is not None:
        # 中文字距会把字拆开：段间 <=4px 的合并成一条
        if runs and start - runs[-1][1] <= 4:
            runs[-1][1] = x
        else:
            runs.append([start, x])
        start = None
if start is not None:
    runs.append([start, len(cols)])

# 每个圆点后面的第一段文字 = 该项标签
items = []
for i, d in enumerate(dots):
    lab = next((r for r in runs if r[0] > d["x"] + d["w"] and (i + 1 == len(dots) or r[0] < dots[i + 1]["x"])), None)
    items.append({**d, "label_x0": lab[0] if lab else None, "label_x1": lab[1] if lab else None})

# 项间距 = 下一圆点 x - 上一项文字右端
gaps = [
    round(items[i + 1]["x"] - (items[i]["label_x1"] or items[i]["x"]), 1)
    for i in range(len(items) - 1)
]

report = {
    "_note": "measure_ref_footer.py：侧栏底部剩两条文字带（设置/收起导航栏，中间无分隔线）；底部状态栏 4 个状态点，左对齐。数值为截图像素（= chrome_parity 的 CSS px 口径）",
    "image": os.path.relpath(SHOT, ROOT),
    "sidebar": {
        "x": 6,
        "w": 277,
        "border_x": sidebar_border_x,
        "border_color": "#e3e3e3",
        "bg": "#f5f5f5",
        "footer_bands": tail,
        "footer_pitch": round(tail[-1][0] - tail[-2][0], 1) if len(tail) >= 2 else None,
        "divider_above_footer": False,
        "footer_items": len(tail),
    },
    "statusbar": {
        "y_top": bar_top_border,
        "y_bottom": y_bottom,
        "h": y_bottom - bar_top_border,
        "bg": "#f5f5f5",
        "items": items,
        "count": len(items),
        "item_gaps": gaps,
        "dot_w": round(float(np.median([d["w"] for d in dots])), 1) if dots else None,
        "first_dot_x": dots[0]["x"] if dots else None,
        "right_aligned": False,
    },
    "source": "VRCX-0 src/ui/shadcn/sidebar.tsx SidebarFooter（设置 + 收起导航栏）；底部状态栏 = 服务器状态 / 实时连接 / VRChat / SteamVR",
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=1)
print(json.dumps({k: report[k] for k in ("sidebar", "statusbar")}, ensure_ascii=False))
