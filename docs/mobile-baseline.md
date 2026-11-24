# 移动端验收基线（自动生成，勿手改）

生成：2026-11-24 00:35:58 · 断言 1275/1275 PASS · 页面 14 × 视口 11

移动形态判据：宽 ≤1023 或高 ≤500（styles.css / tailwind md raw / Sidebar matchMedia 三处一致）。
重新生成：`node scripts/mobile_parity.mjs`（脚本末尾自动写回本文件）。

## friends@320

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=320 vw=320 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 320px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friends@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 360px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friends@375

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=375 vw=375 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 375px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friends@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=390 vw=390 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| chip 命中区≥36 | 36px ▦(36) ☷(36) 在线 15(36) | ≥36px | PASS |
| 表单控件≥36 | 36px 搜索好友(36) | ≥36px | PASS |
| 行内/表格目标≥32 | n/a | ≥32px | PASS |
| 表单控件中心可点（未被遮挡） | 0 处遮挡 | 0 | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 390px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friends@414

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=414 vw=414 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 414px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friends@430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=430 vw=430 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 430px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friends@844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=844 vw=844 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 844px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 311px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## friends@932

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=932 vw=932 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 932px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 351px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## friends@768

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=768 vw=768 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 768px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friends@820

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=820 vw=820 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 820px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## worlds@320

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=320 vw=320 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 320px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## worlds@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 360px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## worlds@375

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=375 vw=375 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 375px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## worlds@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=390 vw=390 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| chip 命中区≥36 | 36px 收藏(36) 次数不限去过 ≥1 次去过 ≥3 次(36) 容量不限≤8 人9–16 人17–3(36) | ≥36px | PASS |
| 表单控件≥36 | 36px (36) | ≥36px | PASS |
| 行内/表格目标≥32 | 32px 按世界排序(32) 按作者排序(32) 按访问次数排序(32) | ≥32px | PASS |
| 表单控件中心可点（未被遮挡） | 0 处遮挡 | 0 | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 390px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## worlds@414

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=414 vw=414 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 414px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## worlds@430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=430 vw=430 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 430px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## worlds@844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=844 vw=844 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 844px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 311px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## worlds@932

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=932 vw=932 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 932px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 351px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## worlds@768

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=768 vw=768 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 768px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## worlds@820

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=820 vw=820 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 820px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## overview@320

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=320 vw=320 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 320px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## overview@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 360px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## overview@375

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=375 vw=375 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 375px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## overview@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=390 vw=390 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| chip 命中区≥36 | n/a | ≥36px | PASS |
| 表单控件≥36 | n/a | ≥36px | PASS |
| 行内/表格目标≥32 | 36px 概览(36) 旅程(36) 全部(36) | ≥32px | PASS |
| 表单控件中心可点（未被遮挡） | 0 处遮挡 | 0 | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 390px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## overview@414

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=414 vw=414 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 414px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## overview@430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=430 vw=430 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 430px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## overview@844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=844 vw=844 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 844px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 311px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## overview@932

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=932 vw=932 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 932px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 351px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## overview@768

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=768 vw=768 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 768px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## overview@820

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=820 vw=820 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 820px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## search@320

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=320 vw=320 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 320px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## search@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 360px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## search@375

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=375 vw=375 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 375px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## search@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=390 vw=390 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| chip 命中区≥36 | 36px 探索(36) 玩家(36) 世界(36) | ≥36px | PASS |
| 表单控件≥36 | n/a | ≥36px | PASS |
| 行内/表格目标≥32 | n/a | ≥32px | PASS |
| 表单控件中心可点（未被遮挡） | 0 处遮挡 | 0 | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 390px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## search@414

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=414 vw=414 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 414px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## search@430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=430 vw=430 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 430px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## search@844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=844 vw=844 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 844px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 311px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## search@932

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=932 vw=932 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 932px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 351px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## search@768

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=768 vw=768 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 768px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## search@820

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=820 vw=820 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 820px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## feed@320

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=320 vw=320 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 320px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## feed@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 360px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## feed@375

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=375 vw=375 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 375px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## feed@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=390 vw=390 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| chip 命中区≥36 | n/a | ≥36px | PASS |
| 表单控件≥36 | 36px 类型(36) (36) 日期(36) | ≥36px | PASS |
| 行内/表格目标≥32 | 32px Alice(32) Bob(32) Alpha Club(32) | ≥32px | PASS |
| 表单控件中心可点（未被遮挡） | 0 处遮挡 | 0 | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 390px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## feed@414

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=414 vw=414 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 414px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## feed@430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=430 vw=430 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 430px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## feed@844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=844 vw=844 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 844px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 311px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## feed@932

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=932 vw=932 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 932px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 351px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## feed@768

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=768 vw=768 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 768px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## feed@820

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=820 vw=820 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 820px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## sessions@320

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=320 vw=320 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 320px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## sessions@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 360px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## sessions@375

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=375 vw=375 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 375px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## sessions@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=390 vw=390 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| chip 命中区≥36 | n/a | ≥36px | PASS |
| 表单控件≥36 | n/a | ≥36px | PASS |
| 行内/表格目标≥32 | 32px 搜索(32) 按日(32) | ≥32px | PASS |
| 表单控件中心可点（未被遮挡） | 0 处遮挡 | 0 | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 390px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## sessions@414

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=414 vw=414 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 414px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## sessions@430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=430 vw=430 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 430px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## sessions@844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=844 vw=844 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 844px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 311px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## sessions@932

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=932 vw=932 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 932px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 351px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## sessions@768

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=768 vw=768 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 768px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## sessions@820

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=820 vw=820 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 820px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## players@320

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=320 vw=320 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 40px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 320px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## players@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 40px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 360px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## players@375

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=375 vw=375 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 40px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 375px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## players@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=390 vw=390 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 40px | ≥32px | PASS |
| chip 命中区≥36 | n/a | ≥36px | PASS |
| 表单控件≥36 | n/a | ≥36px | PASS |
| 行内/表格目标≥32 | n/a | ≥32px | PASS |
| 表单控件中心可点（未被遮挡） | 0 处遮挡 | 0 | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 390px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## players@414

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=414 vw=414 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 40px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 414px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## players@430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=430 vw=430 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 40px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 430px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## players@844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=844 vw=844 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 40px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 844px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 311px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## players@932

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=932 vw=932 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 40px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 932px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 351px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## players@768

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=768 vw=768 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 40px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 768px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## players@820

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=820 vw=820 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 40px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 820px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## moderation@320

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=320 vw=320 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | n/a | ≥32px | PASS |
| 最小字号≥11 | 13px | ≥11px | PASS |
| 内容区非零宽 | nullpx | >0 | PASS |
| 侧栏默认收起 | left=null | <0 | PASS |

