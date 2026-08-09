# Multi-video input (Mode B) — 灵感片段 → 一页交互应用

Mode B feeds the **same** flipbook schema as Mode A. The difference is only in
**analyze**: several user-saved inspiration clips become one task-shaped page.

> **产品 SSOT：** `huozhong/PRODUCT.md` §5–6。Skill 摘要：`references/product.md`。

产品路径：

```
刷信息流 / 带着问题来
    → 圈选灵感片段（起止 / 整条 / 其余 TLDR）→ 存入灵感库
    → 多选 ≥2 独立来源
    → 本 Skill 综合成一个交互网页（去重 + 共识/冲突/互补）
    → 用户点选 → 行动清单
```

**反模式：** 搜索扔回一堆视频 · 综合页预塞静态待办 · N 段摘要拼接（见 `product.md`）。

宿主 App 负责灵感库 UI；本 Skill 负责 synthesis → `data_*.json` → HTML。

## When to use Mode B

Use Mode B when the user (or host APP) provides **2+ inspiration clips** that
should become **one** actionable page — not N separate flipbooks.

Examples:

- Karpathy talk kept **full**; Altman talk only **20:21–31:52** (rest TLDR) →
  one「AI 应用方向学习路径」page.
- Two Bali vlog clips (different creators, different ranges) → one travel
  flipbook (`theme: travel`, still follow `travel.md`).

If there is only one parent video / one clip → use **Mode A**.

## Input contract (analyze-time)

Host APP / agent should pass a list shaped like:

```jsonc
{
  "task": "可选。用户此刻想做成什么，如：暑假亲子游巴厘岛行李与行程",
  "clips": [
    {
      "sourceId": "v_karpathy_2025",
      "title": "Karpathy — Deep Dive",
      "url": "https://…",
      "author": "…",
      "scope": "full-video",          // or "selected-clips"
      "ranges": [],                   // empty when full-video
      "note": "值得从头看到尾，不跳",
      "restTldr": null
    },
    {
      "sourceId": "v_altman_keynote",
      "title": "Sam Altman keynote",
      "url": "https://…",
      "author": "…",
      "scope": "selected-clips",
      "ranges": [{"start": "20:21", "end": "31:52"}],
      "note": "只看这段：OpenAI 未来应用方向",
      "restTldr": "开场客套 + 财报复述可跳过；Q&A 后半重复官网已有信息"
    }
  ]
}
```

Rules:

| Rule | Meaning |
|------|---------|
| ≥2 independent parents | Different `sourceId` / parent videos. Clips from the **same** parent share one identity — they do **not** satisfy the multi-source bar alone |
| Honor ranges | Only deep-analyze inside `ranges` (or full when `full-video`). Never treat a partial clip as the whole video |
| Honor notes | User note steers emphasis; do not invent a different task |
| Rest TLDR | Summarize unselected spans briefly; do **not** promote them into hotspots/cards |
| Traceability | Every important claim maps to `sourceId` + time range |

## Analyze pipeline (Mode B)

```
clips[]  →  per-clip evidence (within range)
         →  cross-source relations (dedupe / consensus / conflict / complement / gap)
         →  compile flipbook JSON (overview + cards + widgets)
         →  same art / build / verify as Mode A
```

### 1. Per-clip understanding

For each clip, extract only what the selected span supports:

- Beats, entities, actionable steps, conditions, warnings
- Keep timestamps relative to the **parent** video
- Attach `sourceId` to every atom

### 2. Cross-source mesh (must change the page)

Do **not** concatenate N video summaries.

| Relation | What to do on the page |
|----------|------------------------|
| Duplicate | Keep once; prefer clearer clip as evidence |
| Consensus | Strengthen a card / fact; cite ≥2 sources |
| Conflict | Surface in `body` tips or a comparison block; do not silently pick a winner |
| Complement | Merge into one richer card (e.g. A gives map, B gives packing) |
| Gap | Ask / note uncertainty in `meta.keyFinding` or a tips block — do not invent |

A relation only counts if it changes **content, order, conditions, alternatives,
risks, or uncertainty**. If one clip alone would yield the same page, you have
not done multi-video work — tighten the task or refuse with an honest single-source
fallback (`inputMode: "single"` + note).

### 3. Compile to flipbook JSON

Emit the **normal** schema (`meta` + `overview` + `cards`). Additionally set:

```jsonc
{
  "meta": {
    "inputMode": "multi",
    "task": "用户任务一句话",
    "keyFinding": "多源之后才成立的关键结论（可空）",
    "sources": [
      {
        "sourceId": "v_altman_keynote",
        "title": "Sam Altman keynote",
        "url": "https://…",
        "author": "…",
        "scope": "selected-clips",
        "ranges": [{"start": "20:21", "end": "31:52"}],
        "note": "只看这段：OpenAI 未来应用方向",
        "restTldr": "…"
      }
    ],
    "relations": [
      {
        "type": "complement",           // consensus | conflict | complement | condition | gap
        "summary": "A 讲方向，B 给落地练习顺序",
        "sourceIds": ["v_karpathy_2025", "v_altman_keynote"]
      }
    ]
  },
  "cards": [
    {
      "sourceId": "v_altman_keynote",
      "clip": {"start": "20:21", "end": "31:52"},
      "label": "…",
      "name": "…"
      // …normal card fields
    }
  ]
}
```

Compilation tips:

- **Overview** answers the user task, not “video 1 + video 2”.
- **Cards (2–6)** are the synthesized structure (steps, places, concepts) —
  not one card per source unless that truly helps.
- Prefer putting conflicts / conditions into `body` `tips` or a small table.
- Travel topics still must satisfy `travel.md` (food/stay/play/packing + comics).

## Output

Identical to Mode A:

```
data_<name>.json → [art] → out_<name>.html
```

Template shows a multi-source line when `meta.sources` is present. Embed with
`?embed=1` inside the host APP viewer.

## Anti-patterns

- ❌ N separate flipbooks when the user asked for one synthesized plan
- ❌ Ignoring user time ranges (analyzing the whole hour anyway)
- ❌ Treating two clips of the same re-upload as “multi-source consensus”
- ❌ Dumping a markdown summary instead of overview + hotspot cards
- ❌ Claims without `sourceId` / `clip` when Mode B
- ❌ Expanding `restTldr` regions into full cards

## Mode A vs Mode B quick chooser

| User action | Mode |
|-------------|------|
| 小火人收**这一条** / 只圈**一段**要成页 | A · single |
| 灵感库勾选 **多条片段** → 生成方案 | B · multi |
| 一条长视频，用户只要其中一段 + 其余 TLDR | A · single（带 `clip` + `restTldr`） |
