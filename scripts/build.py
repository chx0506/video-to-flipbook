#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Flipbook 生成器雏形
-------------------
把「视频分析结果(JSON)」+「通用模板(HTML)」→ 成品可交互图鉴页面。

数据来源 — 两种输入,同一套 JSON/HTML 输出:
    Mode A 单视频:  1 条视频/片段 → analyze → data_*.json
    Mode B 多视频:  N 条灵感片段(≥2 独立来源) → 去重/关系梳理 → 同一 schema
    下游相同: art handshake → build → out_*.html
详见 references/multi-video.md 与 SKILL.md「Input layer」。
本脚本用 analyze_video() 占位分析步骤(当前直接读取预生成的分析结果 JSON)。

用法:
    python3 build.py data_yingxian.json  -> 生成 out_yingxian.html
    python3 build.py --all               -> 批量生成目录下所有 data_*.json
    python3 build.py --gen-prompts [f]   -> 只打印待出图节点的完整提示词
    python3 build.py --auto [f]          -> 一键:数据→出图→成页(两段式握手)
"""
import json, sys, os, glob, re
from art_recipe import build_prompt, collect_prompts, STYLE_BASE, HARD_CONSTRAINTS

BASE = os.path.dirname(os.path.abspath(__file__))
# Template lives in ../assets/ (sibling of scripts/). Fall back to BASE so the
# script still works if the template is dropped right next to build.py.
_tpl_assets = os.path.join(os.path.dirname(BASE), "assets", "flipbook_template.html")
TEMPLATE = _tpl_assets if os.path.exists(_tpl_assets) else os.path.join(BASE, "flipbook_template.html")
PLACEHOLDER = "/*__FLIPBOOK_DATA__*/"

# ============ 数据 Schema(视频分析产出物的契约) ============
SCHEMA = """
{
  "meta": {
    "title":     "页面主标题(必填)",
    "enTitle":   "英文副标题(可选)",
    "subtitle":  "首页副标题一句话(可选)",
    "theme":     "配色主题: travel | building | art | dark",
    "hint":      "首页右上角操作提示",
    "footer":    "首页底部一句话点题",
    "inputMode": "single | multi(多灵感片段综合)",
    "sourceVideo": {"title":"来源视频标题","url":"视频链接","duration":"时长","author":"作者","scope":"full-video|selected-clips","ranges":[{"start":"mm:ss","end":"mm:ss"}],"restTldr":"未选部分摘要"},
    "task": "多源时的用户任务",
    "sources": [{"sourceId":"…","title":"…","url":"…","scope":"…","ranges":[],"note":"…","restTldr":"…"}],
    "relations": [{"type":"complement","summary":"…","sourceIds":["a","b"]}]
  },
  "overview": {
    "image":       "总览大图 URL(手绘插画)。若留空并提供 imagePrompt,则由出图配方生成",
    "imagePrompt": "【可选】只写画什么主体,风格由 art_recipe 自动包装(零文字/莫兰迪/纸底)",
    "factsTitle": "数据卡标题",
    "factsSide":  "left | right",
    "facts":      [{"k":"字段名","v":"字段值"}],
    "widget":     "【可选】总览级互动组件(点首页按钮弹出)。见下方 WIDGET 说明,常用 route/timeline"
  },
  "cards": [
    {
      "x": 52, "y": 22,          # 热点在总览图上的百分比坐标
      "label": "热点悬浮提示",
      "tag":   "分类标签",
      "name":  "详情标题",
      "en":    "英文名",
      "image": "详情大图 URL(缺省用总览图)",
      "imagePrompt": "【可选】详情图主体描述,配方自动补全风格",
      "desc":  "详情首段导语",
      "meta":  [["键","值"]],   # 右侧结构化信息行
      "note":  "底部一句私藏建议/要点",
      "sourceId": "v_altman",           # Mode B: 卡片对应的父视频
      "clip":  {"start":"03:12","end":"05:40"},  # ← 对应视频重点片段时间戳(可溯源)
      "annotations": [          # 【可选,推荐】图解标注:在详情插画上叠加带引线的标签,指向画面具体部位(参考青岛栈桥/教堂图)
        {"t":"标注标题","d":"一句说明","ax":62,"ay":30,"side":"left"}
        # ax/ay = 锚点在插画上的百分比坐标; side = 气泡相对锚点方向 left|right|top|bottom
      ],
      "body":  [                 # 【可选】富内容区块,让图解不再单薄。按顺序渲染,类型任意组合:
        {"h":"小标题","type":"para","text":["段落1","段落2"]},
        {"h":"要点","type":"list","items":["要点a","要点b"]},
        {"h":"信息","type":"table","rows":[["键","值"]]},
        {"type":"tips","h":"注意事项","items":["坑1","坑2"]},
        {"h":"预算","type":"budget","cols":["项目","金额"],"rows":[["机票","1500"]],"total":["合计","约 X"]},
        {"h":"物品清单","type":"checklist","items":["护照","防晒霜"]}  # 可勾选
      ],
      "realPhotos": [            # 【可选】视频实拍图,与 AI 插画并列供参考,点击放大
        {"url":"帧图URL","cap":"图注"}
      ],
      "widget": "【可选】卡片级互动组件,见下方 WIDGET 说明"
    }
  ]
}