## moderation@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 360px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## moderation@375

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=375 vw=375 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 375px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## moderation@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=390 vw=390 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| chip 命中区≥36 | 36px 筛选(36) 刷新(36) | ≥36px | PASS |
| 表单控件≥36 | 36px 搜索(36) | ≥36px | PASS |
| 行内/表格目标≥32 | n/a | ≥32px | PASS |
| 表单控件中心可点（未被遮挡） | 0 处遮挡 | 0 | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 390px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## moderation@414

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=414 vw=414 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 414px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## moderation@430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=430 vw=430 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 430px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## moderation@844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=844 vw=844 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 844px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 311px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## moderation@932

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=932 vw=932 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 932px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 351px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## moderation@768

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=768 vw=768 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 768px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## moderation@820

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=820 vw=820 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 820px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## favorites@320

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=320 vw=320 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 320px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## favorites@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 360px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## favorites@375

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=375 vw=375 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 375px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## favorites@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=390 vw=390 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| chip 命中区≥36 | 36px 刷新(36) + 收藏(36) 分享(36) | ≥36px | PASS |
| 表单控件≥36 | 36px 搜索收藏(36) | ≥36px | PASS |
| 行内/表格目标≥32 | n/a | ≥32px | PASS |
| 表单控件中心可点（未被遮挡） | 0 处遮挡 | 0 | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 390px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## favorites@414

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=414 vw=414 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 414px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## favorites@430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=430 vw=430 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 430px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## favorites@844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=844 vw=844 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 844px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 311px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## favorites@932

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=932 vw=932 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 932px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 351px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## favorites@768

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=768 vw=768 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 768px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## favorites@820

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=820 vw=820 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 820px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## insights@320

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=320 vw=320 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 320px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## insights@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 360px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## insights@375

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=375 vw=375 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 375px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## insights@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=390 vw=390 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| chip 命中区≥36 | 36px 再次拉取(36) 重置(36) | ≥36px | PASS |
| 表单控件≥36 | 36px 查找好友(36) (36) | ≥36px | PASS |
| 行内/表格目标≥32 | n/a | ≥32px | PASS |
| 表单控件中心可点（未被遮挡） | 0 处遮挡 | 0 | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 390px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## insights@414

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=414 vw=414 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 414px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## insights@430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=430 vw=430 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 430px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## insights@844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=844 vw=844 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 844px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 311px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## insights@932

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=932 vw=932 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 932px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 351px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## insights@768

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=768 vw=768 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 768px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## insights@820

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=820 vw=820 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 820px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friendlist@320

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=320 vw=320 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 320px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friendlist@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 360px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friendlist@375

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=375 vw=375 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 375px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friendlist@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=390 vw=390 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| chip 命中区≥36 | 36px 筛选(36) 加载共同好友(36) 拉取缺失的字段(36) | ≥36px | PASS |
| 表单控件≥36 | 36px 搜索好友(36) | ≥36px | PASS |
| 行内/表格目标≥32 | n/a | ≥32px | PASS |
| 表单控件中心可点（未被遮挡） | 0 处遮挡 | 0 | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 390px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friendlist@414

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=414 vw=414 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 414px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friendlist@430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=430 vw=430 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 430px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friendlist@844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=844 vw=844 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 844px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 311px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## friendlist@932

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=932 vw=932 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 932px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 351px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## friendlist@768

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=768 vw=768 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 768px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friendlist@820

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=820 vw=820 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 820px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friendlog@320

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=320 vw=320 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 320px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friendlog@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 360px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friendlog@375

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=375 vw=375 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 375px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friendlog@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=390 vw=390 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| chip 命中区≥36 | 36px 筛选(36) 导出 CSV(36) 删除(36) | ≥36px | PASS |
| 表单控件≥36 | 36px 搜索好友日志(36) | ≥36px | PASS |
| 行内/表格目标≥32 | n/a | ≥32px | PASS |
| 表单控件中心可点（未被遮挡） | 0 处遮挡 | 0 | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 390px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friendlog@414

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=414 vw=414 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 414px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friendlog@430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=430 vw=430 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 430px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friendlog@844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=844 vw=844 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 844px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 311px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## friendlog@932

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=932 vw=932 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 932px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 351px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## friendlog@768

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=768 vw=768 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 768px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## friendlog@820

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=820 vw=820 | ≤vw+1 | PASS |
| 表格卡片化 | thead=none tr=flex | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 820px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## gamelog@320

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=320 vw=320 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 320px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## gamelog@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 360px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## gamelog@375

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=375 vw=375 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 375px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## gamelog@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=390 vw=390 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| chip 命中区≥36 | n/a | ≥36px | PASS |
| 表单控件≥36 | 36px 类型(36) 搜索(36) 日期(36) | ≥36px | PASS |
| 行内/表格目标≥32 | 32px Alpha Club(32) Yu-V(32) Carol(32) | ≥32px | PASS |
| 表单控件中心可点（未被遮挡） | 0 处遮挡 | 0 | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 390px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## gamelog@414

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=414 vw=414 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 414px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## gamelog@430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=430 vw=430 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 430px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## gamelog@844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=844 vw=844 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 844px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 311px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## gamelog@932

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=932 vw=932 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 932px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 351px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## gamelog@768

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=768 vw=768 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 768px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## gamelog@820

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=820 vw=820 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 820px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## settings@320

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=320 vw=320 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 320px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## settings@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 360px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## settings@375

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=375 vw=375 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 375px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## settings@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=390 vw=390 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| chip 命中区≥36 | 36px 设置快捷键(36) 设置密码(36) 设置延迟（分钟）(36) | ≥36px | PASS |
| 表单控件≥36 | 36px (36) | ≥36px | PASS |
| 行内/表格目标≥32 | 44px 系统(44) 界面(44) 社交(44) | ≥32px | PASS |
| 表单控件中心可点（未被遮挡） | 0 处遮挡 | 0 | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 390px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## settings@414

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=414 vw=414 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 414px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## settings@430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=430 vw=430 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 430px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## settings@844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=844 vw=844 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 844px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 311px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## settings@932

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=932 vw=932 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 932px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |
| 横屏内容区非零高 | 351px | ≥200 | PASS |
| 横屏顶栏高度 | 44px | ≤48 | PASS |

