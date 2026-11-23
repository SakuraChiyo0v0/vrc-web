#!/usr/bin/env python3
"""页面 × 参考截图 × 像素量测 × 三端截图 覆盖矩阵。

    python3 scripts/ref_coverage.py            # 打印矩阵，写 docs/ref/coverage.json
    python3 scripts/ref_coverage.py --strict    # 有缺口时 exit 1

完成定义要求「每个页面都有 docs/ref 真机截图」「parity 断言逐条来自截图量测」「三端截图入库」，
这里把三件事变成一列可执行的真假值，缺口一眼可见。
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / 'web/src/App.jsx'
REF = ROOT / 'docs/ref/vrcx0-spec.json'
SHOTS = ROOT / 'docs/screenshots'
PARITY = ROOT / 'scripts/visual_parity.mjs'

# 页面 → 真机截图（VRCX-0 真机截到的页面名）
REF_OF = {
    'overview': 'overview',
    'search': 'search',
    'friends': 'locations',
    'feed': 'feed',
    'notifications': 'notifications',
    'sessions': 'roomhistory',
    'players': 'players',          # VRCX-0「房内玩家」，真机只有空态（VRChat 未运行），断言只能取骨架+空态
    'stats': 'NA',
    'favorites': 'favorites',
    'insights': 'insights',
    'worlds': 'worlds',
    'calendar': 'NA',
    'friendlist': 'friendlist',
    'friendlog': 'friendlog',
    'gamelog': 'gamelog',
    'settings': 'settings',
}
# VRCX-0 没有的页面：截图无法存在，写清证据，不让它冒充「已覆盖」
NA = {
    'stats': 'VRCX-0 的 #/charts 会重定向到 #/charts/mutual（与 insights 同页），无独立「近24小时统计」页；docs/ref/vrcx0-stats.png 就是该重定向页',
    'calendar': 'VRCX-0 无 calendar 路由，#/calendar 落回 #/feed（capture_ref_cdp.mjs MAP 注释与实截均如此）',
}
# 特殊：好友详情是模态，不是独立页面
MODAL_REF = 'friend'


def pages():
    src = APP.read_text()
    return re.findall(r"^\s{2}(\w+): lazy\(", src, re.M)


def spec():
    return json.loads(REF.read_text())


def measured_blocks(sp):
    """spec 里 _source 含 measured 的顶层块 + spec.pages 里按页量测的块"""
    out = {}
    for k, v in sp.items():
        if isinstance(v, dict) and 'measured' in str(v.get('_source', '')):
            out[k] = v
    for k, v in (sp.get('pages') or {}).items():
        if isinstance(v, dict) and 'measured' in str(v.get('_source', '')):
            out[k] = v
    return out


def shots_of(page):
    """三端截图：按文件名里的 desktop / mobile / 4k 关键字统计"""
    got = {'desktop': [], 'mobile': [], '4k': []}
    for f in SHOTS.rglob('*.png'):
        n = f.name.lower()
        if page not in n:
            continue
        if '4k' in n or '3840' in n:
            got['4k'].append(f.name)
        elif 'mobile' in n or '-390' in n:
            got['mobile'].append(f.name)
        elif 'desktop' in n or '-1440' in n or '-1600' in n:
            got['desktop'].append(f.name)
    return got


def parity_pages():
    src = PARITY.read_text()
    return set(re.findall(r"open\('(\w+)'", src))


def main():
    sp = spec()
    meas = measured_blocks(sp)
    cov = {}
    ps = parity_pages()
    for p in pages():
        refname = REF_OF.get(p)
        na = refname == 'NA'
        ref_file = ROOT / 'docs/ref' / f'vrcx0-{refname}.png' if refname and not na else None
        sh = shots_of(p)
        cov[p] = {
            'ref': str(ref_file.relative_to(ROOT)) if ref_file and ref_file.exists() else None,
            'na': NA.get(p) if na else None,
            'measured': refname in meas if refname and not na else False,
            'parity': p in ps,
            'shots': {k: len(v) for k, v in sh.items()},
            'shots_missing': [k for k, v in sh.items() if not v],
        }

    role = 'friend' if MODAL_REF else None
    modal = {
        'ref': f'docs/ref/vrcx0-{MODAL_REF}.png' if (ROOT / 'docs/ref' / f'vrcx0-{MODAL_REF}.png').exists() else None,
        'measured': 'friend_modal' in meas,
        'parity': 'drawer' in ps or 'friend' in ps,
        'shots': {k: len(v) for k, v in shots_of('drawer').items()},
        'shots_missing': [k for k, v in shots_of('drawer').items() if not v],
    }

    out = {
        '_note': '由 scripts/ref_coverage.py 生成；ref=真机截图，measured=spec 内有像素量测块，parity=visual_parity 覆盖，shots=三端截图，na=VRCX-0 无此页（带证据）',
        'pages': cov,
        'friend_modal': modal,
        'summary': {
            'pages': len(cov),
            'ref': sum(1 for v in cov.values() if v['ref']),
            'measured': sum(1 for v in cov.values() if v['measured']),
            'parity': sum(1 for v in cov.values() if v['parity']),
            'shots3': sum(1 for v in cov.values() if not v['shots_missing']),
            'na': sum(1 for v in cov.values() if v['na']),
            'todo': sum(1 for v in cov.values()
                        if not v['na'] and (not v['ref'] or not v['measured'] or not v['parity'] or v['shots_missing'])),
        },
    }
    (ROOT / 'docs/ref/coverage.json').write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n')

    hdr = f"{'页面':<12}{'真机截图':<28}{'像素量测':<9}{'parity':<8}三端截图"
    print(hdr)
    print('-' * 80)
    for p, v in cov.items():
        s = '/'.join(k for k in ('desktop', 'mobile', '4k') if not v['shots_missing']) or '缺'
        ref = f"n/a（{NA[p][:16]}…）" if v['na'] else (v['ref'] or '缺')
        print(f"{p:<12}{ref:<28}{'✓' if v['measured'] else ('n/a' if v['na'] else '缺'):<9}"
              f"{'✓' if v['parity'] else '缺':<7}{s}")
    sm = out['summary']
    print('-' * 80)
    print(f"页面 {sm['pages']} · 真机截图 {sm['ref']} · 像素量测 {sm['measured']} · "
          f"parity {sm['parity']} · 三端齐 {sm['shots3']} · n/a {sm['na']} · 待办 {sm['todo']}")
    print(f"好友模态：ref={'✓' if modal['ref'] else '缺'} measured={'✓' if modal['measured'] else '缺'} shots={modal['shots']}")
    print('→ docs/ref/coverage.json')

    if '--strict' in sys.argv and (sm['todo'] or not modal['measured'] or modal['shots_missing']):
        sys.exit(1)


if __name__ == '__main__':
    main()
