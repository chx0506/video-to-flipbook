# Flipbook Data Schema

One `data_<name>.json` per page. `build.py` validates it, then injects it into the
template. Required top-level keys: `meta`, `overview`, `cards`. Required in `meta`:
`title`. Each card requires `x`, `y`, `label`.

The overview illustration and each card's detail illustration can either carry a
ready `image` URL, or an `imagePrompt` (subject only) that the two-phase handshake
turns into a generated image. See SKILL.md Step 2.

## Full structure

```jsonc
{
  "meta": {
    "title":    "Page title (required)",
    "enTitle":  "English sub-title (optional)",
    "subtitle": "One-line subtitle on the home page (optional)",
    "theme":    "travel | building | art | dark",   // drives palette + art view
    "hint":     "Top-right operating hint on the home page",
    "footer":   "One-line takeaway at the bottom of the home page",
    "sourceVideo": {"title":"…","url":"…","duration":"04:20","author":"…"}
  },

  "overview": {
    "image":       "Overview illustration URL. If empty + imagePrompt given, generated.",
    "imagePrompt": "OPTIONAL. Describe only WHAT to draw; art_recipe adds style.",
    "factsTitle":  "Title of the facts panel",
    "factsSide":   "left | right",                  // which side the panel sits
    "facts":       [{"k":"field name","v":"field value"}],
    "widget":      "OPTIONAL overview-level widget (see WIDGETS). Opens from a home button."
  },

  "cards": [
    {
      "x": 52, "y": 22,            // hotspot position on the overview, in %
      "label": "hover tooltip on the hotspot",
      "tag":   "category tag",     // e.g. "STEP 1 · 研磨"
      "name":  "detail title",
      "en":    "English name",
      "image": "detail illustration URL (falls back to overview image if absent)",
      "imagePrompt": "OPTIONAL subject for generation",
      "desc":  "lead paragraph on the detail page",
      "meta":  [["key","value"]],  // structured info rows on the right
      "note":  "one-line tip pinned at the bottom",
      "clip":  {"start":"03:12","end":"05:40"},   // source video timestamps (traceable)

      "annotations": [             // THE 图解 EFFECT — 3–5 per card recommended
        {"t":"label title","d":"one-line note","ax":62,"ay":30,"side":"left"}
        // ax/ay = anchor dot position on the illustration, in %
        // side  = which margin the callout card floats in: left | right
        //         (omit to auto-pick by ax: <50 → left, else right)
      ],

      "body": [                    // OPTIONAL rich content blocks, rendered in order
        {"h":"heading","type":"para","text":["para 1","para 2"]},
        {"h":"heading","type":"list","items":["a","b"]},
        {"h":"heading","type":"table","rows":[["k","v"]]},
        {"type":"tips","h":"pitfalls","items":["trap 1","trap 2"]},
        {"h":"budget","type":"budget","cols":["item","cost"],
         "rows":[["flights","1500"]],"total":["total","~X"]},
        {"h":"packing","type":"checklist","items":["passport","sunscreen"]}
      ],

      "realPhotos": [              // OPTIONAL real video frames, shown beside the art
        {"url":"frame URL","cap":"caption"}
      ],

      "widget": "OPTIONAL card-level widget (see WIDGETS)",

      // ===== Travel theme (theme:"travel") — REQUIRED per place for guide videos =====
      "goDefault": true,           // 「想去此地」默认是否勾选
      "daysSuggest": 2,            // 建议停留天数（用于生成 N 天 M 晚）
      "food": [                    // 美食推荐 + 预算 + note + comic image（可勾选计入总花费）
        {"name":"烤乳猪","budget":70,"note":"乌布必吃","defaultOn":true,"image":"media/.../food.png"}
      ],
      "stay": [                    // 住宿 + 每晚预算 × nights + note + comic image
        {"name":"崖顶民宿","budget":650,"nights":2,"note":"看日落","defaultOn":true,"image":"media/.../stay.png"}
      ],
      "play": [                    // 游玩项目 + 预算 + note + comic image
        {"name":"丛林秋千","budget":220,"note":"丛林树冠视角","defaultOn":true,"image":"media/.../play.png"}
      ],
      // 行李：优先 {name, note}；纯 string 仍兼容，但详情行会缺说明
      "packing": [
        {"name":"防晒霜","note":"海边日晒强"},
        {"name":"泳衣","note":"南湾下水"},
        {"name":"适配器","note":"印尼插座制式"}
      ]
    }
  ]
}
```

## Travel guide contract (`theme: "travel"`)