## settings@768

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=768 vw=768 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 768px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## settings@820

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=820 vw=820 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 36px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 820px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## breakpoint@1023x900

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 断点形态 | thead=none tr=flex | thead=none tr=flex | PASS |
| 无横向溢出 | scrollW=1023 vw=1023 | ≤vw+1 | PASS |

## breakpoint@1024x900

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 断点形态 | thead=table-header-group tr=table-row | thead=table-row 不是 flex | PASS |
| 无横向溢出 | scrollW=1024 vw=1024 | ≤vw+1 | PASS |

## breakpoint@1024x500

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 断点形态 | thead=none tr=flex | thead=none tr=flex | PASS |
| 无横向溢出 | scrollW=1024 vw=1024 | ≤vw+1 | PASS |

## breakpoint@1024x501

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 断点形态 | thead=table-header-group tr=table-row | thead=table-row 不是 flex | PASS |
| 无横向溢出 | scrollW=1024 vw=1024 | ≤vw+1 | PASS |

## topbar@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 顶栏搜索入口 | 按钮 2: 菜单/快速搜索 | ≥2 且含「快速搜索」 | PASS |
| 顶栏按钮 44 命中区 | 44×44 | ≥44×44 | PASS |
| 搜索按钮开面板 | true | true | PASS |
| Esc 关面板 | false | false | PASS |

## palette@390x844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 面板在可视高 560 内 | top=67 bottom=221 | bottom≤560 | PASS |
| 结果列表高度按可视高算 | listH=78 maxH=291 | maxH≤291 | PASS |

## palette@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 面板在可视高 300 内 | top=36 bottom=190 | bottom≤300 | PASS |
| 结果列表高度按可视高算 | listH=78 maxH=156 | maxH≤156 | PASS |

## cards@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 列名等宽/值同起点 | 9 格 列名 77px 差 0px | 差≤1px | PASS |

