---
name: video-to-flipbook
description: >-
  Turn a video (or any linear explainer) into an interactive illustrated
  "flipbook" webpage for desktop and mobile/APP: overview hotspots with cinematic
  push-in, desktop 图解 detail, mobile left-image/right-copy layout. For travel
  guides (theme travel): per-stop food/stay/play with budgets + notes + comic
  images, packing, go-toggles, live 💰 / illustrated 🧳 suitcase, and「生成我的攻略」—
  a day-tabbed illustrated itinerary (comic-only art, captions below images, no
  「今日图鉴」, no「规划我的路线」) with routeImage on the overview map. Also
  timeline/stepper/recipe widgets. Use for travel vlogs, 自由行攻略, 区域划分,
  tutorials, architecture, recipes, museum tours, knowledge cards, 图鉴, APP
  embed, 左图右文, 旅行花费, or "把视频做成可交互网页". One self-contained HTML.
  Do NOT use for plain slides, transcripts, or static charts.
---

# Video → Interactive Flipbook

Transform linear content (a video, tutorial, vlog, explainer) into a **data-driven
interactive illustrated page**. The reader lands on a hand-drawn overview
illustration, clicks a glowing hotspot, the camera **cinematically pushes in**,
and a **detail scene** opens. Optional widgets (timeline / stepper / recipe /
route) add hands-on depth.

The page is **mobile/APP-first ready**: narrow viewports use a clean two-column
detail layout; wide desktops keep the classic museum-style 图解.

## The signature effect

Get these right or the output is just another card page:

1. **Cinematic push-in on click** — hotspot click scales/zooms the overview into
   that point, then hands off to the detail scene. This is a *camera move*, not
   a page cut. (Do NOT add fake animated pedestrians/sprites.)

2. **Detail layout is viewport-aware** (built into `assets/flipbook_template.html`):

   | Viewport | Detail presentation |
   |----------|---------------------|
   | **Wide (>860px)** | Annotated diagram (图解): centered illustration + callout cards in side margins + dashed leader lines to anchor dots |
   | **Narrow (≤860px) / APP** | **Two columns: left = clean image (no overlays), right =「相关介绍」rail** fed from `annotations` (or `meta` / `desc` fallback). No pins, no stacked annotation cards on/under the image, no floating hint badge over content |

   On mobile, do **not** invent a third layout (numbered pins on the image, stacked
   cards below the image, etc.). The template already implements left-image /
   right-copy. Author good `annotations[].t` / `annotations[].d` — they become the
   right-rail copy on phones.

3. **Hotspots sit on the illustration** — percentages are relative to the image
   box (`#mapStage`), not the full canvas. Facts panel floats beside the map on
   desktop and moves **below** the map on narrow screens (never cover the art).

## The pipeline

```
video → [analyze] → data_<name>.json → [art recipe] → images → [build] → out_<name>.html → [verify]
```

Data-driven: all content in JSON; the generic HTML template renders it. You
almost never touch the template — produce good JSON and good images.

### Step 1 — Analyze the source into structured JSON

Author `data_<name>.json` per `references/schema.md`. Aim for:

- Crisp **overview** (title, subtitle, facts panel, one overview illustration).
- 2–6 **cards** with `x`/`y` hotspot % on the overview.
- For each card: `annotations` (3–5 items with `t`, `d`, and on desktop also
  `ax`/`ay`/`side`). On mobile these power the right rail — keep `t` short and
  `d` one clause; avoid dumping long essays into annotations.
- Rich `body` blocks and a `widget` where the domain fits.
- `theme`: `travel | building | art | dark`.

**If the source is a travel guide video**, also follow
`references/travel.md` (food/stay/play/packing + comic `image` on each item).

Real video → `scripts/extract_frames.py` (PyAV) for stills; optional
`realPhotos` on cards (**detail gallery only** — not plan slot art).

Study `examples/` (yingxian / coffee / bali) before writing new data.
`bali` is the full travel contract reference.

### Step 2 — Generate the illustrations (two-phase handshake)

Images via the **Agent image tool** only (scripts must not call the model
gateway). Handshake:

1. Empty `image` + `imagePrompt` (subject only; style from `art_recipe`).
2. `python3 scripts/build.py --auto data_<name>.json` → writes `<name>_prompts.json` and pauses.
3. Generate images; write `<name>_images.json` as `{key: url}`.
4. Re-run `--auto` → backfill, build, cleanup.

Art recipe: hand-drawn ink-and-watercolor, Morandi palette, cream paper,
**zero text/labels/numbers in the image**.

For travel: also generate **per-item comic art** for food / stay / play (see
Travel section below). Do not reuse video frames as those images.

### Step 3 — Build the page

```bash
PYTHONPATH=<skill>/scripts python3 <skill>/scripts/build.py data_<name>.json
PYTHONPATH=<skill>/scripts python3 <skill>/scripts/build.py --all
```

Keep `data_*.json` in a **writable** working directory (skill install path may be
read-only). Output: single self-contained `out_<name>.html` next to the data file.
Travel media (comic PNGs) should sit beside the HTML as relative paths
(e.g. `media/<name>/…png`) so the plan page can load them.

### Step 4 — Verify visually

Follow `references/verification.md`. Always verify **both**:

1. **Desktop / wide** — home hotspots aligned to the map; detail shows 图解
   (callouts + leader lines) after push-in.
2. **Mobile (≈390×844)** — home: small hotspots, full tip labels, facts below
   map; detail: **left image + right「相关介绍」**, no markers on the art.
   Prefer `?embed=1` when the page will live inside an APP WebView/iframe.

