---
name: video-to-flipbook
description: >-
  火种（Huozhong）核心 Skill：把视频 / 灵感片段变成可交互网页应用（flipbook），
  支撑「我看到，我做到」—— 理解 → 个性化决策 → 编译行动清单。两种输入同一输出：
  (1) Mode A 单视频/单片段；(2) Mode B 灵感库多选 ≥2 独立来源，去重综合。
  品类：旅行、菜谱、健身、美妆、学习、访谈观点等（见 content-categories.md）。
  桌面图解 + 移动左图右文；旅行含 food/stay/play/packing、💰/🧳、「生成我的攻略」；
  菜谱含人数/「我已有」→ 采购清单。行动清单必须交互后才解锁（存 App / 打印小票）。
  单文件 HTML，可 ?embed=1 嵌入 App。勿用于纯幻灯片、逐字稿、静态图表或视频摘要墙。
---

# 火种 · Video → Interactive Application Page

把视频内容变成 **数据驱动的交互网页应用**（不是摘要帖、不是视频列表）。
读者进入手绘总览，点击光点 **电影感推近**，展开详情场景；按品类提供点选 widget，
用户完成个性化后 **编译行动清单**（存 App / 打印小票）。

> **产品 SSOT：** `huozhong/PRODUCT.md`  
> **Skill 产品契约：** `references/product.md`  
> **品类 → 交互 → 清单：** `references/content-categories.md`

## 产品角色

本 Skill 实现火种 **B 层（多源综合 → 交互应用）**，并覆盖 A 层「单条成页」形态：

```
刷信息流 / 带着问题来
    → 圈选灵感片段（起止 / 整条 / 其余 TLDR）→ 灵感库多选
    → 本 Skill：analyze → 一个交互网页
    → 用户点选个性化
    → 行动清单（运行时编译，非 JSON 写死）
    → 宿主 App 行动库 / 打印
```

**分工：** AI（本 Skill）负责整理、去重、个性化、生成清单；人负责练、买、走、做。

**两种输入，一种输出：** `out_<name>.html`（桌面图解 + 移动/APP 左图右文）。仅 **analyze** 步骤不同。

## 每个网页必须满足

1. **具体场景 + 问题** —— `meta.task`（多源）或清晰的 `meta.subtitle`（单源）
2. **网页完成理解 + 决策** —— 图解、点选、计算器、对比块；不是 bullet 摘要
3. **清单是交互编译物** —— `meta.actionList.compileFrom: "user-selection"`；禁止预置 `items[]`
4. **可嵌入宿主 App** —— `?embed=1`；行动清单 `postMessage` 见 `action-list.md`

## 签名交互（做错就只是卡片站）

1. **点击推近** —— hotspot 缩放/zoom 进总览该点，再交棒详情；是镜头移动，不是切页。（勿加假行人/精灵动画。）

2. **详情随视口变**（`assets/flipbook_template.html` 内置）：

   | 视口 | 详情呈现 |
   |------|----------|
   | **宽 (>860px)** | 图解：插画居中 + 两侧标注卡 + 虚线引线 |
   | **窄 (≤860px) / APP** | **左图（无叠层）+ 右「相关介绍」** —— 来自 `annotations`（或 `meta`/`desc` 兜底） |

   移动端 **不要** 自造第三布局（图上编号钉、图下堆卡等）。写好 `annotations[].t` / `.d`。

3. **光点在插画上** —— `x`/`y` 相对 `#mapStage` 图片盒，非整画布。Facts 宽屏侧边、窄屏 **图下**，不遮画。

## 输入层 — 两种模式

```
┌─ Mode A: 单视频输入 ─────────────────────────────────────┐
│  1 条视频  OR  1 个用户圈选片段 (+ 可选其余 TLDR)          │
└──────────────────────────┬────────────────────────────────┘
                           ▼  analyze → data_<name>.json
┌─ Mode B: 多视频梳理 ─────────────────────────────────────┐
│  N 个灵感片段 (≥2 独立父视频)                             │
│  各含：整条 | 起止 | 用户 note | 可选 rest-TLDR           │
└──────────────────────────┬────────────────────────────────┘
                           ▼
         art → build → out_<name>.html → verify
```

| | **Mode A · 单视频** | **Mode B · 多视频梳理** |
|--|---------------------|------------------------|
| 触发 | 收一条视频 / 圈一段成页 | 灵感库多选 →「生成方案」 |
| 输入 | 1 `source` (+ 可选 `clip`) | `sources[]`（见 `multi-video.md`） |
| 分析 | 结构化 **本条** 线性内容 | 去重 · 共识/冲突/互补 → **一个** 任务形页面 |
| `meta.inputMode` | `"single"` | `"multi"` |
| 输出 | 同一 flipbook JSON → 同一 HTML 模板 | 同一 |

