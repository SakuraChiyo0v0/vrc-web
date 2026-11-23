#!/usr/bin/env python3
"""量测真机动态页（docs/ref/vrcx0-feed.png）的表格几何，写 docs/ref/feed-measure.json。

    /opt/data/venvs/rembg/bin/python3 scripts/measure_ref_feed.py [--write]

只量像素能证明的东西（不猜）：
- 表格卡片上沿：内容面板内第一条横贯表格宽度的浅灰线
- 表头高度 / 行距：后续浅灰分隔线的间距
- 一屏可见行数：首行分隔线到状态栏之间的完整行
- 列位置：首行文字像素分组（列名与行内文字同 x 起点）
- 工具条文字 / 类型列文案：裁图 + vision 逐字读（记在 labels，附裁图路径）
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / 'docs/ref/vrcx0-feed.png'
OUT = ROOT / 'docs/ref/feed-measure.json'
CROP = ROOT / 'docs/ref/crop-feed-head.png'

# 内容面板（measure_ref_chrome.py 量得，全 16 张截图一致）
PANEL = (283, 47, 1398, 950)
TABLE_RIGHT = 1323      # 右侧好友栏左缘
STATUSBAR_Y = 996       # 状态栏上沿


def runs(mask, minlen=2):
    out, start = [], None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= minlen:
                out.append((start, i - 1))
            start = None
    if start is not None and len(mask) - start >= minlen:
        out.append((start, len(mask) - 1))
    return out


def main():
    img = np.array(Image.open(REF).convert('RGB')).astype(int)
    x0, y0, w, h = PANEL
    left, right = x0, TABLE_RIGHT

    # 横贯表格宽度的浅灰线（#f4f4f4 分隔线 / #f8f8f8 卡片上沿）
    lines = []
    for y in range(y0 + 20, min(y0 + h, STATUSBAR_Y)):  # 跳过内容面板上边框
        row = img[y, left:right]
        m = row.mean(axis=1)
        if ((m > 200) & (m < 250)).mean() > 0.6:
            lines.append(y)
    # 相邻像素合成一条
    bands = []
    start = prev = lines[0]
    for y in lines[1:]:
        if y - prev <= 1:
            prev = y
        else:
            bands.append((start, prev))
            start = prev = y
    bands.append((start, prev))

    # 分隔线只在内容区出现（真机左缩进 19）：从内容面板左边 +2 起扫，
    # 只认分隔线色（240..252）；面板左边框是 227，不能算进去（旧口径误判 inset=0）
    # 用「连续 ≥500px 的分隔线色」定线的左端：面板左边框内侧有一圈 248 的高光，
    # 逐列占比法会把 inset 误判成 2
    m0 = img[bands[0][0], left:right].mean(axis=1)
    segs = runs((m0 > 240) & (m0 < 252), minlen=500)
    line_x0 = left + segs[0][0] if segs else None
    inset = (line_x0 - left) if line_x0 else 0

    # 表头没有上边框：bands[0] 就是表头底线（首条分隔线），表体从它下面开始。
    # 旧口径从 bands[1] 起算，把表头底线当表体顶，top/rows_visible 各少算一层
    separators = [b[0] for b in bands]
    pitches = [separators[i + 1] - separators[i] for i in range(len(separators) - 1)]
    row_h = float(np.median(pitches))
    header_h = int(row_h)
    table_top = separators[0] - header_h
    rows_visible = int((STATUSBAR_Y - table_top - header_h) // row_h)

    # 首行文字按 x 分组成列（列间距 > 30px）
    band = img[separators[0] + 4:separators[0] + int(row_h) - 4, left:right]
    dark = band.mean(axis=2) < 170
    xs = np.where(dark.mean(axis=0) > 0.01)[0]
    groups, start, prev = [], xs[0], xs[0]
    for x in xs[1:]:
        if x - prev > 30:
            groups.append((start, prev))
            start = x
        prev = x
    groups.append((start, prev))
    text_x = [int(a) for a, _ in groups]
    widths = [None] * len(text_x)
    for i in range(len(text_x) - 1):
        widths[i] = text_x[i + 1] - text_x[i]
    widths[-1] = (right - left) - text_x[-1]

    # 裁出表头区供 vision 复核（工具条 + 表头 + 首行）
    Image.open(REF).convert('RGB').crop((x0, y0, right, y0 + 200)).resize((2080, 400), Image.LANCZOS).save(CROP)

    out = {
        '_source': 'scripts/measure_ref_feed.py（像素分段）+ vision 逐字读 docs/ref/crop-feed-head.png、crop-feed-types.png',
        'ref': 'docs/ref/vrcx0-feed.png',
        'panel': {'x': x0, 'y': y0, 'w': w, 'h': h},
        'table': {
            'x': left, 'w': right - left, 'top': table_top,
            'header_h': header_h, 'row_h': int(row_h),
            'rows_visible': rows_visible, 'first_row_y': separators[0],
            'inset': inset, 'footer': False,
        },
        'columns': {
            'names': ['时间', '玩家', '类型', '详细信息'],
            'text_x_rel': text_x,
            'widths': widths,
        },
        'toolbar': ['类型', '搜索'],
        'type_labels': ['位置变动', '上线', '模型变动'],
        'crop': 'docs/ref/crop-feed-head.png',
    }
    print(json.dumps(out, ensure_ascii=False, indent=1))
    if '--write' in sys.argv:
        OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
        print(f'→ {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
