# 内容品类契约 — 交互 → 行动清单

每个 flipbook 必须归属一个**具体场景**。分析时先判断品类，再选交互 widget 与 `meta.actionList.category`。
**清单永远由交互编译**，不在 JSON 里写死 `items[]`。

> 产品总表见 `huozhong/PRODUCT.md` §7.2。运行时见 `assets/action_list.js` + 各品类模块。

## 品类速查

| category | 典型视频 | 网页交互（必须有点选） | 清单产出 | 主要 widget / 模块 |
|----------|----------|------------------------|----------|-------------------|
| `travel` | 旅行攻略、区域划分 | 想去的站、美食/住宿/游玩勾选、行李、行程风格 | 行李 + 预订/打卡待办 | `travel_planner.js` + `theme: travel` |
| `recipe` | 菜谱、咖啡、烘焙 | 人数、「我已有」食材 | 采购清单（剔除已有） | `overview.widget.type: "recipe"` |
| `fitness` | 健身跟练、训练计划 | 目标部位、天数、器械条件 | 训练计划（组数/动作） | `stepper` + 自定义收集器 |
| `beauty` | 美妆、穿搭教程 | 妆容/场合、已有单品 | 练习目标 + 购买清单 | `stepper` / `checklist` body + 收集器 |
| `study` | 课程、知识讲解 | 要掌握的模块、基础水平 | 学习清单 / 知识点目标 | `stepper` / `timeline` + 勾选模块 |
| `interview` | 访谈、观点类 | 共鸣/分歧立场勾选 | 可执行的人生建议行动项 | `body` tips + 立场勾选 UI |
| `general` | 建筑、艺术、其他 | 必须有明确点选（勾选步骤/选项） | 与场景匹配的可执行项 | 按域选 widget |

## 分析时必须写的 meta

```jsonc
{
  "meta": {
    "task": "用户此刻要解决的问题（多源强烈建议；单源写在 subtitle 也行）",
    "actionList": {
      "category": "travel | recipe | fitness | beauty | study | interview | general",
      "titleHint": "行李与待办清单 | 采购清单 | 训练计划 | …",
      "compileFrom": "user-selection"
    }
  }
}
```

## 各品类细则

### travel（旅行）

> 完整契约：`travel.md`

- `meta.theme: "travel"`；每站卡片：`food[]` / `stay[]` / `play[]` / `packing[]` + comic `image` + `note`
- 交互：勾选站/项 →「生成我的攻略」→ 攻略页底「生成行李/待办」→ `__huozhongUnlockActionList`
- 示例：`examples/data_bali.json`

### recipe（美食 / 菜谱）

- `meta.actionList.category: "recipe"`；`theme` 常用 `building`
- `overview.widget` 或卡片级 `widget.type: "recipe"`：
  - `baseServings`、`ingredients[{name, qty, unit}]`
  - 用户调人数 → 用量等比缩放；勾选「我已有」→ 从采购剔除
- 首页按钮「生成采购清单」调用 `__huozhongUnlockActionList`（模板内置收集器）
- 示例：`examples/data_coffee.json`

### fitness（健身）

- `meta.actionList.category: "fitness"`
- 用 `stepper` widget 呈现动作步骤；卡片 `body` 加 `checklist` 或自定义勾选（器械/天数）
- **必须**注册交互收集器（若模板无内置）：

```js
window.__huozhongInteractionCollectors = window.__huozhongInteractionCollectors || [];
window.__huozhongInteractionCollectors.push(function () {
  // 读取用户勾选的部位、组数、器械…
  // 不足时 return null
  return {
    title: "本周训练计划",
    subtitle: "胸+三头 · 居家哑铃",
    category: "fitness",
    personalized: true,
    items: [{ text: "俯卧撑 3×12", tag: "训练" }, …]
  };
});
```

- CTA 文案示例：「生成我的训练计划」→ 再解锁行动清单

### beauty（美妆 / 穿搭）

- `meta.actionList.category: "beauty"`
- 卡片按步骤组织（底妆 / 眼妆 / 单品搭配）；`body.checklist` 列商品，用户勾选「已有」
- 清单 = **练习顺序**（今晚练哪几步）+ **购买清单**（缺什么）
- 不同场合（通勤 / 约会）切换应改变清单条目

### study（课程 / 学习）

- `meta.actionList.category: "study"`
- `timeline` 或 `stepper` 呈现知识模块；用户勾选「本期要掌握」
- 清单 = 学习顺序 + 自测/练习项（「做完第三章习题」而非「再看视频」）

### interview（访谈 / 观点）

- `meta.actionList.category: "interview"` 或 `general`
- 卡片呈现观点对比；用户勾选「共鸣 / 存疑 / 要试」
- 清单 = **可执行的人生/工作建议**（「本周约一次 1:1」「试 30 分钟无手机晨读」）
- 多源 Mode B 时：冲突观点必须在 `body.tips` 或对比块 surfaced，不静默站队

### general（其他）

- 当以上品类都不_fit 时用 `general`，但仍须：
  1. 明确 `meta.task`
  2. 至少一种点选 UI（`stepper` / `checklist` / 自定义）
  3. 收集器产出与场景匹配的可执行项

## 解锁行动清单（所有品类通用）

1. 业务模块 `push` 收集器到 `window.__huozhongInteractionCollectors`
2. 用户完成关键交互后：`window.__huozhongUnlockActionList(list, { open: true })`
3. `action_list.js` 始终注入；默认 FAB 灰色，**不可**存/印，直到解锁

详见 `action-list.md`。

## 验收要点（每品类）

- [ ] 进入页时**没有**成品清单（或仅品类提示文案）
- [ ] 未完成点选时「存入 App / 打印」disabled
- [ ] 改勾选后重新打开清单，条目变化
- [ ] 清单条目可在线下执行（非「再看视频」）
- [ ] `meta.actionList.compileFrom === "user-selection"`