设 `meta.inputMode`；A 填 `meta.sourceVideo`，B 填 `meta.sources[]`。
卡片保留 `clip` / `sourceId`，主张可回溯到原片时间段。

## 内容品类（分析前先判断）

> 完整表：`references/content-categories.md`

| category | 网页里点什么 | 清单产出 |
|----------|-------------|----------|
| `travel` | 站点、美食/住宿/游玩、行李、风格 | 行李 + 预订待办 |
| `recipe` | 人数、「我已有」食材 | 采购清单 |
| `fitness` | 部位、天数、器械 | 训练计划 |
| `beauty` | 妆容步骤、已有单品 | 练习 + 购买 |
| `study` | 要掌握的模块 | 学习清单 |
| `interview` | 共鸣/分歧立场 | 可执行建议项 |

写 `meta.actionList.category` + `titleHint` + `compileFrom: "user-selection"`。
**行动清单必须在用户点选之后生成** —— `assets/action_list.js` 始终注入，默认不解锁。

## 流水线

```
[Mode A 视频 | Mode B 片段] → [analyze] → data_<name>.json
      → [art recipe] → images → [build] → out_<name>.html → [verify]
```

数据驱动：内容全在 JSON；通用模板渲染。几乎不改模板 —— 产出好 JSON 和好图。

### Step 1 — Analyze → `data_<name>.json`

按 `references/schema.md` 编写。

**两种模式** 同一页面形状：

- 利落 **overview**（标题、副标题、facts、一张总览插画）
- 2–6 **cards**，`x`/`y` 热点 %
- 每卡 `annotations`（3–5 条，`t`/`d`；桌面加 `ax`/`ay`/`side`）
- 域适配 `body` + `widget`
- `theme`: `travel | building | art | dark`

#### Mode A — 单视频

1. 一条 URL/文件，或用户范围 `clip.start`–`clip.end`
2. 「其余 TLDR」→ `meta.sourceVideo.restTldr`；**不要** 把未选段扩成卡片
3. 「值得从头看到尾」→ `scope: "full-video"`
4. 节拍 → cards；时间戳 → `cards[].clip`
5. `meta.inputMode: "single"`

真视频 → `scripts/extract_frames.py`（PyAV）抽帧；`realPhotos` 仅详情画廊。

参考 `examples/`（yingxian / coffee / bali）。`bali` = 旅行全契约；`coffee` = 菜谱全契约。

#### Mode B — 多视频

> **`references/multi-video.md`**

1. **≥2 独立父视频**（同源多段算一个来源）
2. 每段：父 id、标题、`full` 或 `start`–`end`、note、可选 `restTldr`
3. 仅在范围内深挖（用户圈选证据）
4. 跨源：去重、共识/冲突/互补/条件/缺口 —— 只保留 **改变页面** 的关系
5. 编译为 overview + cards（非摘要堆砌）
6. 重要主张带 `sourceId` + `clip`
7. `meta.inputMode: "multi"`；`meta.task` 写清用户要解决的问题

旅行类另遵 `travel.md`；菜谱类用 `recipe` widget（见 `content-categories.md`）。

### Step 2 — 插画（两阶段握手）

仅通过 **Agent 图像工具**（脚本禁止直连模型网关）：

1. 空 `image` + `imagePrompt`（只写主体；风格由 `art_recipe` 追加）
2. `python3 scripts/build.py --auto data_<name>.json` → `<name>_prompts.json` 暂停
3. 生成图 → `<name>_images.json` 为 `{key: url}`
4. 再跑 `--auto` → 回填、构建、清理

画风：手绘墨线 + 水彩，**VERSO Cold Luxury**（海军蓝 + 银雾纸，非暖黄莫兰迪），**图中零文字**。

旅行：另生成 food/stay/play 分项漫画图（勿用视频帧当槽位图）。

### Step 3 — Build

```bash
PYTHONPATH=<skill>/scripts python3 <skill>/scripts/build.py data_<name>.json
PYTHONPATH=<skill>/scripts python3 <skill>/scripts/build.py --all
```

`data_*.json` 放 **可写** 目录（skill 安装路径可能只读）。
输出：同目录 `out_<name>.html`。旅行 `media/<name>/…png` 与 HTML 相对路径并存。

### Step 4 — 目视验证

`references/verification.md`。必验 **宽 + 窄**：

1. **桌面** —— 热点对齐地图；详情图解（标注 + 引线）
2. **移动 (~390×844)** —— 首页 facts 在图下；详情 **左图 + 右介绍**
3. **行动清单** —— 进页无成品清单；交互后解锁存/印
4. **品类** —— 旅行走 `travel.md` §4；菜谱走人数/我已有 → 采购

