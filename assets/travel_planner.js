/* Travel planner — loaded when theme=travel or cards carry food/stay/packing */
(function () {
  const D = window.FLIPBOOK;
  if (!D || !D.cards) return;
  const isTravel =
    (D.meta && D.meta.theme === "travel") ||
    D.cards.some((c) => c.food || c.stay || c.play || c.packing);
  if (!isTravel) return;

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"]/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m])
    );
  const yen = (n) => "¥" + Math.round(n).toLocaleString("zh-CN");

  // ---- state ----
  const go = {}; // cardIdx -> bool
  const pick = {}; // cardIdx -> { food:{}, stay:{}, play:{}, pack:{} }
  const visited = new Set();

  D.cards.forEach((c, i) => {
    go[i] = c.goDefault !== false;
    pick[i] = { food: {}, stay: {}, play: {}, pack: {} };
    (c.food || []).forEach((it, j) => {
      pick[i].food[j] = !!it.defaultOn;
    });
    (c.stay || []).forEach((it, j) => {
      pick[i].stay[j] = it.defaultOn !== false;
    });
    (c.play || []).forEach((it, j) => {
      pick[i].play[j] = !!it.defaultOn;
    });
    (c.packing || []).forEach((_, j) => {
      pick[i].pack[j] = true;
    });
  });

  function itemBudget(it) {
    const b = Number(it.budget) || 0;
    const nights = Number(it.nights) || 1;
    return it.nights != null ? b * nights : b;
  }

  function calcTotal() {
    let total = 0;
    const lines = [];
    D.cards.forEach((c, i) => {
      if (!go[i]) return;
      const groups = [
        ["美食", c.food, pick[i].food],
        ["住宿", c.stay, pick[i].stay],
        ["游玩", c.play, pick[i].play],
      ];
      groups.forEach(([label, arr, map]) => {
        (arr || []).forEach((it, j) => {
          if (!map[j]) return;
          const amt = itemBudget(it);
          total += amt;
          lines.push({
            place: c.name || c.label,
            kind: label,
            name: it.name,
            amt,
            note: it.note || "",
          });
        });
      });
    });
    return { total, lines };
  }

  function selectedStops() {
    return D.cards
      .map((c, i) => ({ c, i }))
      .filter(({ i }) => go[i]);
  }

  function orderStops(stops) {
    if (stops.length <= 1) return stops.slice();

    // 1) Explicit routeOrder on cards
    if (stops.every(({ c }) => c.routeOrder != null)) {
      return stops.slice().sort(
        (a, b) => Number(a.c.routeOrder) - Number(b.c.routeOrder)
      );
    }

    // 2) Match overview.widget.route stops by STOP tag / short label (not fuzzy full name)
    const routeStops = (D.overview.widget && D.overview.widget.stops) || [];
    if (routeStops.length) {
      const scored = stops.map((s) => {
        const tag = (s.c.tag || "").toUpperCase();
        const label = s.c.label || "";
        let idx = routeStops.findIndex((r, ri) => {
          const rt = (r.tag || "").toUpperCase();
          if (rt && tag && (tag.includes(rt) || rt.includes(tag.replace(/[^A-Z0-9]/g, ""))))
            return true;
          // "泗水 · 火山站" vs "泗水 · 火山站"
          if (r.name && (label === r.name || label.includes(r.name.split("·")[0].trim())))
            return true;
          return false;
        });
        if (idx < 0) idx = 1000 + s.i;
        return { s, idx };
      });
      scored.sort((a, b) => a.idx - b.idx);
      return scored.map((x) => x.s);
    }

    // 3) Keep authoring order (cards[] sequence) — usually narrative route
    return stops.slice().sort((a, b) => a.i - b.i);
  }

  function estimateDays(ordered) {
    let days = 0;
    ordered.forEach(({ c, i }) => {
      let d = Number(c.daysSuggest) || 0;
      if (!d) {
        const stays = c.stay || [];
        let nights = 0;
        stays.forEach((it, j) => {
          if (pick[i].stay[j]) nights += Number(it.nights) || 1;
        });
        d = nights > 0 ? nights : 1;
      }
      days += d;
    });
    days = Math.max(1, Math.ceil(days));
    const nights = Math.max(0, days - 1);
    return { days, nights, label: days + "天" + nights + "晚" };
  }

  function selectedItems(arr, map) {
    return (arr || [])
      .map((x, j) => ({ x, j }))
      .filter(({ j }) => map[j])
      .map(({ x }) => x);
  }

  function isComicUrl(u) {
    if (!u) return false;
    // 视频帧多为 jpg；攻略统一只用漫画/插画（png 或本地 media）
    if (/\.jpe?g(\?|#|$)/i.test(u)) return false;
    return true;
  }

  function photoPool(c) {
    const urls = [];
    const push = (u) => {
      if (isComicUrl(u) && !urls.includes(u)) urls.push(u);
    };
    // 不用 realPhotos（视频帧）；只用站点插画 + 各项目漫画图
    push(c.image);
    ["food", "stay", "play"].forEach((kind) => {
      (c[kind] || []).forEach((it) => push(it && it.image));
    });
    return urls;
  }

  function itemImage(it, c, used, fallbackIdx) {
    if (it && isComicUrl(it.image)) return it.image;
    const pool = photoPool(c);
    for (let k = 0; k < pool.length; k++) {
      const u = pool[(fallbackIdx + k) % pool.length];
      if (!used.has(u)) {
        used.add(u);
        return u;
      }
    }
    if (pool.length) return pool[fallbackIdx % pool.length];
    return isComicUrl(c.image) ? c.image : "";
  }

  function dayTheme(c, dayPart) {
    const base = (c.label || c.name || "").split("·")[0].trim();
    const themes = ["初遇", "慢逛", "深入", "回味", "收官"];
    return base + " · " + (themes[Math.min(dayPart, themes.length - 1)] || "行程");
  }

  function buildSlotsForStop(c, i, dayPart, totalParts) {
    const foods = selectedItems(c.food, pick[i].food);
    const stays = selectedItems(c.stay, pick[i].stay);
    const plays = selectedItems(c.play, pick[i].play);
    const annos = c.annotations || [];
    const used = new Set();
    const place = c.name || c.label;

    const playChunk = Math.ceil(plays.length / totalParts) || 1;
    const playsToday = plays.slice(dayPart * playChunk, dayPart * playChunk + playChunk);
    const foodChunk = Math.ceil(foods.length / totalParts) || 1;
    const foodsToday = foods.slice(dayPart * foodChunk, dayPart * foodChunk + foodChunk);
    const stayToday = stays[Math.min(dayPart, Math.max(0, stays.length - 1))];
    const annoToday = annos[Math.min(dayPart, Math.max(0, annos.length - 1))];

    const slots = [];
    let imgIdx = dayPart * 3;

    // 上午 · 游玩 / 景点
    const amPlay = playsToday[0];
    const amImg = itemImage(amPlay, c, used, imgIdx++);
    slots.push({
      key: "am",
      kind: "play",
      pill: "上午",
      time: "09:00 – 12:00",
      title: amPlay ? amPlay.name : place,
      body:
        (amPlay && amPlay.note) ||
        (annoToday && (annoToday.d || annoToday.t)) ||
        (c.desc || "").slice(0, 100) ||
        c.note ||
        "",
      bullets: [
        amPlay ? "游玩 · " + amPlay.name : "打卡 · " + place,
        annoToday && annoToday.t ? annoToday.t + (annoToday.d ? "：" + annoToday.d : "") : "",
        c.note || "",
      ].filter(Boolean).slice(0, 3),
      tip: amPlay && amPlay.budget != null ? "预算约 " + yen(itemBudget(amPlay)) : (c.note || ""),
      visual: amImg,
      budget: amPlay ? itemBudget(amPlay) : 0,
      tags: amPlay ? ["游玩", amPlay.name] : ["景点"],
    });

    // 下午 · 优先第二游玩，否则美食
    const pmPlay = playsToday[1];
    const pmFood = foodsToday[0];
    if (pmPlay) {
      const img = itemImage(pmPlay, c, used, imgIdx++);
      slots.push({
        key: "pm",
        kind: "play",
        pill: "下午",
        time: "14:00 – 17:30",
        title: pmPlay.name,
        body: pmPlay.note || (annos[1] && annos[1].d) || "继续探索本地体验",
        bullets: [
          "游玩 · " + pmPlay.name,
          pmPlay.note || "",
          pmFood ? "顺路觅食 · " + pmFood.name : "",
        ].filter(Boolean).slice(0, 3),
        tip: pmPlay.budget != null ? "预算约 " + yen(itemBudget(pmPlay)) : "",
        visual: img,
        budget: itemBudget(pmPlay),
        tags: ["游玩", pmPlay.name],
      });
    } else if (pmFood) {
      const img = itemImage(pmFood, c, used, imgIdx++);
      const extras = foodsToday.slice(1).map((f) => f.name);
      slots.push({
        key: "pm",
        kind: "food",
        pill: "下午",
        time: "12:30 – 17:00",
        title: pmFood.name,
        body: [pmFood.note, extras.length ? "还可尝尝：" + extras.join("、") : ""]
          .filter(Boolean)
          .join(" · ") || "尝尝当地味道，别赶场",
        bullets: [
          "美食 · " + pmFood.name,
          pmFood.note || "",
          pmFood.budget != null ? "人均约 " + yen(itemBudget(pmFood)) : "",
        ].filter(Boolean),
        tip: "推荐美食，已计入花费",
        visual: img,
        budget: itemBudget(pmFood),
        tags: ["美食", pmFood.name].concat(extras.slice(0, 2)),
      });
    } else {
      const img = itemImage(null, c, used, imgIdx++);
      slots.push({
        key: "pm",
        kind: "free",
        pill: "下午",
        time: "14:00 – 17:30",
        title: (c.label || place) + " · 漫步",
        body: c.note || "留白给偶遇与拍照，不必排满",
        bullets: ["自由活动", c.note || "随性走走"].filter(Boolean),
        tip: "",
        visual: img,
        budget: 0,
        tags: ["自由活动"],
      });
    }

    // 晚上 · 住宿为主，可带晚餐
    const eveFood =
      foodsToday.length > (pmPlay ? 0 : 1)
        ? foodsToday[pmPlay ? 0 : Math.min(1, foodsToday.length - 1)]
        : foodsToday[0];
    if (stayToday) {
      const img = itemImage(stayToday, c, used, imgIdx++);
      const bullets = [
        "住宿 · " + stayToday.name,
        stayToday.nights ? "入住 " + stayToday.nights + " 晚" : "",
        stayToday.note || "",
        eveFood && (!pmFood || eveFood.name !== pmFood.name)
          ? "晚餐 · " + eveFood.name
          : "",
      ].filter(Boolean);
      slots.push({
        key: "eve",
        kind: "stay",
        pill: "晚上",
        time: "19:00 – 21:30",
        title:
          stayToday.name + (stayToday.nights ? ` · ${stayToday.nights}晚` : ""),
        body:
          stayToday.note ||
          (eveFood ? "晚餐：" + eveFood.name : "回住所休整，整理明日行程"),
        bullets,
        tip:
          stayToday.budget != null
            ? "住宿预算约 " + yen(itemBudget(stayToday))
            : "早点休息，养足体力",
        visual: img,
        sideVisual:
          eveFood && (!pmFood || eveFood.name !== pmFood.name)
            ? itemImage(eveFood, c, used, imgIdx++)
            : "",
        sideLabel: eveFood ? eveFood.name : "",
        budget: itemBudget(stayToday),
        tags: ["住宿"].concat(
          eveFood && (!pmFood || eveFood.name !== pmFood.name)
            ? ["美食", eveFood.name]
            : []
        ),
      });
    } else if (eveFood) {
      const img = itemImage(eveFood, c, used, imgIdx++);
      slots.push({
        key: "eve",
        kind: "food",
        pill: "晚上",
        time: "19:00 – 21:30",
        title: "晚餐 · " + eveFood.name,
        body: eveFood.note || "结束一天，用一顿本地餐收尾",
        bullets: ["美食 · " + eveFood.name, eveFood.note || ""].filter(Boolean),
        tip: eveFood.budget != null ? "人均约 " + yen(itemBudget(eveFood)) : "",
        visual: img,
        budget: itemBudget(eveFood),
        tags: ["美食", eveFood.name],
      });
    } else {
      const img = itemImage(null, c, used, imgIdx++);
      slots.push({
        key: "eve",
        kind: "free",
        pill: "晚上",
        time: "19:00 – 21:30",
        title: "夜色漫步",
        body: "轻松收尾，为第二天留体力",
        bullets: ["自由活动"],
        tip: "",
        visual: img,
        budget: 0,
        tags: ["自由活动"],
      });
    }

    // 图库：当日所有独特配图（含美食/住宿）
    const gallery = [];
    const pushGal = (src, label, kind) => {
      if (!isComicUrl(src)) return;
      if (gallery.some((g) => g.src === src && g.label === label)) return;
      gallery.push({ src, label, kind: kind || "" });
    };
    slots.forEach((s, n) => {
      pushGal(s.visual, s.title, s.kind);
      if (s.sideVisual) pushGal(s.sideVisual, s.sideLabel || "美食", "food");
    });
    foodsToday.forEach((f) => {
      if (f.image) pushGal(f.image, f.name, "food");
    });
    if (stayToday && stayToday.image)
      pushGal(stayToday.image, stayToday.name, "stay");

    return {
      theme: dayTheme(c, dayPart),
      place,
      label: c.label || place,
      tip: c.note || "",
      image: c.image || "",
      i,
      x: c.x,
      y: c.y,
      flow: slots.map((s) => s.title),
      slots,
      gallery,
      foods: foodsToday.map((f) => f.name),
      stays: stayToday
        ? [stayToday.name + (stayToday.nights ? ` · ${stayToday.nights}晚` : "")]
        : [],
      plays: playsToday.map((p) => p.name),
      packing: (c.packing || [])
        .filter((_, j) => pick[i].pack[j])
        .map((x) => (typeof x === "string" ? x : x.name))
        .slice(0, 4),
    };
  }

  function buildDayPlan(ordered, dayInfo) {
    const days = [];
    for (let d = 0; d < dayInfo.days; d++) {
      days.push({ day: d + 1, stops: [], items: [] });
    }
    let cursor = 0;
    ordered.forEach(({ c, i }) => {
      const weight = Math.max(1, Math.ceil(Number(c.daysSuggest) || 1));
      for (let p = 0; p < weight; p++) {
        const slot = Math.min(cursor + p, dayInfo.days - 1);
        const built = buildSlotsForStop(c, i, p, weight);
        days[slot].stops.push(built);
        // keep legacy items for map/compat
        days[slot].items.push({
          name: built.place,
          foods: built.foods,
          stays: built.stays,
          plays: built.plays,
          tip: built.tip,
          x: built.x,
          y: built.y,
          i: built.i,
        });
      }
      cursor += weight;
      if (cursor > dayInfo.days - 1) cursor = dayInfo.days - 1;
    });
    return days.filter((d) => d.stops.length);
  }

  // ---- chrome ----
  function ensureChrome() {
    if (document.getElementById("travelChrome")) return;
    if (!document.getElementById("tv-action-cta-style")) {
      const st = document.createElement("style");
      st.id = "tv-action-cta-style";
      st.textContent =
        ".tv-action-cta{margin:22px 0 40px;padding:0 4px}" +
        ".tv-action-cta-inner{background:color-mix(in srgb,var(--paper) 55%,#fff);border:1.5px solid var(--line);border-radius:16px;padding:16px 18px}" +
        ".tv-action-btn{display:block;width:100%;margin-top:12px;border:0;border-radius:14px;padding:14px;background:var(--ink);color:var(--paper);font:700 14px inherit;cursor:pointer}" +
        ".tv-action-sub{font-size:12px;color:var(--muted);margin-top:8px;text-align:center}";
      document.head.appendChild(st);
    }
    const bar = document.createElement("div");
    bar.id = "travelChrome";
    bar.innerHTML =
      '<button type="button" class="tv-fab tv-pack" id="tvPackBtn" title="行李清单" aria-label="行李清单">' +
      '<span class="tv-ico">🧳</span></button>' +
      '<button type="button" class="tv-fab tv-cash" id="tvCashBtn" title="旅行花费" aria-label="旅行花费">' +
      '<span class="tv-ico">💰</span><span class="tv-cash-num" id="tvCashNum">¥0</span></button>' +
      '<button type="button" class="tv-plan-btn" id="tvPlanBtn">生成我的攻略</button>';
    document.body.appendChild(bar);

    const mask = document.createElement("div");
    mask.className = "drawer-mask";
    mask.id = "tvDrawerMask";
    mask.innerHTML =
      '<div class="drawer" id="tvDrawer">' +
      '<button class="x-btn" type="button" id="tvDrawerClose">✕</button>' +
      "<h3 id=\"tvDrawerTitle\"></h3>" +
      '<div class="dsub" id="tvDrawerSub"></div>' +
      '<div id="tvDrawerBody"></div></div>';
    document.body.appendChild(mask);

    // plan scene
    const stage = document.querySelector(".stage");
    if (stage && !document.getElementById("scene-plan")) {
      const sec = document.createElement("section");
      sec.className = "scene";
      sec.id = "scene-plan";
      sec.innerHTML =
        '<button class="back-btn" type="button" id="tvPlanBack">← 返回总览</button>' +
        '<div class="detail-scroll"><div class="detail-inner" id="tvPlanInner"></div></div>';
      stage.appendChild(sec);
    }

    document.getElementById("tvPackBtn").onclick = openPackDrawer;
    document.getElementById("tvCashBtn").onclick = openCashDrawer;
    document.getElementById("tvPlanBtn").onclick = openPlan;
    document.getElementById("tvDrawerClose").onclick = closeTvDrawer;
    document.getElementById("tvDrawerMask").onclick = (e) => {
      if (e.target.id === "tvDrawerMask") closeTvDrawer();
    };
    const back = document.getElementById("tvPlanBack");
    if (back) back.onclick = () => {
      document.getElementById("scene-plan").classList.remove("active");
      document.body.classList.remove("tv-plan-open");
      if (typeof goHome === "function") goHome();
    };
  }

  function refreshCash() {
    const { total } = calcTotal();
    const el = document.getElementById("tvCashNum");
    if (el) el.textContent = yen(total);
  }

  function openTvDrawer(title, sub, html) {
    document.getElementById("tvDrawerTitle").textContent = title;
    document.getElementById("tvDrawerSub").textContent = sub || "";
    document.getElementById("tvDrawerBody").innerHTML = html;
    document.getElementById("tvDrawer").classList.remove("tv-drawer-bag");
    document.getElementById("tvDrawerMask").classList.add("on");
  }
  function closeTvDrawer() {
    document.getElementById("tvDrawerMask").classList.remove("on");
    document.getElementById("tvDrawer").classList.remove("tv-drawer-bag");
  }

  function openCashDrawer() {
    const { total, lines } = calcTotal();
    let html =
      '<div class="tv-sum">预计花费合计 <b>' +
      yen(total) +
      "</b></div><p class=\"tv-hint\">勾选各地美食 / 住宿 / 游玩后实时累加；取消「想去此地」则不计入该站。</p>";
    if (!lines.length) {
      html += '<p class="tv-hint">还没有勾选任何付费项目，去地点详情里选选看～</p>';
    } else {
      html += '<ul class="tv-lines">';
      lines.forEach((l) => {
        html +=
          "<li><span class=\"tv-l-k\">" +
          esc(l.place) +
          " · " +
          esc(l.kind) +
          "</span><span class=\"tv-l-n\">" +
          esc(l.name) +
          "</span><span class=\"tv-l-a\">" +
          yen(l.amt) +
          "</span></li>";
      });
      html += "</ul>";
    }
    openTvDrawer("旅行花费", "💰 实时预算明细", html);
  }

  function packIconFor(name) {
    const n = String(name || "");
    const base =
      (D.overview && D.overview.packIconBase) || "media/bali/pack/";
    const hit = (keys) => keys.some((k) => n.includes(k));
    let file = "jacket.png";
    if (hit(["手套"])) file = "gloves.png";
    else if (hit(["头灯"])) file = "lamp.png";
    else if (hit(["面具", "口罩"])) file = "mask.png";
    else if (hit(["登山鞋", "浮潜"])) file = "boots.png";
    else if (hit(["现金", "盾"])) file = "cash.png";
    else if (hit(["泳衣", "泳"])) file = "swim.png";
    else if (hit(["防晒", "SPF"])) file = "sunscreen.png";
    else if (hit(["防水手机", "手机袋"])) file = "drybag.png";
    else if (hit(["防水袋", "防水"])) file = "drybag.png";
    else if (hit(["拖鞋"])) file = "sneakers.png";
    else if (hit(["墨镜"])) file = "glasses.png";
    else if (hit(["驱蚊"])) file = "mosquito.png";
    else if (hit(["运动鞋", "鞋"])) file = "sneakers.png";
    else if (hit(["瑜伽", "速干", "薄长袖", "长袖", "湿巾", "夜店", "穿搭"]))
      file = "jacket.png";
    else if (hit(["冲锋", "外套", "夹克"])) file = "jacket.png";
    else if (hit(["充电宝", "电源"])) file = "power.png";
    else if (hit(["帽"])) file = "hat.png";
    else if (hit(["药", "晕"])) file = "meds.png";
    else if (hit(["护照"])) file = "passport.png";
    return base + file;
  }

  function collectPackItems() {
    const map = {};
    selectedStops().forEach(({ c, i }) => {
      (c.packing || []).forEach((raw, j) => {
        const name = typeof raw === "string" ? raw : raw.name;
        const img =
          (typeof raw === "object" && raw.image) || packIconFor(name);
        if (!map[name]) {
          map[name] = { name, on: false, refs: [], image: img };
        }
        map[name].refs.push({ i, j });
        if (pick[i].pack[j]) map[name].on = true;
      });
    });
    return Object.keys(map)
      .sort()
      .map((k) => map[k]);
  }

  function setPackItemOn(item, on) {
    item.refs.forEach(({ i, j }) => {
      pick[i].pack[j] = on;
    });
    item.on = on;
  }

  function packFillRatio(items) {
    if (!items.length) return 0;
    const on = items.filter((x) => x.on).length;
    return on / items.length;
  }

  function applySuitcaseWeight(stage, ratio) {
    if (!stage) return;
    stage.classList.remove("w0", "w1", "w2", "w3");
    const lvl = ratio < 0.25 ? 0 : ratio < 0.5 ? 1 : ratio < 0.75 ? 2 : 3;
    stage.classList.add("w" + lvl);
    const label = stage.querySelector(".tv-bag-weight");
    if (label) {
      label.textContent =
        lvl === 0
          ? "轻装上阵"
          : lvl === 1
          ? "刚刚好"
          : lvl === 2
          ? "有点沉了"
          : "越来越慢…箱子很沉";
    }
  }

  function flyPackGhost(fromEl, toEl, imgSrc, mode) {
    if (!fromEl || !toEl) return;
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const ghost = document.createElement("div");
    ghost.className = "tv-pack-ghost " + (mode || "in");
    ghost.innerHTML = '<img src="' + esc(imgSrc) + '" alt="">';
    document.body.appendChild(ghost);
    const startX = a.left + a.width / 2;
    const startY = a.top + a.height / 2;
    const endX = b.left + b.width / 2;
    const endY = b.top + b.height / 2;
    if (mode === "out") {
      ghost.style.left = endX + "px";
      ghost.style.top = endY + "px";
      ghost.style.transform = "translate(-50%,-50%) scale(.55)";
      ghost.style.opacity = "1";
      requestAnimationFrame(() => {
        ghost.style.left = startX + "px";
        ghost.style.top = startY - 40 + "px";
        ghost.style.transform = "translate(-50%,-50%) scale(1) rotate(-12deg)";
        ghost.style.opacity = "0";
      });
    } else {
      ghost.style.left = startX + "px";
      ghost.style.top = startY + "px";
      ghost.style.transform = "translate(-50%,-50%) scale(1)";
      ghost.style.opacity = "1";
      requestAnimationFrame(() => {
        ghost.style.left = endX + "px";
        ghost.style.top = endY + "px";
        ghost.style.transform = "translate(-50%,-50%) scale(.45)";
        ghost.style.opacity = "0.15";
      });
    }
    setTimeout(() => ghost.remove(), 620);
  }

  function openPackDrawer() {
    const items = collectPackItems();
    const suitcase =
      (D.overview && D.overview.packSuitcase) ||
      "media/bali/pack/suitcase.png";

    let html =
      '<div class="tv-bag" id="tvBagStage">' +
      '<div class="tv-bag-case" id="tvBagCase">' +
      '<img class="tv-bag-img" src="' +
      esc(suitcase) +
      '" alt="行李箱">' +
      '<div class="tv-bag-pile" id="tvBagPile"></div>' +
      "</div>" +
      '<div class="tv-bag-weight">轻装上阵</div>' +
      '<p class="tv-hint">点物件可勾选 / 取消。取消时会从箱子里「拿出来」；勾得越多，箱子越沉、动得越慢。</p>' +
      "</div>";

    if (!items.length) {
      html +=
        '<p class="tv-hint">先勾选想去的地点，各地详情里的行李项会出现在这里～</p>';
    } else {
      html += '<div class="tv-pack-grid" id="tvPackGrid">';
      items.forEach((it, idx) => {
        html +=
          '<button type="button" class="tv-pack-item' +
          (it.on ? " on" : "") +
          '" data-idx="' +
          idx +
          '">' +
          '<span class="tv-pack-ico"><img src="' +
          esc(it.image) +
          '" alt=""></span>' +
          '<span class="tv-pack-name">' +
          esc(it.name) +
          "</span>" +
          '<span class="tv-pack-tick">' +
          (it.on ? "✓" : "") +
          "</span></button>";
      });
      html += "</div>";
    }

    openTvDrawer("行李清单", "🧳 插画行李箱 · 可勾选调整", html);
    document.getElementById("tvDrawer").classList.add("tv-drawer-bag");

    const stage = document.getElementById("tvBagStage");
    const caseEl = document.getElementById("tvBagCase");
    const pile = document.getElementById("tvBagPile");
    const grid = document.getElementById("tvPackGrid");

    function renderPile() {
      if (!pile) return;
      pile.innerHTML = "";
      items
        .filter((x) => x.on)
        .slice(0, 12)
        .forEach((it, n) => {
          const s = document.createElement("span");
          s.className = "tv-bag-chip";
          s.style.setProperty("--i", String(n));
          s.innerHTML = '<img src="' + esc(it.image) + '" alt="">';
          pile.appendChild(s);
        });
      applySuitcaseWeight(stage, packFillRatio(items));
    }

    renderPile();

    if (grid) {
      grid.querySelectorAll(".tv-pack-item").forEach((btn) => {
        btn.onclick = () => {
          const idx = +btn.dataset.idx;
          const it = items[idx];
          const next = !it.on;
          setPackItemOn(it, next);
          btn.classList.toggle("on", next);
          btn.querySelector(".tv-pack-tick").textContent = next ? "✓" : "";
          if (next) {
            flyPackGhost(btn, caseEl, it.image, "in");
            caseEl && caseEl.classList.add("swallow");
            setTimeout(() => caseEl && caseEl.classList.remove("swallow"), 450);
          } else {
            flyPackGhost(btn, caseEl, it.image, "out");
            caseEl && caseEl.classList.add("spit");
            setTimeout(() => caseEl && caseEl.classList.remove("spit"), 450);
          }
          setTimeout(renderPile, 280);
          // sync detail panel checkboxes if open
          const panel = document.getElementById("travelPanel");
          if (panel && panel.querySelector('[data-k="pack"]')) {
            // soft refresh current detail if any pack rows visible
            panel.querySelectorAll('.tv-check-list li[data-k="pack"]').forEach((li) => {
              const j = +li.dataset.j;
              // find card from visited - use last visited
              const cardIdx = [...visited].pop();
              if (cardIdx == null) return;
              const name =
                (D.cards[cardIdx].packing || [])[j] &&
                (typeof D.cards[cardIdx].packing[j] === "string"
                  ? D.cards[cardIdx].packing[j]
                  : D.cards[cardIdx].packing[j].name);
              if (name !== it.name) return;
              const on = pick[cardIdx].pack[j];
              li.classList.toggle("on", on);
              const box = li.querySelector(".tv-box");
              if (box) box.textContent = on ? "✓" : "";
            });
          }
        };
      });
    }
  }

  // ---- detail panel ----
  function itemThumb(it, key, card) {
    const obj = typeof it === "string" ? { name: it } : it || {};
    const name = obj.name || "";
    if (obj.image) return obj.image;
    if (key === "pack") return packIconFor(name);
    // food / stay / play: prefer sibling comic, then place illustration
    if (card && card.image && /\.png(\?|$)/i.test(card.image)) return card.image;
    return packIconFor(name);
  }

  function renderTravelPanel(cardIdx) {
    const host = document.getElementById("travelPanel");
    if (!host) return;
    const c = D.cards[cardIdx];
    if (!c) {
      host.innerHTML = "";
      return;
    }
    visited.add(cardIdx);

    const block = (title, arr, key, withBudget) => {
      if (!arr || !arr.length) return "";
      let h = '<div class="tv-block"><div class="tv-bh">' + esc(title) + "</div><ul class=\"tv-check-list\">";
      arr.forEach((it, j) => {
        const name = typeof it === "string" ? it : it.name;
        const on = pick[cardIdx][key][j];
        const bud =
          withBudget && typeof it === "object"
            ? '<span class="tv-bud">' +
              yen(itemBudget(it)) +
              (it.nights ? " / " + it.nights + "晚" : "") +
              "</span>"
            : "";
        const note =
          typeof it === "object" && it.note
            ? '<div class="tv-note">' + esc(it.note) + "</div>"
            : "";
        const thumb = itemThumb(it, key, c);
        h +=
          '<li class="' +
          (on ? "on" : "") +
          '" data-k="' +
          key +
          '" data-j="' +
          j +
          '">' +
          '<span class="tv-box">' +
          (on ? "✓" : "") +
          "</span>" +
          (thumb
            ? '<span class="tv-thumb"><img src="' +
              esc(thumb) +
              '" alt="" loading="lazy"></span>'
            : "") +
          '<div class="tv-ci"><div class="tv-cn">' +
          esc(name) +
          bud +
          "</div>" +
          note +
          "</div></li>";
      });
      h += "</ul></div>";
      return h;
    };

    host.innerHTML =
      '<div class="tv-go">' +
      '<label class="tv-go-lab"><input type="checkbox" id="tvGoHere" ' +
      (go[cardIdx] ? "checked" : "") +
      "> 想去此地（计入行程与花费）</label></div>" +
      block("美食推荐", c.food, "food", true) +
      block("住宿推荐", c.stay, "stay", true) +
      block("游玩项目", c.play, "play", true) +
      block("行李清单", (c.packing || []).map((x) => (typeof x === "string" ? { name: x } : x)), "pack", false);

    const goEl = document.getElementById("tvGoHere");
    if (goEl)
      goEl.onchange = () => {
        go[cardIdx] = goEl.checked;
        refreshCash();
      };

    host.querySelectorAll(".tv-check-list li").forEach((li) => {
      li.onclick = () => {
        const k = li.dataset.k;
        const j = +li.dataset.j;
        pick[cardIdx][k][j] = !pick[cardIdx][k][j];
        li.classList.toggle("on", pick[cardIdx][k][j]);
        li.querySelector(".tv-box").textContent = pick[cardIdx][k][j] ? "✓" : "";
        refreshCash();
      };
    });
    refreshCash();
  }

  // ---- personalized plan + map route ----
  function kindLabel(kind) {
    return ({ play: "游玩", food: "美食", stay: "住宿", free: "随性" }[kind] || "");
  }

  function slotHtml(slot, reverse, num) {
    const tags = (slot.tags || [])
      .slice(0, 4)
      .map((t) => '<span class="tv-chip">' + esc(t) + "</span>")
      .join("");
    const bullets = (slot.bullets || [])
      .map((b) => "<li>" + esc(b) + "</li>")
      .join("");
    const side =
      slot.sideVisual
        ? '<div class="tv-slot-side-wrap">' +
          '<div class="tv-slot-side"><img src="' +
          esc(slot.sideVisual) +
          '" alt="" loading="lazy"></div>' +
          '<span class="tv-slot-cap">' +
          esc(slot.sideLabel || "美食") +
          "</span></div>"
        : "";
    return (
      '<article class="tv-slot kind-' +
      esc(slot.kind || "") +
      (reverse ? " reverse" : "") +
      '">' +
      '<div class="tv-slot-copy">' +
      '<div class="tv-slot-meta">' +
      (num
        ? '<span class="tv-slot-num">' + num + "</span>"
        : "") +
      '<span class="tv-slot-pill">' +
      esc(slot.pill) +
      "</span>" +
      (slot.kind
        ? '<span class="tv-slot-kind">' + esc(kindLabel(slot.kind)) + "</span>"
        : "") +
      '<span class="tv-slot-time">' +
      esc(slot.time) +
      "</span></div>" +
      '<h4 class="tv-slot-title">' +
      esc(slot.title) +
      "</h4>" +
      (slot.body
        ? '<p class="tv-slot-body">' + esc(slot.body) + "</p>"
        : "") +
      (bullets ? '<ul class="tv-slot-bullets">' + bullets + "</ul>" : "") +
      (slot.tip
        ? '<div class="tv-tip-box"><span>小贴士</span>' +
          esc(slot.tip) +
          "</div>"
        : "") +
      (tags ? '<div class="tv-chips">' + tags + "</div>" : "") +
      "</div>" +
      '<div class="tv-slot-media">' +
      '<div class="tv-slot-visual">' +
      (slot.visual
        ? '<img src="' + esc(slot.visual) + '" alt="" loading="lazy">'
        : '<div class="tv-slot-ph"></div>') +
      "</div>" +
      '<span class="tv-slot-cap">' +
      esc(slot.pill) +
      " · " +
      esc(slot.title) +
      "</span>" +
      side +
      "</div></article>"
    );
  }

  function dayPageHtml(d) {
    const stop = d.stops[0];
    const theme = stop ? stop.theme : "行程日";
    const tip = (d.stops.map((s) => s.tip).filter(Boolean)[0]) || "";
    const allSlots = [];
    const packing = [];
    d.stops.forEach((st) => {
      (st.slots || []).forEach((s) => allSlots.push(s));
      (st.packing || []).forEach((p) => {
        if (!packing.includes(p)) packing.push(p);
      });
    });

    const itin = allSlots
      .map((s) => s.title)
      .filter(Boolean)
      .slice(0, 6);
    const itinHtml = itin.length
      ? '<div class="tv-itin"><span class="tv-itin-k">行程</span>' +
        itin
          .map((t) => "<em>" + esc(t) + "</em>")
          .join('<span class="tv-itin-sep">→</span>') +
        "</div>"
      : "";

    let slotsHtml = "";
    if (d.stops.length === 1 || allSlots.length <= 4) {
      allSlots.forEach((slot, si) => {
        slotsHtml += slotHtml(slot, si % 2 === 1, si + 1);
      });
    } else {
      const pills = [
        { pill: "上午", time: "09:00 – 12:00" },
        { pill: "下午", time: "14:00 – 17:30" },
        { pill: "晚上", time: "19:00 – 21:30" },
      ];
      d.stops.slice(0, 3).forEach((st, si) => {
        const base = (st.slots && st.slots[0]) || {};
        slotsHtml += slotHtml(
          {
            pill: pills[si].pill,
            time: pills[si].time,
            kind: "play",
            title: st.label || st.place,
            body: st.tip || base.body || "",
            bullets: (st.plays || []).slice(0, 2).map((p) => "游玩 · " + p)
              .concat((st.foods || []).slice(0, 1).map((f) => "美食 · " + f))
              .concat((st.stays || []).slice(0, 1).map((s) => "住宿 · " + s)),
            tip: st.tip || "",
            visual: (st.gallery && st.gallery[0] && st.gallery[0].src) || st.image || base.visual || "",
            tags: ["站点"],
          },
          si % 2 === 1,
          si + 1
        );
      });
    }

    const flow = itin.length ? itin : (stop && stop.flow) || [];
    const flowHtml = flow
      .slice(0, 5)
      .map(
        (f, n) =>
          '<span class="tv-flow-node"><i>' +
          (n + 1) +
          "</i><em>" +
          esc(f) +
          "</em></span>"
      )
      .join('<span class="tv-flow-arrow" aria-hidden="true"></span>');

    const tipsHtml = packing.length
      ? '<div class="tv-day-tips"><div class="tv-day-tips-h">今日行李</div><ul>' +
        packing.map((p) => "<li>✓ " + esc(p) + "</li>").join("") +
        "</ul></div>"
      : tip
      ? '<div class="tv-day-tips"><div class="tv-day-tips-h">小贴士</div><p>' +
        esc(tip) +
        "</p></div>"
      : "";

    return (
      '<section class="tv-day-page">' +
      '<header class="tv-day-ribbon">' +
      '<span class="tv-day-num">DAY ' +
      d.day +
      "</span>" +
      '<h3 class="tv-day-theme">' +
      esc(theme) +
      "</h3>" +
      (tip ? '<p class="tv-day-tip">' + esc(tip) + "</p>" : "") +
      itinHtml +
      "</header>" +
      '<div class="tv-slots">' +
      slotsHtml +
      "</div>" +
      '<footer class="tv-day-foot">' +
      '<div class="tv-day-foot-main">' +
      '<div class="tv-day-foot-h">今日行程小结</div>' +
      '<div class="tv-flow">' +
      flowHtml +
      "</div></div>" +
      tipsHtml +
      "</footer></section>"
    );
  }

  function openPlan() {
    const stops = selectedStops();
    if (!stops.length) {
      openTvDrawer("还不能生成", "", "<p class=\"tv-hint\">请至少勾选一个「想去此地」的地点。</p>");
      return;
    }
    const ordered = orderStops(stops);
    const dayInfo = estimateDays(ordered);
    const dayPlan = buildDayPlan(ordered, dayInfo);
    const { total, lines } = calcTotal();
    const dest = (D.meta && (D.meta.title || D.meta.enTitle)) || "我的行程";

    const sDetail = document.getElementById("scene-detail");
    const sHome = document.getElementById("scene-home");
    const sPlan = document.getElementById("scene-plan");
    if (sDetail) sDetail.classList.remove("active");
    if (sHome) {
      sHome.classList.remove("active");
      sHome.classList.add("zoomed-out");
    }
    sPlan.classList.add("active");
    document.body.classList.add("tv-plan-open");

    const navHtml = dayPlan
      .map(
        (d, idx) =>
          '<button type="button" class="tv-nav-day' +
          (idx === 0 ? " on" : "") +
          '" data-day="' +
          d.day +
          '">D' +
          d.day +
          "</button>"
      )
      .join("");

    let daysHtml = "";
    dayPlan.forEach((d, idx) => {
      daysHtml +=
        '<div class="tv-day-pane' +
        (idx === 0 ? " on" : "") +
        '" id="tvDay' +
        d.day +
        '" data-day="' +
        d.day +
        '">' +
        dayPageHtml(d) +
        "</div>";
    });

    // packing peek
    const bag = {};
    selectedStops().forEach(({ c, i }) => {
      (c.packing || []).forEach((name, j) => {
        if (!pick[i].pack[j]) return;
        const key = typeof name === "string" ? name : name.name;
        bag[key] = true;
      });
    });
    const packKeys = Object.keys(bag).slice(0, 8);
    const packHtml = packKeys.length
      ? '<div class="tv-pack-peek">' +
        packKeys.map((k) => '<span class="tv-chip">' + esc(k) + "</span>").join("") +
        (Object.keys(bag).length > 8
          ? '<span class="tv-chip muted">+' +
            (Object.keys(bag).length - 8) +
            "</span>"
          : "") +
        "</div>"
      : "";

    const routeImg =
      (D.overview && (D.overview.routeImage || D.overview.routeMap)) || "";
    const mapSrc = routeImg || (D.overview && D.overview.image) || "";

    const inner = document.getElementById("tvPlanInner");
    inner.innerHTML =
      '<div class="tv-guide">' +
      '<header class="tv-cover">' +
      '<span class="tv-cover-tag">YOUR TRIP · 图示攻略</span>' +
      "<h2>" +
      esc(dest) +
      "</h2>" +
      '<p class="tv-cover-sub">专属 ' +
      esc(dayInfo.label) +
      " · " +
      ordered.length +
      " 站动线 · 预算约 " +
      yen(total) +
      "</p>" +
      '<div class="tv-cover-stats">' +
      '<div class="tv-stat"><b>' +
      dayInfo.days +
      "</b><span>天</span></div>" +
      '<div class="tv-stat"><b>' +
      dayInfo.nights +
      "</b><span>晚</span></div>" +
      '<div class="tv-stat"><b>' +
      ordered.length +
      "</b><span>站</span></div>" +
      '<div class="tv-stat accent"><b>' +
      yen(total) +
      "</b><span>预算</span></div>" +
      "</div></header>" +
      '<section class="tv-map-wrap' +
      (routeImg ? " baked" : "") +
      '">' +
      '<div class="tv-sec-h"><span>总览路线</span><em>' +
      (routeImg ? "路线已绘入地图" : "按推荐顺序连线") +
      "</em></div>" +
      '<div class="tv-map-stage" id="tvMapStage">' +
      '<img class="tv-map-img" id="tvMapImg" alt="route map">' +
      '<svg class="tv-route" id="tvRouteSvg" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>' +
      '<div class="tv-map-pins" id="tvMapPins"></div></div>' +
      '<div class="tv-map-legend" id="tvMapLegend"></div></section>' +
      '<nav class="tv-day-nav" id="tvDayNav" aria-label="按日切换">' +
      navHtml +
      "</nav>" +
      '<div class="tv-days" id="tvDays">' +
      daysHtml +
      "</div>" +
      '<section class="tv-guide-end">' +
      '<div class="tv-sec-h"><span>花费与行李</span><em>勾选项目汇总</em></div>' +
      '<div class="tv-end-grid">' +
      '<div class="tv-end-card"><div class="tv-bh">预算合计</div>' +
      '<div class="tv-sum"><b>' +
      yen(total) +
      "</b></div>" +
      '<p class="tv-hint">' +
      lines.length +
      " 个已选项目 · 可点右上💰看明细</p></div>" +
      '<div class="tv-end-card"><div class="tv-bh">行李速览</div>' +
      (packHtml || '<p class="tv-hint">暂无行李项，点左上🧳汇总</p>') +
      "</div></div>" +
      '<p class="tv-guide-sign">慢悠悠晃着吃逛 · 不必赶行程</p>' +
      "</section></div>";

    const img = document.getElementById("tvMapImg");
    img.src = mapSrc;
    // 已绘入路线的地图：只保留图例，不再叠 SVG 连线 / 数字钉
    const paintOverlay = !routeImg;
    img.onload = () => drawRoute(ordered, { overlay: paintOverlay });
    if (img.complete) drawRoute(ordered, { overlay: paintOverlay });

    // 按日切换：一次只显示一天
    const showDay = (day) => {
      inner.querySelectorAll(".tv-nav-day").forEach((btn) => {
        btn.classList.toggle("on", String(btn.dataset.day) === String(day));
      });
      inner.querySelectorAll(".tv-day-pane").forEach((pane) => {
        pane.classList.toggle("on", String(pane.dataset.day) === String(day));
      });
      const nav = document.getElementById("tvDayNav");
      if (nav) {
        const scroll = document.querySelector("#scene-plan .detail-scroll");
        if (scroll) {
          const top =
            nav.getBoundingClientRect().top -
            scroll.getBoundingClientRect().top +
            scroll.scrollTop -
            8;
          scroll.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        }
      }
    };
    inner.querySelectorAll(".tv-nav-day").forEach((btn) => {
      btn.onclick = () => showDay(btn.dataset.day);
    });

    // 攻略生成后：根据勾选编译「行李/待办清单」（不是页上写死的）
    appendPlanActionCta(ordered, dayInfo, total);
  }

  /** 从用户勾选状态编译个性化行动清单 */
  function collectPersonalizedActionList() {
    const stops = selectedStops();
    if (!stops.length) return null;

    const ordered = orderStops(stops);
    const dayInfo = estimateDays(ordered);
    const { total } = calcTotal();
    const dest = (D.meta && (D.meta.title || D.meta.enTitle)) || "我的行程";
    const items = [];
    const seen = new Set();
    const push = (text, tag) => {
      const t = String(text || "").trim();
      if (!t || seen.has(t)) return;
      seen.add(t);
      items.push({ text: t, tag: tag || "行动", done: false });
    };

    push(
      "确认行程：" +
        ordered.map(({ c }) => c.name || c.label).join(" → ") +
        "（" +
        dayInfo.label +
        "）",
      "行程"
    );

    ordered.forEach(({ c, i }) => {
      (c.stay || []).forEach((it, j) => {
        if (!pick[i].stay[j]) return;
        const nights = it.nights != null ? it.nights + "晚 · " : "";
        push(
          "预订：" +
            (c.name || c.label) +
            " · " +
            it.name +
            (nights ? "（" + nights.trim() + "）" : ""),
          "预订"
        );
      });
    });

    ordered.forEach(({ c, i }) => {
      (c.food || []).forEach((it, j) => {
        if (!pick[i].food[j]) return;
        push("打卡美食：" + it.name + " @ " + (c.name || c.label), "美食");
      });
      (c.play || []).forEach((it, j) => {
        if (!pick[i].play[j]) return;
        push("体验：" + it.name + " @ " + (c.name || c.label), "游玩");
      });
    });

    // 行李：只收「想去站点」且勾选中的装箱项
    ordered.forEach(({ c, i }) => {
      (c.packing || []).forEach((raw, j) => {
        if (!pick[i].pack[j]) return;
        const name = typeof raw === "string" ? raw : raw && raw.name;
        const note = typeof raw === "object" && raw ? raw.note : "";
        if (!name) return;
        push(note ? "装箱：" + name + "（" + note + "）" : "装箱：" + name, "行李");
      });
    });

    if (total > 0) {
      push("按预算约 " + yen(total) + " 准备现金/换汇", "出行");
    }

    if (items.length < 2) return null;

    return {
      title: dest.replace(/保姆级|自由行/g, "").trim() + " · 行李与待办清单",
      subtitle:
        dayInfo.label +
        " · " +
        ordered.length +
        " 站 · 根据你勾选的地点/住宿/行李生成",
      category: "travel",
      personalized: true,
      sourcePage: D.meta && D.meta.title,
      items,
    };
  }

  function appendPlanActionCta(ordered, dayInfo, total) {
    const inner = document.getElementById("tvPlanInner");
    if (!inner || document.getElementById("tvActionCta")) return;
    const wrap = document.createElement("section");
    wrap.id = "tvActionCta";
    wrap.className = "tv-action-cta";
    wrap.innerHTML =
      '<div class="tv-action-cta-inner">' +
      '<div class="tv-sec-h"><span>下一步：行动清单</span><em>由你的勾选实时编译</em></div>' +
      "<p class=\"tv-hint\">攻略看完还不够——把「要订的房、要装的行李、要点的美食」收成一张可打勾的小票，马上行动。</p>" +
      '<button type="button" class="tv-action-btn" id="tvGenActionList">生成我的行李 / 待办清单</button>' +
      '<div class="tv-action-sub" id="tvActionSub">将汇总：' +
      ordered.length +
      " 站 · " +
      dayInfo.label +
      (total ? " · 预算约 " + yen(total) : "") +
      "</div></div>";
    inner.appendChild(wrap);
    document.getElementById("tvGenActionList").onclick = () => {
      const list = collectPersonalizedActionList();
      if (!list) {
        openTvDrawer(
          "还不能生成清单",
          "",
          '<p class="tv-hint">请先勾选「想去此地」、住宿或行李项，再生成。</p>'
        );
        return;
      }
      if (typeof window.__huozhongUnlockActionList === "function") {
        window.__huozhongUnlockActionList(list, { open: true });
      } else if (typeof window.__huozhongSetActionList === "function") {
        window.__huozhongSetActionList(list);
      }
    };
  }

  // 注册交互收集器：行动清单运行时优先用勾选结果，不用写死文案
  window.__huozhongInteractionCollectors =
    window.__huozhongInteractionCollectors || [];
  window.__huozhongInteractionCollectors.push(collectPersonalizedActionList);

  function smoothPath(pts) {
    if (!pts.length) return "";
    if (pts.length === 1) return "M " + pts[0][0] + " " + pts[0][1];
    if (pts.length === 2) {
      return (
        "M " +
        pts[0][0] +
        " " +
        pts[0][1] +
        " L " +
        pts[1][0] +
        " " +
        pts[1][1]
      );
    }
    // Catmull-Rom → cubic Bezier（沿途顺序平滑，不往地图中心乱折）
    let d = "M " + pts[0][0] + " " + pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      d +=
        " C " +
        cp1x +
        " " +
        cp1y +
        " " +
        cp2x +
        " " +
        cp2y +
        " " +
        p2[0] +
        " " +
        p2[1];
    }
    return d;
  }

  function drawRoute(ordered, opts) {
    const svg = document.getElementById("tvRouteSvg");
    const pins = document.getElementById("tvMapPins");
    const legend = document.getElementById("tvMapLegend");
    if (!svg || !pins) return;
    pins.innerHTML = "";
    svg.innerHTML = "";
    if (legend) legend.innerHTML = "";

    const overlay = !opts || opts.overlay !== false;

    ordered.forEach(({ c }, n) => {
      if (overlay) {
        const p = document.createElement("div");
        p.className = "tv-map-pin";
        p.style.left = (c.x || 50) + "%";
        p.style.top = (c.y || 50) + "%";
        p.innerHTML = '<span class="tv-map-num">' + (n + 1) + "</span>";
        pins.appendChild(p);
      }
      if (legend) {
        legend.innerHTML +=
          '<span class="tv-leg-item"><i>' +
          (n + 1) +
          "</i>" +
          esc(c.label || c.name) +
          "</span>";
      }
    });

    if (!overlay) return;

    const pts = ordered.map(({ c }) => [
      Number(c.x) || 50,
      Number(c.y) || 50,
    ]);
    const d = smoothPath(pts);
    svg.innerHTML =
      '<defs><marker id="tvArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">' +
      '<path d="M 1 1 L 9 5 L 1 9 z" fill="var(--accent)" opacity=".85"/></marker></defs>' +
      (d
        ? '<path class="tv-route-soft" d="' +
          d +
          '" fill="none"/>' +
          '<path class="tv-route-line" d="' +
          d +
          '" fill="none" marker-end="url(#tvArrow)"/>'
        : "");
  }

  // ---- hook openDetail ----
  const _open = window.openDetail;
  window.openDetail = function (i) {
    if (typeof _open === "function") _open(i);
    setTimeout(() => renderTravelPanel(i), 0);
  };

  ensureChrome();
  refreshCash();
  document.body.classList.add("travel-mode");
})();
