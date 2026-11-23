#!/usr/bin/env python3
"""量 VRCX-0 真机截图侧栏导航的行距（对应 src/ui/shadcn/sidebar.tsx 的 h-8 / h-7 两档）。

    python3 scripts/measure_ref_nav.py            # 读 docs/ref/vrcx0-overview.png
    -> docs/ref/nav-measure.json

口径：侧栏文字带（x 10..275）逐行统计暗像素，连续行 = 一条导航文字；相邻文字带起点差 = 行距。
截图 UI 缩放 110%，所以 32px(h-8)×1.1 + 4px(gap-1)×1.1 ≈ 40，28px(h-7)×1.1 + 4.4 ≈ 35。
"""
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOT = os.path.join(ROOT, "docs/ref/vrcx0-overview.png")
OUT = os.path.join(ROOT, "docs/ref/nav-measure.json")

im = Image.open(SHOT).convert("RGB")
a = np.asarray(im)
# 侧栏在 inner 左上：x6..x283，顶栏 39 之后
sub = a[45:1000, 10:275]
dark = (sub.mean(axis=2) < 150).sum(axis=1)

runs = []
start = None
for i, v in enumerate(dark):
    if v > 3 and start is None:
        start = i
    elif v <= 3 and start is not None:
        runs.append([start + 45, i + 45])
        start = None
# 1px 的碎带是分割线/下划线，不算文字行
runs = [r for r in runs if r[1] - r[0] >= 6]
starts = [r[0] for r in runs]
pitches = [starts[i] - starts[i - 1] for i in range(1, len(starts))]

# 每行的左端 x：顶层图标 ~25，二级子项 ~52（SidebarMenuSub 的 mx-3.5 + px-2.5 + SubButton px-2）
x_starts = []
for y0, y1 in runs:
    cols = (sub[:, :, :].mean(axis=2)[y0 - 45:y1 - 45] < 150).sum(axis=0)
    xs = [j + 10 for j, v in enumerate(cols) if v >= 2]
    x_starts.append(xs[0] if xs else None)
top_x = [x for x in x_starts if x is not None and x < 40]
subp_x = [x for x in x_starts if x is not None and x >= 40]

# 顶层项 h-8×1.1 + gap 4.4 ≈ 40；子项 h-7×1.1 + 4.4 ≈ 35（首行上面还有 header，单列不计）
top = [p for p in pitches if 37 <= p <= 43]
sub = [p for p in pitches if 32 <= p <= 36]


def med(xs):
    return round(float(np.median(xs)), 1) if xs else None


top_icon_x = med(top_x)
sub_icon_x = med(subp_x)
indent = round(sub_icon_x - top_icon_x, 1) if top_icon_x is not None and sub_icon_x is not None else None

report = {
    "_note": "measure_ref_nav.py：侧栏文字带起点差 = 行距；左端 x 差 = 二级缩进；截图 110% 缩放",
    "image": os.path.relpath(SHOT, ROOT),
    "text_bands_y": [r[0] for r in runs],
    "text_bands_x": x_starts,
    "pitches": pitches,
    "top_pitch": med(top),
    "sub_pitch": med(sub),
    "top_icon_x": top_icon_x,
    "sub_icon_x": sub_icon_x,
    "sub_indent": indent,
    "source": "VRCX-0 src/ui/shadcn/sidebar.tsx h-8(top)/h-7(sub) + SidebarMenu gap-1 + SidebarMenuSub mx-3.5 border-l px-2.5",
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=1)
print(json.dumps({k: report[k] for k in ("top_pitch", "sub_pitch", "pitches")}, ensure_ascii=False))
