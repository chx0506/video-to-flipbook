# video-to-flipbook

Cursor / Claude Agent Skill：把视频（或线性讲解）做成可交互图鉴网页。

旅行攻略类（`theme: travel`）支持美食/住宿/游玩/行李、实时 💰 / 🧳，以及「生成我的攻略」。

## Install

复制到个人 skill 目录：

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

## Demo page

相关在线预览（Pages）：https://chx0506.github.io/bali-flipbook/
