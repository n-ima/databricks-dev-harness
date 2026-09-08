---
title: SQLとPythonの共有日付契約はcanonical形式を検証する
status: current
kind: fact
confidence: high
source: work/reviews/2026-09-08-platform-analysis-forward-test.md
verified_at: 2026-09-07T23:28:06Z
review_after: 2026-12-08
applies_to: SQL/Pythonが日付文字列を共有する分析fixture
supersedes: none
---

# SQLとPythonの共有日付契約はcanonical形式を検証する

date.fromisoformatはcompact形式やweek dateも受理し得る。SQLで文字列比較するfixtureではrow/start/endの全境界でASCII YYYY-MM-DDを検証し、両実装を同じ境界データで試験する。修正はharness/templates/starters/analysisのcanonical_dayと生成回帰テストで強制する。

## Applicability and exceptions

SQL/Pythonが日付文字列を共有する分析fixture