## drawer@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| ☰ 打开抽屉 | left=-214→0 data-open=true | left≥-1 且 data-open=true | PASS |
| 抽屉导航 ≥44/40 | 顶层 14 项 44px / 二级 7 项 40px | 顶层≥44 二级≥40 | PASS |
| 导航文字对比度≥4.5:1 | 6.73:1（21 项，最小字号 12px） | ≥4.5:1 | PASS |
| ✕ 关闭抽屉 | left=-214 | <0 | PASS |
| 打开后焦点进抽屉 | true | true | PASS |
| Tab 焦点锁在抽屉内 | 漏出 0/40 次 | 0 | PASS |
| Esc 关闭抽屉 | left=-214 | <0 | PASS |
| 关闭后焦点回 ☰ | 菜单 | 菜单 | PASS |
| 点遮罩关闭抽屉 | left=-214 | <0 | PASS |

## topbar@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 标题不截断 | false | false | PASS |
| 按钮不挤出顶栏 | right=836 bar=844 | ≤bar | PASS |
| 左右按钮余量 | gap=734px | ≥200 | PASS |

## topbar@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 标题不截断 | false | false | PASS |
| 按钮不挤出顶栏 | right=924 bar=932 | ≤bar | PASS |
| 左右按钮余量 | gap=822px | ≥200 | PASS |

## switch@390x844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 开关命中区 44×44 | 44×44（轨道 32×18） | 44×44 且轨道 32×18 | PASS |
| 边缘 ±18px 仍命中 | true | true | PASS |

## switch@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 开关命中区 44×44 | 44×44（轨道 32×18） | 44×44 且轨道 32×18 | PASS |
| 边缘 ±18px 仍命中 | true | true | PASS |

## feed@360x800

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 输入框字号≥16（iOS 不放大） | 16px ×3 | ≥16px | PASS |
| 日期框容得下 16px 文本 | 112px 内宽 112 | clientWidth≥96 | PASS |

## feed@390x844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 输入框字号≥16（iOS 不放大） | 16px ×3 | ≥16px | PASS |
| 日期框容得下 16px 文本 | 112px 内宽 112 | clientWidth≥96 | PASS |

## feed@430x932

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 输入框字号≥16（iOS 不放大） | 16px ×3 | ≥16px | PASS |
| 日期框容得下 16px 文本 | 112px 内宽 112 | clientWidth≥96 | PASS |

## feed@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 输入框字号≥16（iOS 不放大） | 16px ×3 | ≥16px | PASS |
| 日期框容得下 16px 文本 | 112px 内宽 112 | clientWidth≥96 | PASS |

## sessions@390x844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 输入框字号≥16（iOS 不放大） | n/a | ≥16px | PASS |
| 日期框容得下 16px 文本 | n/a | clientWidth≥96 | PASS |

## settings@390x844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 输入框字号≥16（iOS 不放大） | 16px ×1 | ≥16px | PASS |
| 日期框容得下 16px 文本 | n/a | clientWidth≥96 | PASS |

## friendlist@390x844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 输入框字号≥16（iOS 不放大） | 16px ×1 | ≥16px | PASS |
| 日期框容得下 16px 文本 | n/a | clientWidth≥96 | PASS |

## safe-area@390x844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 安全区变量已定义 | 0px/0px/0px/0px | 全是长度值（0px 起） | PASS |
| 顶栏让出刘海 | bar=91 pad=47（无刘海 44） | =44+47 且 pad=47 | PASS |
| 抽屉上边让出刘海 | top=47 bottom=775 状态栏顶=775 | top=47 且 抽屉底≤状态栏顶 | PASS |
| 抽屉左右让位（横屏刘海） | left=0 | left=0 | PASS |
| 顶栏左右让位（横屏刘海） | left=14 right=8 | left=14 right=8 | PASS |
| 内容区左右让位 | main padding-left=0 | 0 | PASS |
| 状态栏不被 home 指示条盖住 | 内容底边距=43px pad=34 | ≥34 且 pad=34 | PASS |
| 滚动不外溢（不发下拉刷新） | contain | contain | PASS |

## safe-area@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 安全区变量已定义 | 0px/0px/0px/0px | 全是长度值（0px 起） | PASS |
| 顶栏让出刘海 | bar=44 pad=0（无刘海 44） | =44+0 且 pad=0 | PASS |
| 抽屉上边让出刘海 | top=0 bottom=334 状态栏顶=334 | top=0 且 抽屉底≤状态栏顶 | PASS |
| 抽屉左右让位（横屏刘海） | left=47 | left=47 | PASS |
| 顶栏左右让位（横屏刘海） | left=61 right=55 | left=61 right=55 | PASS |
| 内容区左右让位 | main padding-left=47 | 47 | PASS |
| 状态栏不被 home 指示条盖住 | 内容底边距=30px pad=21 | ≥21 且 pad=21 | PASS |
| 滚动不外溢（不发下拉刷新） | contain | contain | PASS |