For travel, also verify the plan scene checklist in `references/travel.md` §4.

## APP / WebView embedding

- Template supports `?embed=1` or iframe detection → `body.embed` (hides the
  page chrome topbar; host APP provides close/back).
- Use `100dvh`, `viewport-fit=cover`, and safe-area padding — do not rely on
  desktop-only absolute overlays.
- Deliver either the standalone HTML or a path the host APP can load in a
  full-screen viewer (`…/out_<name>.html?embed=1`).

## Delivering

Upload/share `out_<name>.html` and note desktop vs mobile behavior if relevant.
If you built several, list them with one line each. For travel, also ship the
`media/` comic assets next to the HTML.

## Security constraints (non-negotiable)

- **Never** call an LLM / image gateway from generated code or scripts over HTTP.
  Images go through the Agent tool chain + handshake only.
- **Never** start a network-listening process to preview flipbooks for
  verification — use the upload + browser-tool loop in `references/verification.md`.
  (A product APP shell with its own server is out of scope for this skill.)
- Preserve `[ph_..._ph]` placeholders byte-for-byte if present.

## Travel guides (`theme: "travel"`) — mandatory

> Full contract: **`references/travel.md`**. Summary below.

When the source is a **旅行攻略 / 区域划分 / 自由行** video, set `meta.theme` to
`"travel"` and for **every place card** author:

1. **美食推荐** `food[]` — `budget` (CNY) + **comic `image`** + **`note`**（特色说明）
2. **住宿** `stay[]` — `budget` / night + `nights` + **comic `image`** + **`note`**（为何推荐）
3. **游玩项目** `play[]` — `budget` + **comic `image`** + **`note`**（项目亮点）
4. **行李清单** `packing[]` — `{name, note}`（+ optional comic `image`）；`note` = 为何在该站需要
5. **想去此地** — `goDefault` + checkbox in the page
6. **daysSuggest** (+ preferred `routeOrder`)
7. **视频实拍** `realPhotos[]` — for detail gallery only（勿当攻略槽位图）
8. Prefer **`overview.routeImage`** — comic overview with the route **painted into**
   the artwork（路线画进插画，不是事后叠粗箭头）

**Detail panel row contract** (every food / stay / play / packing item):
checkbox · **thumbnail** · name(+budget) · **小字 `note`**. Packing may fall back
to `media/<name>/pack/` icons via `packIconFor`.

### Runtime (`assets/travel_planner.js`, auto-injected)

- **💰** live total（勾选美食/住宿/游玩累加）· 点开看花费明细
- **🧳** illustrated suitcase drawer（comic 行李箱 + 分项图标；勾选飞入 /
  取消飞出；装得越满箱子越「重」、动画越慢）
- **生成我的攻略** bottom CTA
- **Do not** show home「规划我的路线」for `overview.widget.type === "route"`
  （个性化攻略按钮已替代）
- Plan scene（图示攻略，参考小红书视觉攻略结构，**保持家风墨水彩**）:
  - Cover stats（`N天M晚` / 站 / 预算）
  - Route map: prefer `overview.routeImage`（有则 **不叠** SVG 粗线/大钉）;
    fallback: thin SVG curve on overview art
  - **Day tabs D1…Dn — one day at a time**（点 D2 只显示第 2 天，禁止长列表堆叠）
  - Each day: 行程线 A→B→C · 上午/下午/晚上 slots（游玩/美食/住宿 + **该项 comic 图**，
    图注在图**下方**不盖图）· 小结 / 行李
  - **禁止**冗余「今日图鉴」网格
- **Comic-only plan art** — reject `.jpg` video frames; never mix screenshots
  with illustrations in the itinerary
- **House style** — ink/watercolor Morandi paper; **not** cute Q-version cartoon

Do not ship a travel flipbook that only has prose/`annotations` without
food/stay/play/packing/budgets、`note`、**and** per-item comic images.

## Do not regress (mobile layout)

When editing the template or forking it:

- ❌ Stack annotation cards under the image on mobile
- ❌ Numbered pins / floating tips covering the detail illustration on mobile
- ❌ Position overview hotspots against the full canvas (letterboxing drifts dots)
- ❌ Leave the facts panel absolutely covering the map on narrow screens
- ❌ Travel plan as one endless day list (must be day tabs)
- ❌ Video-frame JPGs as food/stay/play plan images
- ❌「今日图鉴」redundant photo grid on day pages
- ❌ Home「规划我的路线」competing with「生成我的攻略」
- ❌ Detail food/stay/play/packing rows without thumbnail + `note`
- ✅ Narrow detail = `.detail-split.split-on` → image | `#detailRail`
- ✅ Hotspots append to `#mapStage`; tips show full label text (no ellipsis trap)
- ✅ Plan captions below images; day tabs one-pane-at-a-time

## Bundled resources

- `scripts/build.py` — validate → handshake → inject → build
- `scripts/art_recipe.py` — house art style + prompt collection
- `scripts/shot.py` — optional local Playwright shots
- `scripts/extract_frames.py` — even frame sampling (PyAV)
- `assets/flipbook_template.html` — renderer (desktop 图解 + mobile two-column + embed + travel chrome CSS)
- `assets/travel_planner.js` — travel budget / luggage / day-tabbed comic itinerary (auto-injected for travel)
- `examples/data_{yingxian,coffee,bali}.json` — worked examples (`bali` = full travel contract)
- `examples/media/bali/` — comic assets for bali plan slots
- `references/schema.md` — data contract + travel fields
- `references/travel.md` — **travel guide contract** (layout, comic art, day tabs)
- `references/verification.md` — desktop + mobile + travel plan checks
