# Travel guide contract（旅行攻略类）

When the source is a **旅行攻略 / 自由行 / 区域划分** video, follow this contract
end-to-end. Reference implementation: `examples/data_bali.json` +
`assets/travel_planner.js`.

## 0. Product requirements（must all ship）

| # | Requirement |
|---|-------------|
| 1 | Every place: 美食 / 住宿 / 游玩 / 行李 / 视频实拍 /「想去此地」 |
| 2 | Food / stay / play have **concrete CNY budgets**; tickable → live 💰 total |
| 3 | Detail rows: **photo/thumbnail + 小字 note** on every food/stay/play/packing item |
| 4 | 🧳 suitcase drawer: comic case + item icons; pack/unpack fly; heavier when fuller |
| 5 | After browsing → **生成我的攻略** = personalized `N天M晚` + recommended order |
| 6 | Plan is **illustrated**: day tabs (one day at a time), 行程线, AM/PM/evening slots |
| 7 | Route map prefers `overview.routeImage` (route **drawn into** comic); no「规划我的路线」CTA |
| 8 | Plan art = **comic only** (no video-frame JPG mix); captions **below** images; no「今日图鉴」 |
| 9 | Style = house ink/watercolor on cool silver-mist + navy (VERSO) — layout may echo Xiaohongshu guides, **not** Q-cartoon |

## 1. Data requirements

Set `meta.theme` to `"travel"`. For **every place card** author:

| Field | Required | Notes |
|-------|----------|-------|
| `food[]` | ✅ | `{name, budget, note, defaultOn?, image}` — CNY number; `note` = 特色说明 |
| `stay[]` | ✅ | `{name, budget, nights, note, defaultOn?, image}` — `note` = 为何推荐 |
| `play[]` | ✅ | `{name, budget, note, defaultOn?, image}` — `note` = 项目亮点 |
| `packing[]` | ✅ | `{name, note, image?}`（或兼容纯 string）；`note` = 为何在该站需要 |
| `goDefault` | ✅ | whether「想去此地」starts checked |
| `daysSuggest` | ✅ | stay weight for `N天M晚` math |
| `routeOrder` | recommended | fixed tour order (avoids crossed routes) |
| `realPhotos[]` | optional | video frames for **detail gallery only** — never used as plan slot art |
| `image` | ✅ | place illustration (comic / ink-watercolor PNG) |

### Comic images on food / stay / play（mandatory for plan）

Each **defaultOn** (and preferably every) food / stay / play item **must** have
an `image` that is a **house-style comic illustration** (ink + watercolor,
cool silver-mist paper + navy ink, **no text in the image** — same as `art_recipe.py`).

Every food / stay / play / packing row on the **place detail panel** shows:
checkbox · **thumbnail** · name(+budget) · **小字 `note`** (specialty / why recommend /
why pack at this stop). Packing may omit `image` and fall back to
`packIconFor(name)` icons under `media/<name>/pack/`.

- ❌ Do **not** put video-frame JPGs on food/stay/play `image`
- ❌ Do **not** let the generated plan mix screenshots + comics
- ✅ Generate dedicated comic art per dish / hotel / activity via the Agent
  image tool; store under `media/<name>/` and reference as relative paths
- Fallback in runtime: only other comic URLs (`card.image` PNG, sibling item
  comics). `travel_planner.js` **rejects `.jpg/.jpeg`** for plan visuals

`realPhotos` may still appear in the place **detail** gallery; the personalized
itinerary page ignores them.

## 2. Runtime UI（auto via `travel_planner.js`）

Injected when `theme:travel` or any card has food/stay/play/packing:

| Chrome | Behavior |
|--------|----------|
| 🧳 top-left | **Illustrated suitcase drawer**: comic suitcase + per-item comic
  icons; tap to pack/unpack with fly-in/out animation; fuller pack → heavier /
  slower suitcase motion |
| 💰 top-right | Live spend total from ticked food/stay/play |
| **生成我的攻略** bottom | Opens personalized plan scene |

Do **not** show the home **「规划我的路线」** tools button for
`overview.widget.type === "route"` — the itinerary button replaces it. Keep
timeline / other widget buttons if needed.

### Personalized plan layout（图示攻略）

Keep **house ink / silver-mist style** (Noto Sans UI chrome, navy accents, dashed ice-blue leaders). Layout
structure may learn from Xiaohongshu visual itineraries; **do not** switch to
cute Q-version / sticker cartoon hand-drawn.

1. **Cover** — title, `N天M晚`, stats (天 / 晚 / 站 / 预算)
2. **Overview route map** — prefer `overview.routeImage`: a **comic illustration
   with the route painted into the artwork**. When present, do **not** overlay
   thick SVG arrows/pins (legend only). Fallback: overview illustration + thin
   curved SVG through selected stops’ `x`/`y` + numbered pins + legend.
3. **Day tabs D1…Dn** — **one day visible at a time** (click D2 shows only Day 2;
   do **not** stack all days in one long scroll list)
4. **Each day page**
   - Ribbon: `DAY N` + theme title + tip
   - Horizontal **行程 A → B → C** summary
   - Slots **上午 / 下午 / 晚上** with: number, kind chip (游玩/美食/住宿),
     bullets, 小贴士, and **that item’s comic image** (caption **below** the
     image — never overlay that covers art)
   - Footer: 今日行程小结 flow + 今日行李 / tips
   - Do **not** add a redundant「今日图鉴」photo grid
5. **End** — budget + packing peek

## 3. Ordering & route

Prefer `routeOrder` on cards. Else match `overview.widget.stops` tags/labels.
Else authoring order. Draw a **thin** Catmull-Rom curve — no star-shaped
crossings through the map center.

## 4. Art checklist before ship

- [ ] Overview + each card `image` = comic illustration (not a video still)
- [ ] Every defaultOn food/stay/play has comic `image`
- [ ] Plan day tabs switch one-day-at-a-time
- [ ] Plan slots show distinct food vs stay vs play art
- [ ] No「规划我的路线」button competing with「生成我的攻略」
- [ ] Style = house ink/watercolor, not Q-cartoon
- [ ] Luggage drawer shows comic suitcase + item icons; uncheck flies item out;
      heavy pack slows suitcase motion