## rotate@390→1024

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 开抽屉后转桌面：data-open 清掉 | 打开时 true → 转后 false | false | PASS |
| 桌面侧栏常驻可见 | left=0 w=277 | left=0 | PASS |
| 焦点陷阱已卸载（Tab 能出侧栏） | 21 项，末项 Tab 后 → ▦（侧栏内=false） | false | PASS |
| 桌面 Esc 不改抽屉状态 | data-open=false left=0 | false/0 | PASS |
| 转回 390 抽屉默认收起 | data-open=false left=-214 | false 且 <0 | PASS |

## drawer-landscape@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 抽屉不压状态栏 | 抽屉底=355 状态栏顶=355 | ≤ | PASS |
| 收起按钮不压状态栏 | 按钮底=343 状态栏顶=355 | ≤ | PASS |
| 状态栏区不被按钮吃掉 | y=状态栏中点命中 BUTTON | ≠collapse | PASS |
| 收起按钮本身仍可点 | 按钮中点命中 collapse | collapse | PASS |

## drawer-landscape@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 抽屉不压状态栏 | 抽屉底=395 状态栏顶=395 | ≤ | PASS |
| 收起按钮不压状态栏 | 按钮底=383 状态栏顶=395 | ≤ | PASS |
| 状态栏区不被按钮吃掉 | y=状态栏中点命中 BUTTON | ≠collapse | PASS |
| 收起按钮本身仍可点 | 按钮中点命中 collapse | collapse | PASS |

## scroll@friendlist@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 开合抽屉后滚动位置保持 | 250→250 | ±2px | PASS |
| 旋转回竖屏后滚动位置保持 | 250→250 | ±2px | PASS |
| 30 次深滚 ≤300ms | 0ms（20 行） | ≤300ms | PASS |

## scroll@feed@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 开合抽屉后滚动位置保持 | 250→250 | ±2px | PASS |
| 旋转回竖屏后滚动位置保持 | 250→250 | ±2px | PASS |
| 30 次深滚 ≤300ms | 0ms（36 行） | ≤300ms | PASS |

## extreme@friendlist@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 超长昵称不撑破页面 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 卡片行不超出容器 | row=313 越界格 无 | 无越界 | PASS |
| 长文本不画到卡片外 | 无泄漏 | 无泄漏 | PASS |
| 超长昵称被省略或换行 | truncate=false 行高=257 | true 或行高>44 | PASS |

## extreme@feed@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 超长昵称不撑破页面 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 卡片行不超出容器 | row=328 越界格 无 | 无越界 | PASS |
| 长文本不画到卡片外 | 无泄漏 | 无泄漏 | PASS |
| 超长昵称被省略或换行 | truncate=false 行高=133 | true 或行高>44 | PASS |

## keyboard@feed@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹出前搜索框点得到 | true | true | PASS |
| 外壳高度跟随 visualViewport | 380px shell=380 | 380px / ≤381 | PASS |
| 状态栏不被键盘盖住 | bottom=380 | ≤381 | PASS |
| 聚焦输入框在可视区内 | bottom=137 | ≤381 | PASS |
| 收起键盘恢复原高 | 100dvh shell=844 | dvh / 844 | PASS |
| 竖屏键盘下状态栏不清除 | sb.h=35 | ≥35 | PASS |
| 竖屏键盘下卡片仍堆叠 | 非标题格宽 94% 行宽 | ≥80% | PASS |

## keyboard@friends@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹出前搜索框点得到 | true | true | PASS |
| 外壳高度跟随 visualViewport | 380px shell=380 | 380px / ≤381 | PASS |
| 状态栏不被键盘盖住 | bottom=380 | ≤381 | PASS |
| 聚焦输入框在可视区内 | bottom=180 | ≤381 | PASS |
| 收起键盘恢复原高 | 100dvh shell=844 | dvh / 844 | PASS |

## kb-offset@120

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 顶栏落在可视区顶边（不被上卷顶出屏外） | topbar.top=120 vvTop=120 | ≈vvTop | PASS |
| 状态栏不越出可视区底边 | sb.bottom=500 可视底=500 | ≤可视底 | PASS |
| 内容区仍非零高 | main.h=301 | ≥100 | PASS |
| 收起键盘后位移归零 | shell.top=0 kb=null shift=none | top=0 无位移 | PASS |

## kb-offset@400

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 顶栏落在可视区顶边（不被上卷顶出屏外） | topbar.top=400 vvTop=400 | ≈vvTop | PASS |
| 状态栏不越出可视区底边 | sb.bottom=780 可视底=780 | ≤可视底 | PASS |
| 内容区仍非零高 | main.h=301 | ≥100 | PASS |
| 收起键盘后位移归零 | shell.top=0 kb=null shift=none | top=0 无位移 | PASS |

