/**
 * Flipbook → 行动清单
 *
 * 清单必须来自「用户与网页交互后的个性化结果」，不是页上写死的静态待办。
 * 流程：点选交互 → 编译清单 → 存 App 行动库 / 打印小票
 */
(function () {
  const D = window.FLIPBOOK;
  if (!D || !D.meta) return;

  const MSG = "huozhong:action-list";
  let unlocked = false;
  let state = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function normalize(list) {
    return {
      title: list.title || (D.meta.title || "行动") + " · 行动清单",
      subtitle: list.subtitle || "",
      category: list.category || "general",
      personalized: !!list.personalized,
      sourcePage: list.sourcePage || D.meta.title || "",
      sourceUrl: (D.meta.sourceVideo && D.meta.sourceVideo.url) || "",
      inputMode: D.meta.inputMode || (D.meta.sources ? "multi" : "single"),
      items: (list.items || [])
        .map((it, i) => ({
          id: "ai_" + i,
          text: typeof it === "string" ? it : it.text || it.name || "",
          tag: (typeof it === "object" && it.tag) || "行动",
          done: !!(typeof it === "object" && it.done),
          priority: (typeof it === "object" && it.priority) || i + 1,
        }))
        .filter((x) => x.text),
    };
  }

  /** 优先：各业务模块注册的交互收集器（旅行勾选 / 菜谱「我已有」等） */
  function collectFromInteraction() {
    const collectors = window.__huozhongInteractionCollectors || [];
    for (let i = collectors.length - 1; i >= 0; i--) {
      try {
        const list = collectors[i]();
        if (list && list.items && list.items.length) return normalize(list);
      } catch (e) {
        /* ignore broken collector */
      }
    }
    return null;
  }

  function categoryHint() {
    const theme = D.meta.theme;
    const cat = (D.meta.actionList && D.meta.actionList.category) || "";
    if (theme === "travel" || cat === "travel") {
      return "旅行：先勾选想去的地点 / 住宿 / 行李，点「生成我的攻略」后再生成行李与待办清单。";
    }
    if (cat === "recipe" || theme === "building") {
      return "美食：在食谱里调人数、勾选「我已有」的食材，再生成采购清单。";
    }
    if (cat === "fitness") return "健身：先选训练部位与组数，再生成训练计划清单。";
    if (cat === "beauty") return "美妆：先选妆容步骤与商品，再生成练习与购买清单。";
    if (cat === "study") return "课程：先点选要掌握的知识点，再生成学习清单。";
    return "请先在网页里完成点选个性化，再生成属于你的行动清单。";
  }

  function injectStyle() {
    if (document.getElementById("hz-al-style")) return;
    const s = document.createElement("style");
    s.id = "hz-al-style";
    s.textContent = `
      .hz-al-fab{
        position:fixed;right:14px;bottom:calc(18px + env(safe-area-inset-bottom,0px));
        z-index:240;border:0;border-radius:999px;padding:12px 16px;
        background:rgba(31,58,74,.42);color:rgba(255,255,255,.88);
        font:700 13px "Noto Sans SC","PingFang SC",system-ui,sans-serif;
        box-shadow:0 10px 28px rgba(31,58,74,.22);cursor:pointer;
        backdrop-filter:blur(12px) saturate(1.2);
        -webkit-backdrop-filter:blur(12px) saturate(1.2);
        border:1px solid rgba(255,255,255,.28);
      }
      .hz-al-fab.ready{
        background:linear-gradient(160deg,#2f5168,#1a3350 55%,#122636);color:#fff;
        box-shadow:0 12px 28px -10px rgba(26,51,80,.5);
      }
      body.embed .hz-al-fab{bottom:calc(72px + env(safe-area-inset-bottom,0px))}
      body.travel-mode.embed .hz-al-fab{bottom:calc(72px + env(safe-area-inset-bottom,0px))}
      body.tv-plan-open .hz-al-fab{bottom:calc(18px + env(safe-area-inset-bottom,0px))}
      .hz-al-mask{
        position:fixed;inset:0;z-index:250;background:rgba(21,42,54,.42);
        display:none;align-items:flex-end;justify-content:center;
      }
      .hz-al-mask.on{display:flex}
      .hz-al-sheet{
        width:min(480px,100%);max-height:78dvh;overflow:auto;
        background:#f2f4f7;color:#1a3350;border-radius:22px 22px 0 0;
        padding:14px 16px calc(16px + env(safe-area-inset-bottom,0px));
        font-family:"Noto Sans SC","PingFang SC",system-ui,sans-serif;
        box-shadow:0 -18px 40px -16px rgba(31,58,74,.28);
      }
      .hz-al-sheet h3{font-family:inherit;font-size:17px;font-weight:800;letter-spacing:-.02em;margin:4px 0 4px}
      .hz-al-sub{font-size:12px;color:#7a8690;margin-bottom:12px;line-height:1.5}
      .hz-al-empty{font-size:13px;line-height:1.55;color:#7a8690;padding:8px 4px 16px}
      .hz-al-item{
        display:flex;gap:10px;align-items:flex-start;padding:10px 8px;
        border:1px solid #d5dee8;border-radius:14px;background:#fff;margin-bottom:8px;cursor:pointer;
      }
      .hz-al-item.on{background:#e8f0f6;border-color:#9bb4c8}
      .hz-al-item.on .hz-al-tx{text-decoration:line-through;color:#7a8690}
      .hz-al-box{
        width:18px;height:18px;border:1.5px solid #1f3a4a;border-radius:5px;flex:none;
        display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;margin-top:1px;
      }
      .hz-al-item.on .hz-al-box{background:#1f3a4a}
      .hz-al-tx{font-size:14px;line-height:1.4;flex:1}
      .hz-al-tag{font-size:10px;color:#7a8690;background:#e8eef4;padding:2px 6px;border-radius:6px}
      .hz-al-actions{display:flex;gap:8px;margin-top:12px}
      .hz-al-actions button{
        flex:1;border:0;border-radius:14px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;
      }
      .hz-al-actions button:disabled{opacity:.35;cursor:not-allowed}
      .hz-al-save{background:linear-gradient(160deg,#2f5168,#1a3350);color:#fff}
      .hz-al-print{background:#3d6a82;color:#fff}
      .hz-al-close{background:transparent;border:0;float:right;font-size:16px;cursor:pointer;color:#7a8690}
      @media print{
        body *{visibility:hidden!important}
        .hz-al-print-root,.hz-al-print-root *{visibility:visible!important}
        .hz-al-print-root{position:absolute;left:0;top:0;width:100%;padding:12px;font-family:monospace}
      }
    `;
    document.head.appendChild(s);
  }

  function setFabReady(on) {
    const fab = document.getElementById("hz-al-fab");
    if (!fab) return;
    fab.classList.toggle("ready", !!on);
    fab.textContent = on ? "行动清单 ✓" : "行动清单";
    fab.title = on ? "查看你的个性化清单" : "先完成网页点选后再生成";
  }

  function renderSheetBody() {
    const box = document.getElementById("hz-al-items");
    const sub = document.getElementById("hz-al-sub");
    const title = document.getElementById("hz-al-title");
    const save = document.getElementById("hz-al-save");
    const print = document.getElementById("hz-al-print");
    if (!box) return;

    if (!state || !state.items.length) {
      if (title) title.textContent = "还没有你的行动清单";
      if (sub) sub.textContent = "";
      box.innerHTML = `<div class="hz-al-empty">${esc(categoryHint())}</div>`;
      if (save) save.disabled = true;
      if (print) print.disabled = true;
      return;
    }

    if (title) title.textContent = state.title;
    if (sub)
      sub.textContent =
        (state.subtitle || "") +
        (state.personalized ? " · 已按你的勾选个性化" : "");
    box.innerHTML = state.items
      .map(
        (it, i) =>
          `<div class="hz-al-item${it.done ? " on" : ""}" data-i="${i}">
            <span class="hz-al-box">${it.done ? "✓" : ""}</span>
            <span class="hz-al-tx">${esc(it.text)}</span>
            <span class="hz-al-tag">${esc(it.tag)}</span>
          </div>`
      )
      .join("");
    if (save) save.disabled = false;
    if (print) print.disabled = false;
  }

  function openSheet() {
    // 每次打开都尝试从最新交互状态编译
    const live = collectFromInteraction();
    if (live) {
      state = live;
      unlocked = true;
      setFabReady(true);
    }
    renderSheetBody();
    document.getElementById("hz-al-mask")?.classList.add("on");
  }

  function closeSheet() {
    document.getElementById("hz-al-mask")?.classList.remove("on");
  }

  function payload() {
    return JSON.parse(JSON.stringify(state));
  }

  function post(action) {
    if (!state || !state.items.length) return false;
    const data = { type: MSG, action: action, payload: payload() };
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(data, "*");
      return true;
    }
    return false;
  }

  function onSave() {
    if (!state || !state.items.length) return;
    if (!post("save")) {
      try {
        const key = "huozhong_action_lists_v1";
        const prev = JSON.parse(localStorage.getItem(key) || "[]");
        prev.unshift(
          Object.assign(
            { id: "al_" + Date.now(), createdAt: Date.now(), updatedAt: Date.now() },
            payload()
          )
        );
        localStorage.setItem(key, JSON.stringify(prev.slice(0, 40)));
        alert("已暂存到本机行动清单库（独立预览模式）");
      } catch (e) {
        alert("保存失败");
      }
    }
    closeSheet();
  }

  function onPrint() {
    if (!state || !state.items.length) return;
    if (!post("print")) {
      let root = document.getElementById("hz-al-print-root");
      if (!root) {
        root = document.createElement("div");
        root.id = "hz-al-print-root";
        root.className = "hz-al-print-root";
        document.body.appendChild(root);
      }
      root.innerHTML =
        `<h2>${esc(state.title)}</h2>` +
        (state.subtitle ? `<p>${esc(state.subtitle)}</p>` : "") +
        `<ol>${state.items.map((it) => `<li>[ ] ${esc(it.text)}</li>`).join("")}</ol>` +
        `<p style="margin-top:16px;font-size:11px">火种 · 个性化行动清单</p>`;
      window.print();
    }
    closeSheet();
  }

  /** 业务页在用户完成个性化后调用：解锁并可选直接打开 */
  window.__huozhongUnlockActionList = function (list, opts) {
    state = normalize(list || {});
    if (!state.items.length) return;
    unlocked = true;
    setFabReady(true);
    if (opts && opts.open) openSheet();
  };

  window.__huozhongSetActionList = window.__huozhongUnlockActionList;
  window.__huozhongGetActionList = function () {
    return state ? JSON.parse(JSON.stringify(state)) : null;
  };
  window.__huozhongBuildActionList = collectFromInteraction;

  function mount() {
    injectStyle();
    if (document.getElementById("hz-al-fab")) return;

    const fab = document.createElement("button");
    fab.type = "button";
    fab.id = "hz-al-fab";
    fab.className = "hz-al-fab";
    fab.textContent = "行动清单";
    fab.title = "先完成网页点选后再生成";
    fab.onclick = openSheet;
    document.body.appendChild(fab);

    const mask = document.createElement("div");
    mask.id = "hz-al-mask";
    mask.className = "hz-al-mask";
    mask.innerHTML = `
      <div class="hz-al-sheet" role="dialog" aria-label="行动清单">
        <button type="button" class="hz-al-close" id="hz-al-x">✕</button>
        <h3 id="hz-al-title">行动清单</h3>
        <div class="hz-al-sub" id="hz-al-sub"></div>
        <div id="hz-al-items"></div>
        <div class="hz-al-actions">
          <button type="button" class="hz-al-save" id="hz-al-save" disabled>存入 App 行动库</button>
          <button type="button" class="hz-al-print" id="hz-al-print" disabled>打印小票</button>
        </div>
      </div>`;
    document.body.appendChild(mask);

    mask.addEventListener("click", (e) => {
      if (e.target === mask) closeSheet();
    });
    document.getElementById("hz-al-x").onclick = closeSheet;
    document.getElementById("hz-al-save").onclick = onSave;
    document.getElementById("hz-al-print").onclick = onPrint;
    document.getElementById("hz-al-items").onclick = (e) => {
      const row = e.target.closest(".hz-al-item");
      if (!row || !state) return;
      const i = +row.dataset.i;
      if (!state.items[i]) return;
      state.items[i].done = !state.items[i].done;
      renderSheetBody();
    };

    // 若交互收集器已能产出（例如默认勾选已足够），不自动解锁——仍等用户点「生成」
    // 避免一进页就当成写死清单
    void unlocked;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
