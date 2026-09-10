# RH01〜RH03 タスク可視化・再開 — 実装証拠

最新の追記: ユーザーの修正依頼を受けたF-01〜F-03の修正・再レビューは[修正証拠](2026-09-10-visibility-fixes.md)を参照。以下の初回実装/レビュー記録は当時の観測として保持する。

## 範囲と状態

2026-09-10 JST。ユーザーの「続けて」を受けたローカル改善候補。
対象session: `20260909-162346-724-task-visibility-and-reliable-resume`。
対象task: `HVIS-01`。要件・設計はdocs/harness配下、業務案件のdocs/productとは分離。

以下の自己検査を記録した時点ではコード実装と自己検査までだった。その後の独立レビュー結果は次節に追記。要件の最終受入、実Claude Code/Copilot canary、リリースは未実施。taskはverifying、sessionはactiveとして残す。実Databricks、案件repository、CreateApplへの変更、commit/pushは行っていない。

## 独立レビュー結果の追記（2026-09-10 JST）

ユーザーのOKを受け、実装者と別の `/root/visibility_independent_review` が独立レビューを実施。[依頼範囲とsnapshot](2026-09-10-task-visibility-review-request.md)、[独立レビュー報告](../reviews/2026-09-10-task-visibility-independent.md)を参照。

- 結論は要修正。F-01 / P1: 不正なverifier参照を保存でき、後続のtask/status/両開始hookが停止する。F-02 / P2: 旧checkpointでblockerを省略すると直前の待ち状態を表示から落とす。F-03 / P2: 初期blockerを置換すると元情報が履歴に残らない。
- 独立再実行の全回帰は343件中342 pass / 0 fail / 1 skip（19,148.1448ms）。[ログ](visibility-review/regression.log)。既存テストが成功しても、独立反例によりAC-02、AC-04、AC-05、AC-07には不足が残る。
- 親も最終版の `node work/evidence/visibility-review/probes.mjs` を専用一時fixtureで追試し、3件の同じ観測を確認（2026-09-09T17:18:13Z〜17:18:15Z）。scriptのexit 0は不具合の再現成功であり、実装合格ではない。実タスクや実DBのデータを破損させたものではない。
- レビュー対象17ファイルのSHA-256は開始時と一致し、実装・仕様・テストはレビュー中に変更していない。親は証拠・計画・session・生成statusのみ更新。
- 修正はこのレビュー依頼では行っていない。HVIS-01はverifyingを維持し、受入承認・正式receipt・session完了は行わない。次はF-01〜F-03の修正と回帰テスト追加、その修正版の独立再レビュー。実provider canaryと要件の人による最終受入は別途残る。

## 再現と検証の順序

1. 変更前の新規10テストは0 pass / 10 fail。pending/current/next非表示、明示focus未対応、checkpoint revision未確認、task/status未実装などを確認した。
2. fixtureのconfig読取をBufferからUTF-8へ修正。不存在依存のテストはID書式違反と混同しないよう`MISSING-01`へ修正した。合格条件・拒否条件は緩めていない。
3. 実装後、task/memory/hooksの関連163テストは全成功。
4. task境界ケース15件の版で全体340件中339 pass / 0 fail / 1 skip。[中間ログ](2026-09-10-task-visibility-tests.log)
5. 手追記保全、YAML互換引用、曖昧フラグ拒否を追加し、新規18テストは全成功。
6. 最終全体343件中342 pass / 0 fail / 1 skip、17,470.6947ms。[最終ログ](2026-09-10-task-visibility-final-tests.log)
7. `npm run harness:check`、`git diff --check`成功。生成skill同期とskill-creatorの`quick_validate.py`成功。
8. 公開CLIからHVIS-01を作成し、planned → ready → running → verifyingまで更新した。checkpointへfocusを保存し、`status --session ... --write`でwork/STATUS.mdを生成。人手編集保護用hashとverifyingの実表示を読み取り確認した。
9. 最終のread-only照合で、hookの`const forbidden`以降（policy/Stopを含む）がHEADと一致すること、既存evidence/approval/loop/policy/config/router/evalsに差分がないことを確認。新規fileの末尾空白・内部リンクも検査した。これも独立レビューではない。

全体実行:
```text
node --test --test-reporter=spec --test-reporter-destination=work/evidence/2026-09-10-task-visibility-final-tests.log tests/*.test.mjs
```

skipは既存のfile symlink作成に必要なhost条件。実host/modelの試験ではない。providerの両envelopeと拒否動作は隔離fixtureのNode subprocessで確認した。

## AC対応（独立レビューではなく自己確認）

| AC | 今回の観測 | 未実施・限界 |
|---|---|---|
| AC-01 | task作成・継承・一覧、実CLIのJSON往復、HVIS-01登録 | 実providerが自然言語から適切に分割する試験 |
| AC-02 | 重複/不明/循環/跨session依存/古いrevision/lock/範囲外参照の拒否 | 同一OS権限の悪意あるwriterの完全隔離 |
| AC-03 | 9sessionの共通選択、focus優先、両hook、明示省略、全件 | 実拡張での発火と設定ロード |
| AC-04 | current/next/gate/checkpoint、9taskのfocusと省略、process未観測表示 | runtime監視はRH04の別作業 |
| AC-05 | 現在節の更新、旧状態・手追記の保全、履歴、revision、pending gate維持 | 強制終了直前の未記録操作までは復元しない |
| AC-06 | 既存receipt・証拠・policy hashの検証、stale依存証拠の拒否、session不変 | reviewer本人認証はrepo外。独立確認は未実施 |
| AC-07 | 既存全回帰、fresh template、両hook、skill同期 | 実OS/provider canary・公開CI・独立レビュー |

## 変更と運用上のトレードオフ

- session/task/statusの読み取りを共通化し、contextと開始hookの別実装を削減。
- task正本はMarkdown、revisionはSHA-256。更新はcollection lockとatomic rename。JSON引用によりcolon/quote/hashを文字列として保持する。
- statusのfile保存は明示`--write`のみ。自動生成markerとbody hashが一致しない既存fileは保護する。
- `status/context`は現在のfileから生成。保存snapshotは生成時点の表示であり自動更新ではない。
- 追加task validatorをharness checkへ加えた。既存の受入条件を削除・緩和していない。新規validatorも独立レビュー対象に含める。
- 開始hookのcontext部分を変更したが、policy/Stopの判定、既存evidence/approval/loop validatorは変更していない。policyHashの計算対象には新しいlibraryも入るため、過去receiptは従来どおりhash変更により失効し得る。hashの検証を回避しない。
- 共通orchestrate-workへの2項目追加と生成された両providerコピーにより、agentがtaskとstatusを利用する入口を作った。これは実providerで期待どおり判断した証明ではない。

## 次の確認

独立reviewerには受入候補、設計、実差分、新規・既存テストを渡し、元実装者の結論を前提にせず再実行と反例探索を求める。本人確認・approval・policy変更に関わる最終受入は人に残す。未検証をpassにしたreview JSONや完了receiptは作成していない。