For **旅行攻略类** videos, every place card **must** include the fields below.
**Authoritative detail:** `references/travel.md`.

| Field | Purpose |
|-------|---------|
| `food[]` | `budget` + **comic `image`** + **`note`**. Tickable → 💰 |
| `stay[]` | `budget` / night + `nights` + **comic `image`** + **`note`**. Tickable |
| `play[]` | `budget` + **comic `image`** + **`note`**. Tickable |
| `packing[]` | `{name, note, image?}` (strings OK but prefer objects) → detail + 🧳 |
| `realPhotos[]` | Video frames for **detail gallery only** — never as plan slot art |
| `goDefault` / UI「想去此地」 | Whether the stop enters the personalized itinerary |
| `daysSuggest` | Weight for auto `N天M晚` plan |
| `routeOrder` | Recommended fixed tour order |
| `overview.routeImage` | Preferred **comic map with route painted in**. When set, plan uses it and skips SVG overlay pins/lines |

**Detail panel:** each food / stay / play / packing row =
checkbox · thumbnail · name(+budget) · 小字 `note`.

Runtime UI (injected via `assets/travel_planner.js` when theme is travel):

- Top-left **🧳** → illustrated suitcase drawer (pack/unpack fly animation;
  heavier when fuller)
- Top-right **💰 + live total** → spending breakdown  
- Bottom **生成我的攻略** → illustrated journal plan:
  - Cover · overview route map · **day tabs (one day at a time)**  
  - Per day: 行程线 · 上午/下午/晚上 (游玩/美食/住宿 + **item comic image**,
    caption **below** image) · 小结 / 行李 — **no**「今日图鉴」grid  
  - **Comic-only** visuals (no `.jpg` video-frame mix)  
  - House ink/paper style — not Q-version cartoon  
- Do **not** show「规划我的路线」for `overview.widget.type === "route"`

## Annotations — how to place them well

Annotations feed **two** presentations (same JSON, template switches by viewport):

| Viewport | How `annotations` render |
|----------|---------------------------|
| Wide (>860px) | Museum 图解: side callout cards + leader lines using `ax`/`ay`/`side` |
| Narrow (≤860px) / APP | Right-hand「相关介绍」rail: only `t` + `d` (image stays clean). If annotations are empty, template falls back to `meta`, then `desc` |

Author for both:

- Pick 3–5 distinct beats. Keep `t` short (2–5 chars/words) and `d` to **one clause**
  — on mobile these become the entire right column; long paragraphs feel noisy.
- Set `ax`/`ay` for desktop 图解 (0,0 = top-left of the illustration). Balance
  `side:"left"` / `side:"right"`. Spread `ay` (~28 / ~46 / ~80) so lines don't cross.
- The illustration itself must contain **no baked-in text** — labels live in JSON.

## Widgets

Set on `overview.widget` (opens from a home-page button) or `cards[i].widget`.

- **timeline** — history/chronology:
  `{"type":"timeline","title":"…","subtitle":"…","button":"…",
    "events":[{"year":"1056","title":"…","desc":"…"}]}`
- **stepper** — step-by-step tutorial:
  `{"type":"stepper","title":"…","steps":[{"title":"…","detail":"…","tip":"…"}]}`
- **recipe** — servings calculator (food):
  `{"type":"recipe","title":"…","subtitle":"…","button":"…","baseServings":1,"hint":"…",
    "ingredients":[{"name":"coffee","qty":15,"unit":"g"}]}`
  → user changes servings, quantities scale; checking "already have" strikes an item.
- **route** — trip planner metadata (travel, usually on `overview.widget`):
  `{"type":"route","title":"…","button":"…",
    "stops":[{"name":"South","tag":"STOP 2","stay":"2 days","tip":"…","moveNext":"fly 1h → Ubud"}]}`
  → Used for **ordering hints**; the home「规划我的路线」button is **hidden** for
  travel — users generate itineraries via「生成我的攻略」instead.

## Theme → art style mapping (from art_recipe.py)

| theme    | palette                                         | default view                       |
|----------|-------------------------------------------------|------------------------------------|
| travel   | muted earth tones, sage, tan, soft blue sea     | bird's-eye isometric-leaning aerial|
| building | warm brown, tan, sage, soft grey                | architectural isometric-leaning    |
| art      | dusty purple, mauve, warm neutrals              | frontal / gallery                  |
| dark     | deep teal + warm amber on dark ground           | dramatic low-key                   |

All themes share: hand-drawn ink line-art + soft watercolor wash, cream paper,
centered composition with generous margins, and **no text anywhere in the image**.
