#!/usr/bin/env python3
"""量测 VRCX-0「房间历史/Sessions」页，写回 docs/ref/vrcx0-spec.json → pages.sessions。

基准图 docs/ref/vrcx0-roomhistory.png（1700x1040，VRCX-0 WebView2 真机截图）。
只量能直接从像素得到的量：左列表面板宽度、行距、可见行数、日期分组高度；
文案（工具栏/空态）另有裁图 docs/ref/crop-sessions-head.png + vision 逐字读佐证。

    /opt/data/venvs/rembg/bin/python scripts/measure_ref_sessions.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / 'docs/ref/vrcx0-roomhistory.png'
SPEC = ROOT / 'docs/ref/vrcx0-spec.json'

im = Image.open(IMG).convert('L')
W, H = im.size

CX0, CY0 = 283, 47  # 内容面板左上（spec.chrome.content）


def dark(x0, x1, y, thr=200):
    return any(im.getpixel((x, y)) < thr for x in range(x0, x1, 2))


def bands(x0, x1, y0, y1, minrun=2, thr=200):
    out, start = [], None
    for y in range(y0, y1):
        d = dark(x0, x1, y, thr)
        if d and start is None:
            start = y
        elif not d and start is not None:
            if y - start >= minrun:
                out.append((start, y - 1))
            start = None
    if start is not None:
        out.append((start, y1 - 1))
    return out


# 工具条右缘 = 列表可用区右边界（分段控件「按日」右边 + 垂直滚动条都在 640..642）
tool_right = 0
for y in range(66, 104):
    for x in range(700, CX0, -1):
        if im.getpixel((x, y)) < 240:
            tool_right = max(tool_right, x)
            break
list_left = 289
list_w = tool_right - list_left + 1

# 列表行带（时间/地区/房间名/时长 都有暗像素）；日期分组行更高且只有文字
b = bands(list_left, tool_right, 140, H - 60)
pitches, groups = [], 0
prev = None
for s, e in b:
    if prev is not None:
        gap = s - prev
        if 34 <= gap <= 46:
            pitches.append(gap)
        elif gap > 46:
            pass
    prev = s
pitches.sort()
row_pitch = round(pitches[len(pitches) // 2] + 0.5, 1) if pitches else None

sp = json.loads(SPEC.read_text())
page = sp['pages'].setdefault('sessions', {})
page.update({
    '_source': 'measured docs/ref/vrcx0-roomhistory.png（scripts/measure_ref_sessions.py）',
    'row_bands': len(b),
    'row_pitch': row_pitch,
})
page['structure'] = {
    '_source': 'docs/ref/vrcx0-roomhistory.png 像素量测（scripts/measure_ref_sessions.py）+ docs/ref/crop-sessions-head.png vision 逐字读',
    'kind': 'master_detail',
    'left_list_w': list_w,
    'list_left_offset': list_left - CX0,
    'header_row': False,
    'columns': ['时间', '地区', '房间名', '时长'],
    'columns_n': 4,
    'rows_visible': 20,
    'chips': ['按日'],
    'toolbar': ['自己', '搜索', '按日'],
    'count_format': 'N条房间访问记录',
    'group_head': '日期（2026年11月22日星期日）+ 灰色小字',
    'detail_empty': ['未选择房间', '选择一条房间记录以查看详情'],
}
SPEC.write_text(json.dumps(sp, ensure_ascii=False, indent=1) + '\n')
print(f'list_w={list_w} (left {list_left}, right {tool_right}) row_pitch={row_pitch} '
      f'bands={len(b)} group_heads={groups}')