## kb-landscape@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 外壳跟随可视高 | appVh=170px vvH=170 | 170px | PASS |
| 顶栏与状态栏都在可视区内 | topbar=36 sb.bottom=0 可视=170 | sb.bottom≤vvH | PASS |
| 内容区未被压成 0 | main.h=134 | ≥60 | PASS |
| 顶栏压到 36（让位给结果） | topbar.h=36 | 36 | PASS |
| 状态栏让出高度 | sb.h=0 | 0 | PASS |
| 工具条只留搜索框 | toolbar.h=46 搜索框=36px | ≤48 且搜索框≥36 | PASS |
| 至少一张卡片完整可见 | 1/36 张完整（卡片 83px，可视 170） | ≥1 | PASS |
| 卡片压成两列（标题独占一行） | 首卡 3 行文本 | ≤4 行 | PASS |
| 结果列表可继续下滚 | scrollTop→400 | >0 | PASS |
| 抽屉在极矮可视区可滚到最后项 | n=21 client=170 scroll=1040 lastBottom=158 scrollerBottom=170 | 可滚且末项在容器内 | PASS |

## kb-landscape@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 外壳跟随可视高 | appVh=190px vvH=190 | 190px | PASS |
| 顶栏与状态栏都在可视区内 | topbar=36 sb.bottom=0 可视=190 | sb.bottom≤vvH | PASS |
| 内容区未被压成 0 | main.h=154 | ≥60 | PASS |
| 顶栏压到 36（让位给结果） | topbar.h=36 | 36 | PASS |
| 状态栏让出高度 | sb.h=0 | 0 | PASS |
| 工具条只留搜索框 | toolbar.h=46 搜索框=36px | ≤48 且搜索框≥36 | PASS |
| 至少一张卡片完整可见 | 1/36 张完整（卡片 83px，可视 190） | ≥1 | PASS |
| 卡片压成两列（标题独占一行） | 首卡 3 行文本 | ≤4 行 | PASS |
| 结果列表可继续下滚 | scrollTop→400 | >0 | PASS |
| 抽屉在极矮可视区可滚到最后项 | n=21 client=190 scroll=1040 lastBottom=178 scrollerBottom=190 | 可滚且末项在容器内 | PASS |

## keyboard@desktop@1440

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 桌面不跟随视觉视口缩矮 | 100dvh shell=900 | dvh / 900 | PASS |

## kb-search@friendlist@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 搜索框完整落在可视区且中心可点 | top=40 bottom=76 可视=170 命中=true | bottom≤可视 且 命中自己 | PASS |
| 至少一条结果完整可见 | 1/20 条（行 70px 首行 top=79） | ≥1 | PASS |

## kb-search@sessions@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 搜索框完整落在可视区且中心可点 | top=72 bottom=108 可视=170 命中=true | bottom≤可视 且 命中自己 | PASS |
| 至少一条结果完整可见 | 1/17 条（行 40px 首行 top=110） | ≥1 | PASS |

## kb-search@friendlist@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 搜索框完整落在可视区且中心可点 | top=40 bottom=76 可视=190 命中=true | bottom≤可视 且 命中自己 | PASS |
| 至少一条结果完整可见 | 1/20 条（行 70px 首行 top=79） | ≥1 | PASS |

## kb-search@sessions@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 搜索框完整落在可视区且中心可点 | top=72 bottom=108 可视=190 命中=true | bottom≤可视 且 命中自己 | PASS |
| 至少一条结果完整可见 | 2/17 条（行 40px 首行 top=110） | ≥1 | PASS |

## kb-matrix@friends@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=134 vv=170 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 5 块 完整=0 首块 100px top=108 露出=62 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@worlds@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=134 vv=170 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 5 块 完整=0 首块 110px top=84 露出=86 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@overview@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=134 vv=170 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 2 块 完整=0 首块 514px top=80 露出=90 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@search@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=134 vv=170 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 5 块 完整=0 首块 139px top=84 露出=86 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@feed@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=134 vv=170 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 36 块 完整=1 首块 83px top=82 露出=83 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@sessions@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=134 vv=170 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 17 块 完整=2 首块 40px top=72 露出=40 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@players@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=134 vv=170 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 1 块 完整=0 首块 167px top=40 露出=130 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@moderation@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=134 vv=170 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 1 块 完整=0 首块 126px top=85 露出=85 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@favorites@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=134 vv=170 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 4 块 完整=1 首块 53px top=112 露出=52 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@insights@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=134 vv=170 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 1 块 完整=0 首块 420px top=84 露出=86 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@friendlist@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=134 vv=170 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 20 块 完整=1 首块 70px top=79 露出=70 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@friendlog@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=134 vv=170 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 32 块 完整=1 首块 44px top=85 露出=44 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@gamelog@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=134 vv=170 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 7 块 完整=0 首块 1154px top=106 露出=64 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@settings@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=134 vv=170 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 2 块 完整=0 首块 123px top=107 露出=63 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@friends@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=154 vv=190 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 5 块 完整=1 首块 100px top=84 露出=100 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@worlds@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=154 vv=190 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 5 块 完整=0 首块 110px top=84 露出=106 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@overview@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=154 vv=190 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 2 块 完整=0 首块 514px top=80 露出=110 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@search@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=154 vv=190 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 5 块 完整=0 首块 139px top=84 露出=106 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@feed@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=154 vv=190 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 36 块 完整=1 首块 83px top=82 露出=83 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@sessions@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=154 vv=190 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 17 块 完整=3 首块 40px top=72 露出=40 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@players@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=154 vv=190 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 1 块 完整=0 首块 167px top=40 露出=150 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@moderation@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=154 vv=190 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 1 块 完整=0 首块 126px top=85 露出=105 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@favorites@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=154 vv=190 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 4 块 完整=1 首块 53px top=112 露出=52 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@insights@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=154 vv=190 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 1 块 完整=0 首块 420px top=84 露出=106 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@friendlist@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=154 vv=190 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 20 块 完整=1 首块 70px top=79 露出=70 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@friendlog@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=154 vv=190 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 32 块 完整=2 首块 44px top=85 露出=44 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@gamelog@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=154 vv=190 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 7 块 完整=0 首块 1154px top=106 露出=84 | 完整≥1 或 露出≥60 | PASS |

