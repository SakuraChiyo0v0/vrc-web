#!/usr/bin/env python3
"""从真机截图量测 VRCX-0 的通用骨架（窗口/顶栏/侧栏/内容面板/状态栏）与每页行密度。

    /opt/data/venvs/rembg/bin/python3 scripts/measure_ref_chrome.py          # 打印量测
    /opt/data/venvs/rembg/bin/python3 scripts/measure_ref_chrome.py --write  # 写回 docs/ref/vrcx0-spec.json

所有数值都是像素边界（颜色分段），不靠肉眼估：
- 截图有 1px 黑框：内窗 = 非黑包围盒
- 顶栏/状态栏/侧栏/右边距 = 背景 #f5f5f5(245) 占比高的行/列带
- 内容面板 = 侧栏右缘与右边距之间、顶栏与状态栏之间的区域
- 选中导航项 = 侧栏内 #e5e5e5(229) 的块
- 行密度 = 内容面板内「深色像素行」的连续段数量与中位间距（表格/列表的行）
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs/ref'
SPEC = OUT / 'vrcx0-spec.json'
EXCLUDE = {'vrcx0-friend.png'}  # 1280×756 的模态旧图，骨架按 1700×1040 量
BG = 245
PILL = 229


def eq(arr, v, tol=2):
    return np.abs(arr - v).max(axis=2) <= tol


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


def measure(path):
    img = np.array(Image.open(path).convert('RGB')).astype(int)
    H, W = img.shape[:2]
    black = eq(img, 0, 6)
    ys = np.where(~black.all(axis=1))[0]
    xs = np.where(~black.all(axis=0))[0]
    inner = {'x': int(xs.min()), 'y': int(ys.min()),
             'w': int(xs.max() - xs.min() + 1), 'h': int(ys.max() - ys.min() + 1)}
    iy0, iy1 = inner['y'], inner['y'] + inner['h'] - 1
    ix0, ix1 = inner['x'], inner['x'] + inner['w'] - 1

    bg = eq(img, BG)
    # 顶栏 / 状态栏：整行背景占比高的带（最上一条 / 最下一条）
    rfrac = bg[iy0:iy1 + 1, ix0:ix1 + 1].mean(axis=1)
    bands = runs(rfrac > 0.8, 5)
    top_r, bot_r = bands[0], bands[-1]
    topbar = {'y': iy0 + top_r[0], 'h': top_r[1] - top_r[0] + 1}
    statusbar = {'y': iy0 + bot_r[0], 'h': bot_r[1] - bot_r[0] + 1}

    # 内容行区间（顶栏下沿到状态栏上沿）内的列背景占比 → 侧栏 / 右边距
    cy0, cy1 = iy0 + top_r[1] + 1, iy0 + bot_r[0] - 1
    cfrac = bg[cy0:cy1 + 1, ix0:ix1 + 1].mean(axis=0)
    left = [r for r in runs(cfrac > 0.55, 8) if r[0] < 50]
    right = [r for r in runs(cfrac > 0.55, 4) if r[1] > inner['w'] - 40]
    sidebar = {'x': ix0, 'w': (ix0 + left[-1][1]) - ix0 + 1} if left else None
    rmargin = {'x': ix0 + right[0][0], 'w': right[0][1] - right[0][0] + 1} if right else None

    cx0 = sidebar['x'] + sidebar['w'] if sidebar else ix0
    cx1 = rmargin['x'] - 1 if rmargin else ix1
    # 内容面板纵向：列区间内非背景行
    inner_rows = bg[cy0:cy1 + 1, cx0:cx1 + 1].mean(axis=1)
    body = runs(inner_rows < 0.6, 5)
    by0, by1 = cy0 + body[0][0], cy0 + body[-1][1]
    content = {'x': cx0, 'y': by0, 'w': cx1 - cx0 + 1, 'h': by1 - by0 + 1}

    # 选中导航项：侧栏内 #e5e5e5 块
    pill = eq(img[content['y']:content['y'] + content['h'], sidebar['x']:sidebar['x'] + sidebar['w']], PILL, 2)
    pc, pr = pill.mean(axis=0), pill.mean(axis=1)
    cols = [r for r in runs(pc > 0.3, 10)]
    rows = [r for r in runs(pr > 0.05, 8)]
    pill_box = None
    if cols and rows:
        r0 = max(rows, key=lambda r: r[1] - r[0])
        c0 = max(cols, key=lambda r: r[1] - r[0])
        pill_box = {'x': sidebar['x'] + c0[0], 'y': content['y'] + r0[0],
                    'w': c0[1] - c0[0] + 1, 'h': r0[1] - r0[0] + 1}

    # 行密度：内容面板内每行深色像素占比，连续段 = 一行内容
    panel = img[content['y']:content['y'] + content['h'], content['x']:content['x'] + content['w']]
    dark = (panel.mean(axis=2) < 140).mean(axis=1)
    rb = runs(dark > 0.004, 4)
    centers = [(a + b) / 2 for a, b in rb]
    pitches = [round(centers[i] - centers[i - 1], 1) for i in range(1, len(centers))]
    med = float(np.median(pitches)) if len(pitches) >= 4 else None

    return {
        'ref_size': [W, H],
        'inner': inner,
        'topbar': topbar,
        'statusbar': statusbar,
        'sidebar': sidebar,
        'rmargin': rmargin,
        'content': content,
        'nav_pill': pill_box,
        'row_bands': len(rb),
        'row_pitch': med,
    }


def main():
    files = sorted(p for p in OUT.glob('vrcx0-*.png') if p.name not in EXCLUDE)
    per = {f.stem.replace('vrcx0-', ''): measure(f) for f in files}

    keys = ['inner', 'topbar', 'statusbar', 'sidebar', 'rmargin', 'content']
    base = per['overview']
    drift = {k: [n for n, m in per.items() if m[k] != base[k]] for k in keys}
    drift = {k: v for k, v in drift.items() if v}
    print(f"{'页面':<14}{'内容面板':<22}{'行带':<6}{'行距':<8}选中项")
    print('-' * 80)
    for name, m in per.items():
        c = m['content']
        p = m['nav_pill']
        box = '%dx%d@%d,%d' % (c['w'], c['h'], c['x'], c['y'])
        print(f"{name:<14}{box:<22}{m['row_bands']:<6}{str(m['row_pitch']):<8}"
              f"{'%dpx' % p['h'] if p else '—'}")
    print('-' * 80)
    print('骨架一致：' + ('是' if not drift else f'否 {drift}'))
    print(f"窗口 {base['inner']['w']}x{base['inner']['h']} · 顶栏 {base['topbar']['h']}px · "
          f"侧栏 {base['sidebar']['w']}px · 内容 {base['content']['w']}x{base['content']['h']} · "
          f"右边距 {base['rmargin']['w']}px · 状态栏 {base['statusbar']['h']}px")

    chrome = {
        '_source': f'measured docs/ref/vrcx0-*.png（{len(files)} 张 1700×1040；scripts/measure_ref_chrome.py）',
        **{k: base[k] for k in keys},
        'nav_pill': base['nav_pill'],
        'ratios': {
            'sidebar_of_inner': round(base['sidebar']['w'] / base['inner']['w'], 4),
            'topbar_of_inner': round(base['topbar']['h'] / base['inner']['h'], 4),
            'statusbar_of_inner': round(base['statusbar']['h'] / base['inner']['h'], 4),
        },
        'stable': not drift,
    }
    spec_add = {
        'chrome': chrome,
        'pages': {n: {'_source': f'measured docs/ref/vrcx0-{n}.png（scripts/measure_ref_chrome.py）', **m}
                  for n, m in per.items()},
    }
    if '--write' in sys.argv:
        spec = json.loads(SPEC.read_text())
        spec.update(spec_add)
        SPEC.write_text(json.dumps(spec, ensure_ascii=False, indent=1) + '\n')
        print(f'\n已写入 {SPEC}：chrome + {len(per)} 页量测块')
    else:
        print(json.dumps(chrome, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
