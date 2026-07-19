#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations
"""
art_recipe.py —— Flipbook 出图配方(固化的美术风格)
--------------------------------------------------
核心思想:调用方只描述「画什么主体」(subject),
风格骨架 + 硬约束由本模块自动包装,保证所有图风格统一、且绝不出现文字乱码。

美术方法论(锁定):
  手绘水彩线稿 + 莫兰迪低饱和 + 米色纸底 + 留白居中构图 + 图内零文字。
"""

# ===== 1) 通用风格骨架:所有主题共享的"高级感"来源 =====
STYLE_BASE = (
    "hand-drawn illustration, fine ink line-art with soft watercolor wash, "
    "clean cream paper background, elegant textbook / travel-guidebook aesthetic, "
    "centered composition with generous margins"
)

# ===== 2) 硬约束:决定"不翻车"的关键 —— 图内零文字 =====
HARD_CONSTRAINTS = (
    "NO text, NO labels, NO words, NO numbers, NO captions, NO watermark anywhere in the image"
)

# ===== 3) 主题调色板 & 视角:与模板 CSS 的四套主题一一对应 =====
THEME_PRESETS = {
    "travel": {
        "palette": "muted earth-tone palette, sage green, warm tan, soft blue sea",
        "view": "bird's-eye isometric-leaning aerial view",
    },
    "building": {
        "palette": "muted palette of warm brown, tan, sage green and soft grey",
        "view": "architectural isometric-leaning perspective",
    },
    "art": {
        "palette": "soft muted palette with dusty purple, mauve and warm neutrals",
        "view": "elegant frontal or gallery perspective",
    },
    "dark": {
        "palette": "moody muted palette, deep teal and warm amber accents on dark ground",
        "view": "dramatic low-key perspective",
    },
}
DEFAULT_THEME = "travel"


def build_prompt(subject: str, theme: str = DEFAULT_THEME, view: str | None = None) -> str:
    """
    把「主体描述」包装成完整出图提示词。
      subject : 只需描述画什么,例如 "a tall ancient Chinese timber pagoda, nine tiers"
      theme   : travel | building | art | dark(决定配色与默认视角)
      view    : 可选,覆盖主题默认视角
    """
    preset = THEME_PRESETS.get(theme, THEME_PRESETS[DEFAULT_THEME])
    v = view or preset["view"]
    parts = [
        subject.strip().rstrip(".,"),
        v,
        STYLE_BASE,
        preset["palette"],
        HARD_CONSTRAINTS,
    ]
    return ". ".join(p for p in parts if p) + "."


def collect_prompts(data: dict) -> list[dict]:
    """
    扫描一份 data.json,产出所有需要出图的提示词清单。
    优先级:节点若已有 imageUrl 就跳过;否则用 imagePrompt(主体)+ 主题配方生成完整 prompt。
    返回 [{slot, subject, prompt}] 供出图工具批量调用。
    """
    theme = data.get("meta", {}).get("theme", DEFAULT_THEME)
    out = []
    ov = data.get("overview", {})
    if ov.get("imagePrompt") and not ov.get("image"):
        out.append({
            "key": "overview",
            "slot": "overview",
            "subject": ov["imagePrompt"],
            "prompt": build_prompt(ov["imagePrompt"], theme),
        })
    for i, c in enumerate(data.get("cards", [])):
        if c.get("imagePrompt") and not c.get("image"):
            out.append({
                "key": f"cards[{i}]",
                "slot": f"cards[{i}] · {c.get('name') or c.get('label','')}",
                "subject": c["imagePrompt"],
                "prompt": build_prompt(c["imagePrompt"], theme),
            })
    return out


if __name__ == "__main__":
    # 自测:演示配方效果
    demo = build_prompt(
        "a bird's-eye illustrated map of Bali island with volcano, beaches, jungle rice terraces and leaping dolphins",
        theme="travel",
    )
    print("=== 示例:travel 主题完整提示词 ===\n" + demo)
