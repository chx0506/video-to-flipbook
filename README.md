# video-to-flipbook

**火种** Cursor / Claude Agent Skill：把视频 / 灵感片段做成可交互网页应用（flipbook），
支撑「我看到，我做到」—— 理解 → 个性化决策 → 编译行动清单。

- **Mode A：** 单视频 / 单片段 → 一页
- **Mode B：** 灵感库多选 ≥2 独立来源 → 去重综合一页
- **品类：** 旅行、菜谱、健身、美妆、学习、访谈观点等

产品逻辑 SSOT：`huozhong/PRODUCT.md` · Skill 契约：`references/product.md`

## Install

```bash
rsync -a ./ ~/.cursor/skills/video-to-flipbook/
# 或
rsync -a ./ ~/.claude/skills/video-to-flipbook/
```

详见 `SKILL.md`。

## Build example

```bash
PYTHONPATH=scripts python3 scripts/build.py examples/data_bali.json
# → examples/out_bali.html
```

## Key references

| 文档 | 内容 |
|------|------|
| `SKILL.md` | 主流程 |
| `references/product.md` | 火种产品契约 |
| `references/content-categories.md` | 品类 → 交互 → 清单 |
| `references/multi-video.md` | Mode B 多源输入 |
| `references/action-list.md` | 行动清单运行时 |
| `references/travel.md` | 旅行全契约 |

## Demo

https://chx0506.github.io/bali-flipbook/