APP 内嵌用 `?embed=1`。

## APP / WebView 嵌入

- `?embed=1` 或 iframe → `body.embed`（藏顶栏；宿主提供返回）
- `100dvh`、`viewport-fit=cover`、safe-area
- 交付路径示例：`…/out_<name>.html?embed=1`

## 藏书阁封面（知识卡片）

Flipbook 以知识卡片进 APP 藏书阁，须与 VERSO Cold Luxury 同框：

- 纸底/UI：海军 `#1f3a4a` + 银雾 `#eef3f8`（禁米黄 `#f6f1e6` / 暖奶油 / 紫粉莫兰迪）
- 封面插画：冷雾纸 + 海军墨线；题材色可偏冷
- 无封面时 `thumbGrad`：`linear-gradient(160deg,#a8c4d4,#3d5a70)`
- UI 无衬线；圆角约 18–22px

## 产品反模式（禁止）

- ❌ 输出视频摘要墙 / 搜索式一堆链接（应是 **一个应用**）
- ❌ JSON 或页头预置写死行李/采购/待办 `items[]`
- ❌ 一进页就能打印成品清单
- ❌ 多源只是 N 段文字拼接（须去重 + 关系改变结构）
- ❌ 清单与勾选无关（亲子游 vs 打卡游同一份）
- ❌ 伪行动项（「再看一遍视频」）
- ❌ 移动端图上叠标注钉 / 图下堆卡
- ❌ 旅行攻略日列表不分 tab 堆叠

## 旅行攻略 (`theme: "travel"`) — 强制

> **`references/travel.md`**

旅行攻略 / 区域划分 / 自由行 → `meta.theme: "travel"`，每站卡片：

1. **美食** `food[]` — `budget` + comic `image` + `note`
2. **住宿** `stay[]` — `budget`/晚 + `nights` + comic `image` + `note`
3. **游玩** `play[]` — `budget` + comic `image` + `note`
4. **行李** `packing[]` — `{name, note}`（+ 可选 comic `image`）
5. **想去此地** — `goDefault` + 勾选
6. `daysSuggest`（+ `routeOrder`）
7. **实拍** `realPhotos[]` — 仅详情画廊
8. 优先 **`overview.routeImage`** — 路线画进插画

详情行：勾选 · 缩略图 · 名称(+预算) · 小字 `note`。

### 运行时 (`assets/travel_planner.js`)

- **💰** 实时合计 · **🧳** 插画行李箱（勾选飞入/飞出）
- **生成我的攻略** 底栏 CTA → 攻略页底编译行李/待办 → 解锁行动清单
- 攻略：封面统计 · 路线图 · **Day tabs 一次一天** · 上午/下午/晚上槽位 + comic 图（图注在图下）
- 禁：首页「规划我的路线」与「生成我的攻略」并存 · 视频帧当槽位图 ·「今日图鉴」冗余网格

不要交付只有 prose 没有 food/stay/play/packing/预算/`note`/分项漫画图的旅行页。

## 安全约束

- **禁止** 在生成代码/脚本里 HTTP 调 LLM 或图像网关
- **禁止** 起网络监听进程预览 flipbook —— 用 `verification.md` 上传+浏览器工具
- 保留 `[ph_..._ph]` 占位符字节不变

## 交付

上传/分享 `out_<name>.html`；注明桌面/移动行为。旅行另附 `media/` 漫画资源。
多文件时逐条一行说明。

##  bundled 资源

| 路径 | 用途 |
|------|------|
| `scripts/build.py` | 校验 → 握手 → 注入 → 构建 |
| `scripts/art_recipe.py` | 画风 + prompt 收集 |
| `scripts/extract_frames.py` | PyAV 均匀抽帧 |
| `assets/flipbook_template.html` | 渲染器（图解 + 双栏 + embed + travel CSS） |
| `assets/travel_planner.js` | 旅行预算/行李/分 tab 漫画攻略 |
| `assets/action_list.js` | 行动清单 FAB（始终注入） |
| `examples/data_{yingxian,coffee,bali}.json` | 范例（bali=旅行，coffee=菜谱） |
| `references/product.md` | 火种产品契约（Skill 视角） |
| `references/content-categories.md` | 品类 → 交互 → 清单 |
| `references/schema.md` | 数据契约 |
| `references/multi-video.md` | Mode B |
| `references/action-list.md` | 行动清单 |
| `references/travel.md` | 旅行契约 |
| `references/verification.md` | 宽/窄/旅行/多源/清单验收 |
