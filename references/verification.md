# Verifying a Flipbook Page

The interaction — hotspot click → cinematic push-in → detail — can only be
trusted by *seeing* it. Verify **wide and narrow** viewports. Headless Chromium
is often unavailable; drive a real browser tool. `scripts/shot.py` is a rare
fallback when bundled Chromium exists.

## The upload-and-drive loop

1. **Upload** the built HTML so the browser tool can open a URL (plain HTML
   upload — not an enterprise Feishu/larkoffice doc URL).

2. **Open** the URL (add `?embed=1` if the page will ship inside an APP WebView).

3. **Screenshot the home page (wide).** Confirm overview art, facts panel, hint,
   and hotspots sitting **on** the map (not in letterboxed empty space).

4. **Click a hotspot** via CSS (coordinate clicks miss tiny targets):

   ```jsonc
   [
     {"action":"wait_for_selector","selector":".hotspot","timeout_ms":6000},
     {"action":"click","selector":".hotspot"}
   ]
   ```

   Screenshot as a **separate** step ~1s later (annotation / rail reveal is
   staggered — mid-animation shots look empty).

5. **Screenshot detail (wide).** Expect centered illustration, callout cards in
   both margins, dashed leader lines, anchor dots. Transition was a zoom-in.

6. **Resize to mobile (~390×844) or Emulation.setDeviceMetricsOverride**, reload
   (or reopen with `?embed=1`), and repeat home + one detail click.

7. **Read the mobile screenshots.** Confirm:

   - Home: compact hotspots; tip labels readable (not `…` truncated); facts panel
     **below** the map, not covering it.
   - Detail: **two columns** — left clean image (no pins / no overlay cards),
     right「相关介绍」list from annotations. No badge like「图中标注对应画面部位」
     sitting on top of text.

8. If ambiguous, extract DOM text: annotation titles should appear in `.dr-t`
   (mobile) or `.anno .at` (desktop).

## Travel extras (`theme: travel`)

### Place detail panel

On a place card, confirm `#travelPanel` / travel rows:

1. 「想去此地」checkbox present.
2. Every food / stay / play / packing row shows **thumbnail + name(+budget) +
   小字 `note`** (not name-only).
3. Ticking food/stay/play updates top-right **💰** live total; drawer explains spend.
4. Top-left **🧳** opens illustrated suitcase; items can pack/unpack (fly
   animation); fuller pack feels heavier/slower.

### Personalized plan（生成我的攻略）

1. Cover shows `N天M晚` + budget.
2. Route map: if `overview.routeImage` is set, show that comic (route baked in)
   **without** thick SVG arrows/pins; else thin SVG curve + pins on overview art.
3. **Day tabs** (D1, D2…) — clicking D2 shows **only** Day 2 (not a stacked list
   of all days). Active tab is highlighted.
4. Day page has 行程线 · 上午/下午/晚上 · 小贴士 · 小结（无「今日图鉴」冗余网格）。
   Image captions sit **below** the art, not as overlays that cover the picture.
5. Food / stay / play slots use **distinct comic illustrations** — no video-frame
   JPGs mixed in (inspect `img[src]` under `.tv-day-pane.on`).
6. Home does **not** show「规划我的路线」competing with「生成我的攻略」.
7. Visual language stays house ink/watercolor Morandi — not Q-version cartoon.

See `references/travel.md` for the full contract.

## What "correct" looks like

- **Home (any width)**: overview fills the stage; hotspots on `#mapStage` image;
  facts beside (wide) or under (narrow) the map.
- **Detail wide**: 图解 with callouts + leaders.
- **Detail narrow**: image | content rail; no on-image annotation chrome.

## Common failures and fixes

- **Hotspots float off the map** → they were parented to the canvas, not
  `#mapStage`; use the stock template.
- **Facts panel covers the map on phone** → narrow CSS must park `.factsheet` in
  `#factsSlot` below the map.
- **Mobile detail is a stack of cards / numbered pins on the art** → regress;
  restore `.detail-split.split-on` + `#detailRail` behavior from the template.
- **Tip text shows as `泗水 · …`** → tip `max-width` / ellipsis; tips must allow
  full label text on narrow screens.
- **Cards in DOM but invisible (desktop)** → need `.diagram.entered` after the
  scene activates (double `requestAnimationFrame` in template).
- **Garbled glyphs inside the illustration** → regenerate with `art_recipe`
  (always appends NO text/labels/numbers).
- **Travel plan is one long day list** → day panes must use tabs
  (`.tv-day-pane` / `.tv-nav-day`); only one `.on` at a time.
- **Plan mixes video frames + comics** → every food/stay/play needs comic
  `image`; runtime rejects `.jpg`. Do not fall back to `realPhotos` for slots.
- **「规划我的路线」still shows on travel home** → template must hide
  `overview.widget.type === "route"` tools button.
- **Detail rows lack thumbnail / note** → author `image` + `note` on each item;
  packing prefer `{name, note}` objects.
- **routeImage set but SVG arrows still dominate** → plan must prefer baked
  comic map and skip overlay pins/lines.
- **Luggage is a plain checklist only** → openPackDrawer should use suitcase art
  + item icons + fly animation.
