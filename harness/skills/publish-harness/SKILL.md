---
name: publish-harness
description: Prepare an installable harness release and publish it to Git main. Use for harness-source push, main integration, stamp, or distribution requests; not for Databricks application deployment or applying updates to a product.
---

# ハーネスを案件が取り込める版として公開する

1. `docs/harness/operations/HARNESS_DEVELOPMENT.md`を読む。`product.config.json`がある案件のGit操作やDatabricks配備にはこの手順を適用しない。確認・相談のみの依頼は読取専用。
2. sourceのsession/task、採用済み範囲、変更、旧配布版を確認する。「mainへ反映」「push」は新版作成・stamp・更新試験まで含む。一度受けた同じ採用判断を再要求しない。未採用の別変更は黙って混ぜず、作業branchへ残す。
3. 開発元で `node tools/harness-publication.mjs guard-status` を実行。未導入なら `install-hook` でローカルguardを導入し、再確認する。既存hook/configとの衝突は保持して停止。案件用setupを代用しない。
4. 回帰・両provider資産・別contextレビューを揃える。互換性と移行案内を`docs/harness/releases/VERSION.md`へ書き、config/package/lockの版を一致させる。旧版を上書きしない。
5. `release normalize --yes`の差分を確認し、`release create --version VERSION --stamp-template`で新版を固定する。sourceを変えたら古い検証を流用しない。
6. `node tools/harness-publication.mjs check --base OLD_MAIN_SHA`、Git改行往復、cacheのない取得元からの初期化済み合成案件への更新・保持/競合試験を行う。旧cached版を新しい修正の証拠にしない。
7. 別contextで配布対象と更新試験を確認後、commitして`check --committed --base OLD_MAIN_SHA`。許可されたremote/mainへ通常pushしSHAとCI状態を確認する。guard回避、force、秘密や案件の自動更新は行わない。
8. 最終回答に版・commit・stamp/更新試験・remote到達・未検証と移行注意を示す。source pushだけで「取り込み可能」と言わない。途中で止まった場合は公開未完了と具体的な残作業を残す。
