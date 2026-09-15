# Lakebase技能の形式検証と限界

2026-09-16 JST、ローカルWindows。

実行: `python C:/Users/nimao/.codex/skills/.system/skill-creator/scripts/quick_validate.py vendor/databricks-skills/databricks-lakebase`（UTF-8モード）。終了1。

出力:

```text
Unexpected key(s) in SKILL.md frontmatter: compatibility, parent. Allowed properties are: allowed-tools, description, license, metadata, name
```

これは本ハーネスの合格試験として扱わない。このvalidatorが許容していない `compatibility` / `parent` は今回追加した属性ではなく、固定した上流技能に元からある。訂正差分は本文だけで、親技能の読込みやCLI互換要件を消して形式合格に合わせる変更は行っていない。`harness/vendor-patches.json` の可逆差分と原本hashで出自を検査する。

本ハーネスの生成コピー整合検査、版/hash拒否、独立前方試験は別途行う。それらの成功をこのvalidatorの成功や、実Claude Code/Copilotでの適合確認に読み替えない。
