#!/usr/bin/env python3
"""量 VRCX-0 真机截图顶栏（自定义标题栏）的组成与位置。

    python3 scripts/measure_ref_topbar.py                 # 读 docs/ref/vrcx0-*.png
    python3 scripts/measure_ref_topbar.py --write         # 顺带写入 docs/ref/vrcx0-spec.json → chrome.topbar
    -> docs/ref/topbar-measure.json

口径（截图 UI 缩放 110%，数值按截图像素记，chrome_parity 直接当 CSS px 比）：
  - 顶栏 = y8..y46（h39，底色 #f5f5f5），下边 1px #e9e9e9 只铺在内容区上方。
  - 暗像素列段（阈值 <200）按 ≤8px 间隔并成一个「项」，项内 ≤2px 的段是同一文字的字/笔画。
  - 顺序固定：品牌文字 / 帮助菜单 / 搜索（放大镜+占位+Ctrl K）/ 6 个图标按钮 / 3 个窗口控制。
  - 16 张非模态截图顶栏完全一致（唯一例外 vrcx0-friend.png 是带遮罩的模态图，不参与统计）。
"""
import glob
import json
import os
import statistics

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs/ref/topbar-measure.json")
SPEC_PATH = os.path.join(ROOT, "docs/ref/vrcx0-spec.json")
Y0, Y1 = 8, 46          # 顶栏纵向带（chrome.topbar: y8 h39）
X_MIN = 10              # 左边框在黑边 x0..6，跳过
DARK = 200              # 文字/图标灰度阈值（底色 245）

BRAND = "VRCX-0"
LABELS = {
    "brand": BRAND,
    "help": "帮助",
    "search_placeholder": "快速搜索",
    "search_shortcut": "Ctrl K",
    "actions": ["通知", "发现", "主题", "固定", "好友栏", "收起导航栏"],
    "window_controls": ["最小化", "最大化", "关闭"],
}


def segments(a):
    """顶栏内的暗像素列段 → [(x0, x1, y0, y1)]，最后按 ≤8px 间隔并成项。"""
    band = a[Y0:Y1]
    g = band.mean(axis=2)
    cols = (g < DARK).sum(axis=0)
    runs, start = [], None
    for x, v in enumerate(cols):
        if v > 0 and start is None:
            start = x
        elif v == 0 and start is not None:
            runs.append([start, x])
            start = None
    if start is not None:
        runs.append([start, len(cols)])
    glyphs = []
    for s, e in runs:
        if s < X_MIN:
            continue
        seg = g[:, s:e]
        ys = np.where((seg < DARK).any(axis=1))[0]
        glyphs.append((s, e, int(ys.min()) + Y0, int(ys.max()) + Y0))
    items = []
    for b in glyphs:
        # 项内间隙 ≤8px（中文字距 3–5、图标与文字 4）算同一个控件
        if items and b[0] - items[-1][-1][1] <= 8:
            items[-1].append(b)
        else:
            items.append([b])
    items = [it for it in items if it[-1][1] <= 1685]  # 右边框 x1690..1699 不是控件
    return items


def item_box(it):
    return {
        "x": it[0][0],
        "x1": it[-1][1],
        "w": it[-1][1] - it[0][0],
        "y": min(b[2] for b in it),
        "y1": max(b[3] for b in it),
        "glyphs": len(it),
    }


def scan():
    shots = {}
    for f in sorted(glob.glob(os.path.join(ROOT, "docs/ref/vrcx0-*.png"))):
        a = np.asarray(Image.open(f).convert("RGB")).astype(int)
        items = [item_box(i) for i in segments(a)]
        shots[os.path.basename(f)] = items
    return shots


shots = scan()
# 模态截图（好友详情）有遮罩，顶栏被压暗且项数不同 → 只统计项数 = 众数的截图
counts = [len(v) for v in shots.values()]
mode_n = statistics.mode(counts)
base = [n for n, v in shots.items() if len(v) == mode_n]
ref = shots[base[0]]
same = [n for n in base if shots[n] == ref]
if len(same) != len(base):
    raise SystemExit(f"顶栏结构不一致：{set(base) - set(same)}")

# ref = [brand, help, search(放大镜+占位), Ctrl, K, 6 icons, 3 window controls]
if len(ref) != 2 + 1 + 2 + 6 + 3:  # 品牌/帮助/搜索/Ctrl/K/6 图标/3 窗口控制
    raise SystemExit(f"顶栏项数异常：{len(ref)}")
brand, help_, search = ref[0], ref[1], ref[2]
shortcut = {
    "x": ref[3]["x"], "x1": ref[4]["x1"],
    "w": ref[4]["x1"] - ref[3]["x"],
}
actions = ref[5:11]
wctl = ref[11:14]


def pitch(items, key="x"):
    return round(statistics.median([items[i][key] - items[i - 1][key] for i in range(1, len(items))]), 1)


