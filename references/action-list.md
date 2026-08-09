# Action List（行动清单）— 交互后才生成

> 产品原则见 `huozhong/PRODUCT.md` §7 与 `references/product.md`。

行动清单不是页头写死的静态待办，而是：

```
视频 → 交互网页（完整交互设计）
    → 用户点选
    → 个性化方案（攻略 / 采购 / 训练计划…）
    → 编译行动清单
    → 存 App / 打印小票
    → 现实一项项打勾
```

AI/网页负责把别人的经验整理成「适合我」的可执行项；练习、采购、出行本身仍由用户完成。

**改选择 → 清单条目跟着变。** 不同品类、不同画像（亲子游 ≠ 打卡游）→ 不同清单。

## 品类 → 清单形态

| 品类 | 用户在网页里点选什么 | 清单产出 |
|------|----------------------|----------|
| 旅行 | 想去的站、住宿、美食、行李项、行程风格（亲子/打卡…） | **行李 + 预订/打卡待办** |
| 美食/菜谱 | 人数、「我已有」食材 | **采购清单**（剔除已有） |
| 健身 | 部位、器械、时长 | **训练计划**（几组怎么练） |
| 美妆/穿搭 | 妆容步骤、已有单品 | **练习目标 + 购买清单** |
| 课程 | 要掌握的知识点 | **学习清单** |
| 访谈观点 | 共鸣/分歧标记 | **人生建议行动项**（可线下执行，非「再看视频」） |

品类细则与 widget 选型见 `content-categories.md`。

## 运行时契约（必须）

1. 业务模块（如 `travel_planner.js`）把勾选状态收成收集器：
   `window.__huozhongInteractionCollectors.push(fn)`  
   `fn()` 返回 `{ title, subtitle, category, personalized:true, items:[{text,tag}] }` 或 `null`（交互不足）。

2. 用户完成关键交互后（旅行：「生成我的攻略」页底 CTA），调用：
   `window.__huozhongUnlockActionList(list, { open:true })`  
   解锁「行动清单」并允许 **存入 App / 打印小票**。

3. `assets/action_list.js` **始终注入**，但默认不展示写死清单；优先读交互收集器。

## JSON 里写什么（给作者/Agent）

`meta.actionList` **不要**再写满最终 items 当成品。可写**品类提示**：

```jsonc
{
  "meta": {
    "actionList": {
      "category": "travel",
      "titleHint": "行李与待办清单",
      "compileFrom": "user-selection"   // 标明：交互后编译
    }
  }
}
```

最终 items 由运行时根据勾选生成。若无交互模块，页面应提供明确点选 UI，而不是静默塞静态列表。

## 打印小票

- 浏览器：`action_list.js` 内 `@media print` 窄条样式（热敏小票视觉）
- 嵌入 App：`postMessage` `action: "print"`，宿主可接 ESC/POS（产品侧 `js/print/printer.js`）
- 目的：装袋、买菜、开练 —— **钉进现实**，不是存档了事

## postMessage（嵌入 App）

```jsonc
{
  "type": "huozhong:action-list",
  "action": "save" | "print",
  "payload": {
    "title": "巴厘岛 · 行李与待办清单",
    "subtitle": "5天4晚 · 3站 · 根据你勾选生成",
    "category": "travel",
    "personalized": true,
    "items": [{ "text":"装箱：防晒霜（海边日晒强）", "tag":"行李", "done": false }]
  }
}
```

## 旅行页验收（巴厘岛）

1. 进入页时：**没有**可打印的成品清单（或点开提示先勾选）。
2. 勾选「想去此地」/住宿/行李 →「生成我的攻略」。
3. 攻略页底部出现 **「生成我的行李 / 待办清单」**。
4. 点开后的条目随勾选变化（取消某站，该站行李/预订消失）。
5. 可 **存入 App 行动库** 或 **打印小票** 打勾。

## 反模式

- ❌ 一进页就用静态 `items[]` 当行动清单
- ❌ 清单与用户勾选无关（亲子游和打卡游却同一份行李）
- ❌ 只有「再看一遍视频」这类伪行动
- ❌ 打印按钮不带个性化结果