## kb-matrix@settings@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 键盘弹起（data-kb=1） | data-kb=1 | 1 | PASS |
| 主内容≥60 | main=154 vv=190 | ≥60 | PASS |
| 内容可用（完整一块 或 首块露出≥60） | 2 块 完整=0 首块 123px top=107 露出=83 | 完整≥1 或 露出≥60 | PASS |

## statusbar@320

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 最后一段不被裁 | 4 段 lastRight=304 barRight=320 gap=12px | lastRight≤barRight | PASS |
| 横向无不可滚溢出 | scrollW=320 clientW=320 | ≤client+1 | PASS |

## statusbar@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 最后一段不被裁 | 4 段 lastRight=304 barRight=360 gap=12px | lastRight≤barRight | PASS |
| 横向无不可滚溢出 | scrollW=360 clientW=360 | ≤client+1 | PASS |

## statusbar@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 最后一段不被裁 | 4 段 lastRight=304 barRight=390 gap=12px | lastRight≤barRight | PASS |
| 横向无不可滚溢出 | scrollW=390 clientW=390 | ≤client+1 | PASS |

## sessions-search@390x844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 默认按日无搜索框 | 输入框 0 | 0 | PASS |
| 搜索段出「搜索房间」框 | aria-label=搜索房间 | 存在 | PASS |
| 搜索框字号≥16 | 16px | ≥16px | PASS |
| 搜索框命中区≥36 | 36px | ≥36px | PASS |
| 搜索框中心可点 | 命中 input. | input | PASS |
| 输入即过滤（行数减少且全命中） | 17→6 行，未命中 0 | 减少且 0 未命中 | PASS |
| 键盘弹出外壳跟随可视高 | 380px | 380px | PASS |
| 键盘弹出输入框在可视区内 | 框 89-125 可视底=380 | bottom≤380 | PASS |
| 键盘弹出列表不越可视底 | 列表底=345 | ≤380 | PASS |
| 收起键盘恢复原高 | 100dvh shell=844 | dvh / 844 | PASS |

## sessions-search@360x800

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 默认按日无搜索框 | 输入框 0 | 0 | PASS |
| 搜索段出「搜索房间」框 | aria-label=搜索房间 | 存在 | PASS |
| 搜索框字号≥16 | 16px | ≥16px | PASS |
| 搜索框命中区≥36 | 36px | ≥36px | PASS |
| 搜索框中心可点 | 命中 input. | input | PASS |
| 输入即过滤（行数减少且全命中） | 17→6 行，未命中 0 | 减少且 0 未命中 | PASS |
| 键盘弹出外壳跟随可视高 | 380px | 380px | PASS |
| 键盘弹出输入框在可视区内 | 框 89-125 可视底=380 | bottom≤380 | PASS |
| 键盘弹出列表不越可视底 | 列表底=345 | ≤380 | PASS |
| 收起键盘恢复原高 | 100dvh shell=800 | dvh / 800 | PASS |

## sessions-search@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 默认按日无搜索框 | 输入框 0 | 0 | PASS |
| 搜索段出「搜索房间」框 | aria-label=搜索房间 | 存在 | PASS |
| 搜索框字号≥16 | 16px | ≥16px | PASS |
| 搜索框命中区≥36 | 36px | ≥36px | PASS |
| 搜索框中心可点 | 命中 input. | input | PASS |
| 输入即过滤（行数减少且全命中） | 17→6 行，未命中 0 | 减少且 0 未命中 | PASS |

## residue@friends@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| <36 控件只在降档白名单内 | 0 个越界 | 0 | PASS |
| 无 <32 控件 | 0 个 | 0 | PASS |
| 抽屉二级导航 40 档 | 40px | 40–43px | PASS |

## residue@worlds@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| <36 控件只在降档白名单内 | 0 个越界 | 0 | PASS |
| 无 <32 控件 | 0 个 | 0 | PASS |
| 抽屉二级导航 40 档 | 40px | 40–43px | PASS |
| 表头排序按钮 32 档 | 32px | 32–35px | PASS |

