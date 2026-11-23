# 移动端验收基线（自动生成，勿手改）

生成：2026-11-23 21:49:04 · 断言 932/932 PASS · 页面 13 × 视口 10

移动形态判据：宽 ≤1023 或高 ≤500（styles.css / tailwind md raw / Sidebar matchMedia 三处一致）。
重新生成：`node scripts/mobile_parity.mjs`（脚本末尾自动写回本文件）。

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

## overview@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 360px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## overview@375

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=375 vw=375 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 375px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## overview@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=390 vw=390 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| chip 命中区≥36 | n/a | ≥36px | PASS |
| 表单控件≥36 | n/a | ≥36px | PASS |
| 行内/表格目标≥32 | 32px 概览(32) 旅程(32) 全部(32) | ≥32px | PASS |
| 表单控件中心可点（未被遮挡） | 0 处遮挡 | 0 | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 390px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## overview@414

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=414 vw=414 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 414px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## overview@430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=430 vw=430 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 430px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## overview@844

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

## overview@932

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

## overview@768

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=768 vw=768 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 768px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## overview@820

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=820 vw=820 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 820px | >0 | PASS |
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
| 行内/表格目标≥32 | 32px ▤(32) ▦(32) Alice(32) | ≥32px | PASS |
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

## settings@360

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=360 vw=360 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 360px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## settings@375

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=375 vw=375 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 375px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## settings@390

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=390 vw=390 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| chip 命中区≥36 | 36px 设置快捷键(36) 设置密码(36) 设置延迟（分钟）(36) | ≥36px | PASS |
| 表单控件≥36 | 36px (36) | ≥36px | PASS |
| 行内/表格目标≥32 | 32px 系统(32) 界面(32) 社交(32) | ≥32px | PASS |
| 表单控件中心可点（未被遮挡） | 0 处遮挡 | 0 | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 390px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## settings@414

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=414 vw=414 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 414px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## settings@430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=430 vw=430 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 430px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## settings@844

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

## settings@932

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

## settings@768

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=768 vw=768 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
| 最小字号≥11 | 11px | ≥11px | PASS |
| 内容区非零宽 | 768px | >0 | PASS |
| 侧栏默认收起 | left=-214 | <0 | PASS |

## settings@820

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 无横向溢出 | scrollW=820 vw=820 | ≤vw+1 | PASS |
| 表格卡片化(n/a 无表格) | thead=null tr=null | thead=none tr=flex | PASS |
| 触控目标≥32 | 32px | ≥32px | PASS |
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
| 30 次深滚 ≤300ms | 1ms（20 行） | ≤300ms | PASS |

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
| 聚焦输入框在可视区内 | bottom=135 | ≤381 | PASS |
| 收起键盘恢复原高 | 100dvh shell=844 | dvh / 844 | PASS |

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
| 顶栏与状态栏都在可视区内 | topbar=44 sb.bottom=170 可视=170 | sb.bottom≤vvH | PASS |
| 内容区未被压成 0 | main.h=91 | ≥60 | PASS |
| 抽屉在极矮可视区可滚到最后项 | n=21 client=170 scroll=1040 lastBottom=158 scrollerBottom=170 | 可滚且末项在容器内 | PASS |

## kb-landscape@932x430

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 外壳跟随可视高 | appVh=190px vvH=190 | 190px | PASS |
| 顶栏与状态栏都在可视区内 | topbar=44 sb.bottom=190 可视=190 | sb.bottom≤vvH | PASS |
| 内容区未被压成 0 | main.h=111 | ≥60 | PASS |
| 抽屉在极矮可视区可滚到最后项 | n=21 client=190 scroll=1040 lastBottom=178 scrollerBottom=190 | 可滚且末项在容器内 | PASS |

## keyboard@desktop@1440

| 断言 | 实测 | 期望 | 结果 |
| --- | --- | --- | --- |
| 桌面不跟随视觉视口缩矮 | 100dvh shell=900 | dvh / 900 | PASS |

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
