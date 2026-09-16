# ハーネス開発と公開の標準手順

## 目的と境界

このハーネスの成果は、コードが保存されることではなく、各案件が安全に取り込み、要件から開発・運用を継続できること。**mainは取り込み可能な正式配布版を置く場所**とする。「mainへ反映」「push」の依頼は、配布版作成・stamp・更新経路の検証を含む。一つずつ追加の指示を求めない。

ハーネス自体はPC/CI上の開発支援であり、Databricksに配備しない。案件への更新は案件固有の変更や作業停止を確認する別操作であり、ハーネス公開だけで全案件を自動更新しない。調査・相談は読取専用。GitHubへの書込権限や案件配備権限を、単なる目標から推定しない。

## 工程と完了の根拠

| 工程 | エージェントが行うこと | 完了の根拠 |
|---|---|---|
| 開始 | 要求と現状を確認、作業branch/session/task、source限定のguard有効性確認 | 対象・既存変更・現在地・人の判断が明確 |
| 設計 | 不具合の再現、最小の対策、互換性/費用/両providerへの影響、試験観点 | 日本語要件/設計/品質契約と別contextの設計確認 |
| 実装 | canonical skill/tool/testを変更、providerコピーを生成 | 修正前の負例、正常/拒否/回復の試験 |
| 検証 | 構造・回帰・独立レビュー、必要なforward試験 | 対象hash・環境・実行結果、未検証を区別 |
| 配布準備 | 新版、変更/移行案内、LF正規化、stamp | 全管理file集合/hashとconfig/package/lock版一致 |
| 利用経路検証 | cacheなしsource/固定配布物、初期化済み合成案件の更新 | 取り込まれた変更、案件保持、競合停止、既存版保持 |
| main公開 | commit済み対象のcheck、通常push、remote一致、CI確認 | 正式版・commit・到達と独立確認。CI未確認は明記 |
| 案件反映 | 案件側の計画・競合/移行判断・適用・案件試験 | その案件の受入結果。公開完了から推定しない |

通常の改善は作業branchで進める。未採用案、未確認の互換性変更を正式版へ黙って混ぜない。一方、すでに採用された内容を内部工程の都合で繰り返し承認待ちへ戻さない。画面・API・データ等への影響は当該標準で検証し、今回のような配布改善に無関係なDatabricks接続を要求しない。

## 保守用の入口

source cloneの初回と保守開始時はagentが確認する。案件用`setup`はproduct.configを作るため、ハーネス保守の準備には使わない。

```text
node tools/harness-publication.mjs guard-status
node tools/harness-publication.mjs install-hook
```

未導入の場合だけinstallする。標準Git hooksのpre-pushを排他的に作る。既存pre-pushやcore.hooksPathがあれば上書きせず統合を検討する。他hookやglobal設定は変えない。ZIPにはGitがないためhookを導入できないが、配布sourceの`check`は使用できる。hook導入を確認できていない状態を保護済みと呼ばない。

## 新版の作成

`harness.config.json`、`package.json`、`package-lock.json`のroot版を一致させる。依存を不用意に更新しない。`docs/harness/releases/VERSION.md`には変更、互換性、対象/対象外、検証範囲、案件が必要とする移行、復旧方針を書く。データ/権限/承認方式の非互換をpatch扱いで隠さず、0.xの非互換はminorを上げる。

```text
npm run agent-assets:sync
npm run harness:check
npm run test:harness
npm run harness -- release normalize --yes
npm run harness -- release create --version VERSION --stamp-template
node tools/harness-publication.mjs check --base OLD_MAIN_SHA
node tools/check-release.mjs work/evidence/UNIQUE-release-byte-check.json
```

VERSIONとSHAは実際の値へ置換する。初回で比較元がない場合のみbaseを省略。checkはcached releaseへfallbackせず、現sourceの完全な管理file集合とbytes/版を確認する。同じ版の内容変更やdowngradeは拒否。release createの成功だけでは独立受入や公開成功ではない。

stamp後に管理fileが変わったらそのままpushしない。公開済み同版は絶対に再作成しない。未公開候補を作り直す場合も、対象・旧証拠の失効を確認して別候補/新版にし、既存固定payloadを上書きしない。証拠のみの`work/`追記は配布内容に影響しないが、送信対象の確認は必要。

## 利用経路の受入

実際の最新sourceをGitから別の一時clone、またはZIP相当の展開先へ取得し、`.harness/releases`がない状態で検査する。使用可能な旧正式版から初期化した合成案件へ、新版の実行器でplan/applyを行う。旧案件側の実行器が新しい管理fileを理解しない場合は、新版の実行器を使う橋渡し手順も検証する。

案件doc・コード・package/lock・接続設定・合成秘密・独自skillを保持する。競合試験は全体が停止して管理fileも変更されないことを確認する。固定payloadからの経路も確認。新規プロジェクトの初期化経路は既存fresh-template試験で検証する。実案件をテスト台にしない。

## 公開前と公開後

commit済みsourceに `check --committed --base OLD_MAIN_SHA` を実行する。pre-pushは送信先mainと送信SHAを照合し、別branchからmainへの送信でも検査する。main削除・非HEADの送信・未commitの配布file・未取得のbaseは止める。先に対象commitをcheckout/fetchして確認する。forceやguard回避で解決しない。

CIはsourceに限り同じcheckを行い、PRのbase SHA / pushのbefore SHAと比較する。履歴はfetch-depth 0、nonzero baseを取得できなければ失敗。初回mainのzero SHAのみ比較なし。案件CIへsource完全一致を押し付けない。

最終報告は「版、commit、main到達、配布/更新試験、互換性と移行、実provider等の未検証」を短く示す。stamp-validは整合性のみで、公開済み/業務受入済みを意味しない。GitHub CIが未起動/未確認なら成功と報告しない。ユーザーは正式版の変更と案件の適用計画を確認し、内部hashやstampの手編集をしない。

## 限界と保守

ローカルhookは誤操作防止であって、同権限の悪意ある変更や`--no-verify`を封じるものではない。GitHubでmerge前に強制するにはrequired checks等のbranch protectionが必要で、設定変更は所有者の権限で別途扱う。フック/CIの存在だけで保護設定済みとは言わない。[Git pre-push仕様](https://git-scm.com/docs/githooks#_pre_push)、[GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)を2026-09-16確認。

保守担当は失敗をsessionへ記録し、公開前なら作業branchを保持する。公開後の不具合は新版で修正し、旧版を書換えない。費用はローカル試験と必要な独立レビューを先に使い、実provider/Databricks課金試験は必要性・上限・許可を別に確認する。