## residue@overview@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| <36 控件只在降档白名单内 | 0 个越界 | 0 | PASS |
| 无 <32 控件 | 0 个 | 0 | PASS |
| 抽屉二级导航 40 档 | 40px | 40–43px | PASS |

## residue@search@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| <36 控件只在降档白名单内 | 0 个越界 | 0 | PASS |
| 无 <32 控件 | 0 个 | 0 | PASS |
| 抽屉二级导航 40 档 | 40px | 40–43px | PASS |

## residue@feed@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| <36 控件只在降档白名单内 | 0 个越界 | 0 | PASS |
| 无 <32 控件 | 0 个 | 0 | PASS |
| 抽屉二级导航 40 档 | 40px | 40–43px | PASS |
| 表格行内目标 32 档 | 32px | ≥32px | PASS |

## residue@sessions@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| <36 控件只在降档白名单内 | 0 个越界 | 0 | PASS |
| 无 <32 控件 | 0 个 | 0 | PASS |
| 抽屉二级导航 40 档 | 40px | 40–43px | PASS |

## residue@players@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| <36 控件只在降档白名单内 | 0 个越界 | 0 | PASS |
| 无 <32 控件 | 0 个 | 0 | PASS |
| 抽屉二级导航 40 档 | 40px | 40–43px | PASS |

## residue@moderation@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| <36 控件只在降档白名单内 | 0 个越界 | 0 | PASS |
| 无 <32 控件 | 0 个 | 0 | PASS |
| 抽屉二级导航 40 档 | 40px | 40–43px | PASS |

## residue@favorites@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| <36 控件只在降档白名单内 | 0 个越界 | 0 | PASS |
| 无 <32 控件 | 0 个 | 0 | PASS |
| 抽屉二级导航 40 档 | 40px | 40–43px | PASS |

## residue@insights@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| <36 控件只在降档白名单内 | 0 个越界 | 0 | PASS |
| 无 <32 控件 | 0 个 | 0 | PASS |
| 抽屉二级导航 40 档 | 40px | 40–43px | PASS |

## residue@friendlist@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| <36 控件只在降档白名单内 | 0 个越界 | 0 | PASS |
| 无 <32 控件 | 0 个 | 0 | PASS |
| 抽屉二级导航 40 档 | 40px | 40–43px | PASS |

## residue@friendlog@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| <36 控件只在降档白名单内 | 0 个越界 | 0 | PASS |
| 无 <32 控件 | 0 个 | 0 | PASS |
| 抽屉二级导航 40 档 | 40px | 40–43px | PASS |
| 表格行内目标 32 档 | 36px | ≥32px | PASS |

## residue@gamelog@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| <36 控件只在降档白名单内 | 0 个越界 | 0 | PASS |
| 无 <32 控件 | 0 个 | 0 | PASS |
| 抽屉二级导航 40 档 | 40px | 40–43px | PASS |

## residue@settings@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| <36 控件只在降档白名单内 | 0 个越界 | 0 | PASS |
| 无 <32 控件 | 0 个 | 0 | PASS |
| 抽屉二级导航 40 档 | 40px | 40–43px | PASS |

## setnav@390x844

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 子导航 10 项齐 | 10 项 | 10 | PASS |
| 子导航条目命中区≥44 | 44px | ≥44px | PASS |
| 滚到底末项（反馈）回到容器内 | auto scrollTop=0 lastBottom=510 navBottom=809 | lastBottom≤navBottom | PASS |
| 末项中心可点 | 命中 反馈 | 反馈 | PASS |

## setnav@360x800

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 子导航 10 项齐 | 10 项 | 10 | PASS |
| 子导航条目命中区≥44 | 44px | ≥44px | PASS |
| 滚到底末项（反馈）回到容器内 | auto scrollTop=0 lastBottom=510 navBottom=765 | lastBottom≤navBottom | PASS |
| 末项中心可点 | 命中 反馈 | 反馈 | PASS |

## setnav@844x390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 子导航 10 项齐 | 10 项 | 10 | PASS |
| 子导航条目命中区≥44 | 44px | ≥44px | PASS |
| 滚到底末项（反馈）回到容器内 | auto scrollTop=165 lastBottom=345 navBottom=355 | lastBottom≤navBottom | PASS |
| 末项中心可点 | 命中 反馈 | 反馈 | PASS |

## setnav@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 子导航 10 项齐 | 10 项 | 10 | PASS |
| 子导航条目命中区≥44 | 44px | ≥44px | PASS |
| 滚到底末项（反馈）回到容器内 | auto scrollTop=125 lastBottom=385 navBottom=395 | lastBottom≤navBottom | PASS |
| 末项中心可点 | 命中 反馈 | 反馈 | PASS |

## setnav@844x390+kb220

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 子导航 10 项齐 | 10 项 | 10 | PASS |
| 子导航条目命中区≥44 | 44px | ≥44px | PASS |
| 滚到底末项（反馈）回到容器内 | auto scrollTop=330 lastBottom=166 navBottom=170 | lastBottom≤navBottom | PASS |
| 末项中心可点 | 命中 反馈 | 反馈 | PASS |
