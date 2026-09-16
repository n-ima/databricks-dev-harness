# ハーネス公開契約・独立設計レビュー

- 実施日: 2026-09-16
- 担当/context: publication_design_review / rootとは別context
- 対象: `docs/harness/requirements/2026-09-16-publication-contract.md`、`docs/harness/design/HARNESS_PUBLICATION.md`、`work/plans/2026-09-16-publication-contract.md`
- 参照: `work/quality/2026-09-16-publication-contract.json`、現行distribution/check-release、setup、CI、router、release/update/improve skills、SAFE_LOCAL_UPDATE
- 範囲: 実装前の設計と予定試験のレビュー。実装・provider・実GitHub公開・実案件更新の合格認定ではない。

## 結論

専用公開skill、sourceの全管理集合検査、main送信前guard、同一検査のCI接続、初期化済み合成案件での更新試験を組み合わせる方向は妥当。新しい公開システムの全面再構築や案件の自動更新は不要であり、権限範囲も依頼に合っている。

ただし、下記2点を設計へ具体化してから実装完了を判定する必要がある。単に検査コマンドを追加するだけでは、今回の再発防止として不足する。要件を広げず、通常経路への接続条件を明確にする指摘である。

## 指摘

### PDR-01 / P2: hookの導入・有効性確認を通常の開発開始に接続する

設計は`install-hook`の存在と既存hookを保持する条件を示すが、誰がいつ実行し、未導入をどこで検出するかがない。現行`tools/harness.mjs`のsetupは`product.config.json`を生成する案件初期化であり、ハーネス開発元へそのまま適用する入口ではない。cloneでGit設定/hooksは引き継がれないため、専用コマンドを作るだけでは通常main pushが検査を通らず成功しうる。

受入条件: ハーネスsourceのimprove/publish開始手順から、保護状態の読取確認と安全な初回導入へ接続する。既存hook/configとの衝突は保持して停止し、無断置換しない。clone直後・導入済み・設定変更・衝突を試験し、保護未導入の状態を「公開準備完了」と報告しない。GitHub側の保護や`--no-verify`を越える絶対防御とは主張しない。

### PDR-02 / P2: CIの比較元SHA・取得方法・取得不能時の扱いを定義する

同版差替えや版戻りの拒否は`--base`に依存するが、設計のCI節に比較元の決定方法がない。現行`.github/workflows/harness-ci.yml`のcheckoutは履歴取得指定なしである。単体stamp一致の検査だけでは、0.6.1を同版で再stampしたsourceも自己整合してしまう。

受入条件: PRではbaseの正確なSHA、main pushでは送信前SHAを根拠として比較し、そのcommitが取得できるcheckout/fetch方針を明記する。zero SHAの初回main、浅い履歴、未知/取得不能baseでは免除や別refへの自動置換をせず、停止または別途定義された初回公開手順へ分岐する。source/product分類のskipを認証とは見なさず、案件CIにsource整合を要求しない。一致検査だけの実行をimmutable検証成功と表示しない。

## 受入条件と予定証拠の対応

| 受入 | 設計上の確認 | 実装後に必要な証拠 |
|---|---|---|
| PUBC-01 | 専用skillと手順・案件配備の分離は妥当 | 「mainにpush」「新版公開」「相談」「案件配備」のrouting/forward確認。相談の検出を権限追加にしない |
| PUBC-02 | owned集合とstamp全件の相互照合は既存check-releaseの列挙漏れを補う | 新規/削除/改変/余分/unsafe path、版・lock不一致、同版差替え、cacheに正しい旧版が残る負例 |
| PUBC-03 | ローカルとCIの同検査は適切。ただしPDR-01/02が必要 | 実temp Git pushで導入・非HEAD・別ref→main・削除・未commit・未知baseを確認。GitHub設定変更は不要 |
| PUBC-04 | 合成の初期化済み案件、source/cache無しと固定payloadの双方は適切 | 新版実行器のtarget-aware入口で旧版案件を更新。固有ファイル/package保持、競合全停止、旧release不変 |
| PUBC-05 | 両provider同期・独立review・forward確認の分離は適切 | 生成物一致、回帰/新規試験、別context記録。provider実地試験や公開を未実施なら明記 |