# ===== WIDGET 组件规格(overview.widget 或 cards[i].widget)=====
#  timeline  时间轴(历史类): {"type":"timeline","title":"…","events":[{"year":"1056","title":"…","desc":"…"}]}
#  stepper   分步教程(教程类): {"type":"stepper","title":"…","steps":[{"title":"…","detail":"…","tip":"…"}]}
#  recipe    菜谱计算器(美食类): {"type":"recipe","title":"…","baseServings":2,
#              "ingredients":[{"name":"番茄","qty":2,"unit":"个"}],"hint":"勾选'我已有'自动剔除"}
#            → 用户调人数,用量按比例换算;勾选已有食材自动划掉
#  route     路线规划器(旅行类,建议放 overview.widget): {"type":"route","title":"…","button":"规划我的路线",
#              "stops":[{"name":"南部","tag":"玩海","stay":"2 天","tip":"住海边","moveNext":"飞行 1h→乌布"}]}
#            → 用户勾选想去的点,一键生成带停留时长与转场的专属动线
"""

REQUIRED_META = ["title"]
REQUIRED_TOP  = ["meta", "overview", "cards"]


def analyze_video(video_path_or_url):
    """
    【占位】视频 → 结构化数据。
    真实实现:抽帧 + 字幕转写 + LLM 按 SCHEMA 结构化输出。
    当前雏形:若传入的是已分析好的 *.json 就直接加载。
    """
    if str(video_path_or_url).endswith(".json") and os.path.exists(video_path_or_url):
        with open(video_path_or_url, "r", encoding="utf-8") as f:
            return json.load(f)
    raise NotImplementedError(
        "真实视频分析尚未接入。请传入已分析好的 data_*.json,"
        "或在此处接入 [下载→转写→LLM结构化] 链路。"
    )


def validate(data):
    """最小化校验,保证数据能喂进模板。"""
    errs = []
    for k in REQUIRED_TOP:
        if k not in data:
            errs.append(f"缺少顶层字段: {k}")
    if "meta" in data:
        for k in REQUIRED_META:
            if k not in data["meta"]:
                errs.append(f"meta 缺少必填字段: {k}")
    if "cards" in data and not isinstance(data["cards"], list):
        errs.append("cards 必须是数组")
    for i, c in enumerate(data.get("cards", [])):
        for k in ("x", "y", "label"):
            if k not in c:
                errs.append(f"cards[{i}] 缺少字段: {k}")
    return errs


def _wants_travel_planner(data):
    if (data.get("meta") or {}).get("theme") == "travel":
        return True
    for c in data.get("cards") or []:
        if c.get("food") or c.get("stay") or c.get("play") or c.get("packing"):
            return True
    return False


def _inject_script(html, js_path):
    if not os.path.exists(js_path):
        return html
    with open(js_path, "r", encoding="utf-8") as f:
        js = f.read()
    return html.replace("</body>", "<script>\n" + js + "\n</script>\n</body>")


def build(data, out_path):
    with open(TEMPLATE, "r", encoding="utf-8") as f:
        tpl = f.read()
    injected = "window.FLIPBOOK = " + json.dumps(data, ensure_ascii=False, indent=2) + ";"
    html = tpl.replace(PLACEHOLDER, injected)
    assets_dir = os.path.dirname(TEMPLATE)
    if _wants_travel_planner(data):
        html = _inject_script(html, os.path.join(assets_dir, "travel_planner.js"))
    # 每页必出行动清单（存 App / 打印）
    html = _inject_script(html, os.path.join(assets_dir, "action_list.js"))
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    return out_path


def run_one(data_source):
    data = analyze_video(data_source)          # ① 视频 → 数据
    errs = validate(data)                      # ② 校验契约
    if errs:
        print(f"  ✗ 校验失败 {data_source}:")
        for e in errs:
            print("     -", e)
        return None
    stem = os.path.splitext(os.path.basename(data_source))[0].replace("data_", "")
    out_dir = os.path.dirname(os.path.abspath(data_source))
    out = os.path.join(out_dir, f"out_{stem}.html")
    build(data, out)                           # ③ 数据 + 模板 → 页面
    n_cards = len(data.get("cards", []))
    print(f"  ✓ {os.path.basename(data_source)}  →  out_{stem}.html"
          f"  (主题:{data['meta'].get('theme','travel')} · {n_cards} 个热点)")
    return out


def gen_prompts(data_source):
    """扫描一份数据,打印所有待出图节点的完整提示词(供出图工具调用)。"""
    data = analyze_video(data_source)
    prompts = collect_prompts(data)
    if not prompts:
        print(f"  · {os.path.basename(data_source)}:无待出图节点"
              "(所有图已有 image URL,或未提供 imagePrompt)")
        return []
    print(f"  {os.path.basename(data_source)} 需出图 {len(prompts)} 张:")
    for p in prompts:
        print(f"\n  ▸ [{p['slot']}]")
        print(f"    主体: {p['subject']}")
        print(f"    完整提示词: {p['prompt']}")
    return prompts


def _set_image_by_key(data, key, url):
    """按 collect_prompts 产出的稳定 key,把 URL 写回对应节点的 image 字段。
       key 形如 'overview' 或 'cards[3]'。"""
    if key == "overview":
        data.setdefault("overview", {})["image"] = url
        return True
    m = re.fullmatch(r"cards\[(\d+)\]", key)
    if m:
        i = int(m.group(1))
        cards = data.get("cards", [])
        if 0 <= i < len(cards):
            cards[i]["image"] = url
            return True
    return False


def auto_one(data_source):
    """一键编排:数据 → 出图 → 成页。采用两段式握手,因为出图是 Agent 工具,
       纯 Python 脚本不能直接调用(且平台策略禁止脚本直连模型网关)。

    第一段(缺图):扫描待出图节点 → 写出提示词清单 {stem}_prompts.json → 暂停,
                  提示 Agent 用出图工具生成、并把 {key: url} 写进 {stem}_images.json。
    第二段(回填):检测到 {stem}_images.json → 把 URL 回填进 data → 校验 → 成页。
    """
    stem = os.path.splitext(os.path.basename(data_source))[0].replace("data_", "")
    out_dir = os.path.dirname(os.path.abspath(data_source))
    prompts_path = os.path.join(out_dir, f"{stem}_prompts.json")
    images_path  = os.path.join(out_dir, f"{stem}_images.json")

    data = analyze_video(data_source)
    errs = validate(data)
    if errs:
        print(f"  ✗ 校验失败 {data_source}:")
        for e in errs:
            print("     -", e)
        return None

    pending = collect_prompts(data)

    # 第二段:已有出图结果 → 回填 + 成页
    if os.path.exists(images_path):
        with open(images_path, "r", encoding="utf-8") as f:
            mapping = json.load(f)
        n_ok = 0
        for key, url in mapping.items():
            if url and _set_image_by_key(data, key, url):
                n_ok += 1
        # 回填后落盘,让 data 文件本身也带上 URL(下次直接成页)
        with open(data_source, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        out = run_one(data_source)
        # 清理握手中间文件
        for p in (prompts_path, images_path):
            if os.path.exists(p):
                os.remove(p)
        print(f"  ✓ 已回填 {n_ok} 张图并成页,握手文件已清理。")
        return out

    # 无待出图节点 → 直接成页
    if not pending:
        print(f"  · {os.path.basename(data_source)}:无待出图节点,直接成页。")
        return run_one(data_source)

    # 第一段:写出提示词清单,暂停等待 Agent 出图
    manifest = [{"key": p["key"], "slot": p["slot"],
                 "subject": p["subject"], "prompt": p["prompt"]} for p in pending]
    with open(prompts_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"  ⏸ {os.path.basename(data_source)} 待出图 {len(manifest)} 张。")
    print(f"     已写出提示词清单: {os.path.basename(prompts_path)}")
    print(f"     下一步(交给出图工具):按 prompt 逐张出图,把结果按 {{key: url}} 写入")
    print(f"     {os.path.basename(images_path)},然后重跑:  python3 build.py --auto {os.path.basename(data_source)}")
    print(f"     待出图 key: {[m['key'] for m in manifest]}")
    return None


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        print("数据 Schema:", SCHEMA)
        print("出图配方骨架:\n  STYLE:", STYLE_BASE, "\n  约束:", HARD_CONSTRAINTS)
        return
    # 出图配方:输出每张图的完整提示词
    if args[0] == "--gen-prompts":
        srcs = sorted(glob.glob(os.path.join(os.getcwd(), "data_*.json"))) if len(args) < 2 else args[1:]
        print(f"共 {len(srcs)} 份数据,生成出图提示词:")
        for s in srcs:
            gen_prompts(s)
        return
    # 一键编排:数据 → 出图 → 成页(两段式握手)
    if args[0] == "--auto":
        srcs = sorted(glob.glob(os.path.join(os.getcwd(), "data_*.json"))) if len(args) < 2 else args[1:]
        print(f"共 {len(srcs)} 份数据,一键编排(数据→出图→成页):")
        for s in srcs:
            auto_one(s)
        return
    if args[0] == "--all":
        sources = sorted(glob.glob(os.path.join(os.getcwd(), "data_*.json")))
    else:
        sources = args
    print(f"共 {len(sources)} 份数据待生成:")
    for s in sources:
        run_one(s)


if __name__ == "__main__":
    main()