a0 = np.asarray(Image.open(os.path.join(ROOT, "docs/ref", base[0])).convert("RGB")).astype(int)
bg = "#%02x%02x%02x" % tuple(a0[20, 900])
# 顶栏下边框只在内容区上方（侧栏连续无分隔线）
border = tuple(a0[48, 900])
border_x = [x for x in range(300, 1600, 50) if abs(a0[48, x].mean() - 233) <= 3]

report = {
    "_note": "measure_ref_topbar.py：顶栏是页面无关的自定义标题栏。左：品牌 VRCX-0 + 帮助；右：搜索（放大镜/占位/Ctrl K）+ 6 图标 + 3 窗口控制。截图里没有 logo 方块、账号名、页面标题、副标题",
    "image": os.path.relpath(os.path.join(ROOT, "docs/ref", base[0]), ROOT),
    "shots_identical": len(same),
    "shots": base,
    "band": {"y": Y0, "h": Y1 - Y0, "bg": bg},
    "content_center_y": round((actions[0]["y"] + actions[0]["y1"]) / 2, 1),
    "brand": {**brand, "label": LABELS["brand"]},
    "help": {**help_, "label": LABELS["help"]},
    "search": {
        "x": search["x"],
        "x1": search["x1"],
        "w": search["w"],
        "icon_x": search["x"],
        "icon_w": 15,
        "placeholder_x": search["x"] + 15,
        "placeholder_w": search["x1"] - (search["x"] + 15),
        "placeholder": LABELS["search_placeholder"],
        "shortcut": {**shortcut, "label": LABELS["search_shortcut"]},
        # 占位文字右端到 Ctrl K 左端的弹性空白
        "shortcut_gap": shortcut["x"] - search["x1"],
        "box": False,          # 无边框/无独立底色，直接铺在顶栏背景上
        "border_bottom_over_content": len(border_x) == 26,  # 300..1600 每 50px 取样全命中
        "border_color": "#%02x%02x%02x" % border,
    },
    "actions": {
        "items": [{**it, "label": LABELS["actions"][i]} for i, it in enumerate(actions)],
        "count": len(actions),
        "pitch": pitch(actions),
        "first_x": actions[0]["x"],
        "last_x1": actions[-1]["x1"],
        "gap_from_shortcut": actions[0]["x"] - shortcut["x1"],
        "icon_w_median": round(statistics.median([it["w"] for it in actions]), 1),
    },
    "window_controls": {
        "items": [{**it, "label": LABELS["window_controls"][i]} for i, it in enumerate(wctl)],
        "count": len(wctl),
        "pitch": pitch(wctl),
        "first_x": wctl[0]["x"],
        "gap_from_actions": wctl[0]["x"] - actions[-1]["x1"],
        "right_pad": 1688 - wctl[-1]["x1"],
    },
    "page_title_in_topbar": False,
    "account_in_topbar": False,
    "source": "VRCX-0 自定义标题栏：品牌 + 帮助 + 搜索（Ctrl K）+ 通知/星芒/主题/图钉/分栏/收起 + 窗口控制；页面标题只在内容区",
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=1)

if "--write" in os.sys.argv:
    spec = json.load(open(SPEC_PATH, encoding="utf-8"))
    spec["chrome"]["topbar"].update({
        "bg": report["band"]["bg"],
        "content_center_y": report["content_center_y"],
        "brand": {"label": report["brand"]["label"], "x": report["brand"]["x"], "w": report["brand"]["w"], "cap_h": report["brand"]["y1"] - report["brand"]["y"]},
        "help": {"label": report["help"]["label"], "x": report["help"]["x"], "w": report["help"]["w"]},
        "search": {
            "x": report["search"]["x"], "w": report["search"]["w"],
            "icon_w": report["search"]["icon_w"],
            "placeholder": report["search"]["placeholder"],
            "shortcut": report["search"]["shortcut"]["label"],
            "shortcut_x": report["search"]["shortcut"]["x"],
            "shortcut_gap": report["search"]["shortcut_gap"],
            "box": report["search"]["box"],
        },
        "actions": {
            "count": report["actions"]["count"],
            "first_x": report["actions"]["first_x"],
            "pitch": report["actions"]["pitch"],
            "gap_from_shortcut": report["actions"]["gap_from_shortcut"],
            "icon_w": report["actions"]["icon_w_median"],
        },
        "window_controls": {
            "count": report["window_controls"]["count"],
            "first_x": report["window_controls"]["first_x"],
            "pitch": report["window_controls"]["pitch"],
            "right_pad": report["window_controls"]["right_pad"],
        },
        "page_title": False,
        "account": False,
        "_source": "docs/ref/topbar-measure.json（measure_ref_topbar.py，16 张真机截图顶栏逐项一致）",
    })
    with open(SPEC_PATH, "w", encoding="utf-8") as f:
        json.dump(spec, f, ensure_ascii=False, indent=1)

print(json.dumps({k: report[k] for k in ("shots_identical", "brand", "help", "search", "actions", "window_controls")}, ensure_ascii=False, indent=1))