## 実装時の確認点（追加阻害指摘ではない）

- `package.json`/lockは案件所有のため、新機能を新しいnpm scriptに依存させず、管理対象の`node tools/harness-publication.mjs`直接入口を使える方針は妥当。
- immutableの比較はpath/hashだけでなく、移行指示と実行可能属性等の意味あるmanifest内容も含め、生成日時のみの差と区別する。既存`operationsFor`の同版hash比較をそのまま全公開契約としない。
- 生の作業treeだけでなく送信commitの管理file集合/bytes/版/stampを照合する。未追跡の新規管理fileも無視しない。独立した`work/`の証拠追加まで毎回新版必須にはしない。
- 新しいテストは現在のdistributionの明示的tests allowlistにも必要に応じて追加する。root/tests全体を所有して案件テストを上書きする方向へ広げない。
- 最終source文書/skills/生成物の変更後にstampを作る。stamp後の対象変更には再検査を要求し、既存固定payloadは上書きしない。
- 読取checkはclone/ZIPどちらでも使えるが、baseなしZIPの自己整合確認だけでは過去版のimmutable比較まで証明しない。保証範囲を結果に区別する。
- 今回は開発手順の是正依頼であり、追加GitHub push、実案件への適用、Databricks配備、権限設定変更は実施しないという範囲は正しい。将来の明示的main公開依頼にはstamp等の準備を内包し、利用者へ別依頼を繰り返し要求しない。

## 未実施

このレビューでは新実装の実行試験、実provider、ネットワーク公開、実案件更新を行っていない。品質design診断の0findingsは構造診断結果であり、上記意味レビュー指摘を解消したことにはならない。

## 限定再確認（2026-09-16）

rootから依頼された設計補足を同じ独立contextで読み直した。**PDR-01、PDR-02とも設計上は解消**。この限定再確認で新しい設計阻害指摘はない。実装の機能試験・安全性レビューは別担当で行うため、その合格をここでは主張しない。

- PDR-01: `HARNESS_PUBLICATION.md`と`HARNESS_DEVELOPMENT.md`がsource保守開始時のguard確認、未導入時の排他的導入、既存hook/config衝突時の保持・停止、案件setupの不使用を明記。`improve-harness`と`publish-harness`の双方がその手順と`guard-status`へ接続され、publish側は導入後の再確認も要求している。初期設計の「追加しただけの未使用コマンド」という接続漏れは解消した。
- PDR-02: 設計と運用手順がPR base SHA/main push before SHAを特定し、nonzero baseの未取得・未解決は停止、初回mainのzeroのみ比較なしと定義。旧repoにstampがない最初の配布は明示的な初回移行として区別される。CI定義は`fetch-depth: 0`、イベントからの正確なSHA、空値停止、nonzero時の`--base`受渡しを持つ。自己整合検査だけをimmutable比較とする設計の穴は解消した。CIが実際に実行されたとの認定ではない。

再確認snapshot SHA-256:

| 対象 | SHA-256 |
|---|---|
| `docs/harness/design/HARNESS_PUBLICATION.md` | `2dce093c5077771adda668b97bf3a5d0fc921a1b79e7f3da6de6e76a0dc8df9b` |
| `docs/harness/operations/HARNESS_DEVELOPMENT.md` | `9e37c3f4a839488ff393263639579d0e5fa40a0eb8b09a91134b033de8103824` |
| `harness/skills/publish-harness/SKILL.md` | `168d39f9525c06556bfdc58831088014d7b107ba8e8d0ee5e640fa1619757f67` |
| `harness/skills/improve-harness/SKILL.md` | `3c036897340c811c75d0024a8e6bcfdecb792478f4d28746ba4a605cd1c1209b` |
| `.github/workflows/harness-ci.yml` | `431bbb76a4c2b5f92b88b3cdfad1a671a8c007788f3063616dacb22ce9809fea` |
