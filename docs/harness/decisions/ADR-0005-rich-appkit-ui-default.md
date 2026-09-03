# ADR-0005: Rich UI は AppKit を基本にし、実行できる mock で承認する

- Status: proposed — ユーザーの rich application 方針と既存 frontend 標準の根拠補強。個別 product の mock 承認は別途必要。
- Date: 2026-09-04
- Review after: 2026-10-04 または AppKit の UI / template の変更時
- Scope: 業務アプリ、分析アプリ、Genie を含む custom Databricks Apps

## Context

ユーザーは、業務アプリとグラフ中心の分析画面を高品質に作り、ライブラリをある程度統一し、画面を mock で確認することを求めている。

公式 Databricks skills は、単純な可視化には managed AI/BI dashboard を先に検討する。本プロジェクトでは rich interaction / 独自 UI を求める明示的なユーザー方針があるため、custom app を優先する。この優先は Databricks 全ユーザーへの一般推奨ではない。

## Decision

- custom app は Databricks AppKit、React、TypeScript を基本とする。UI は `@databricks/appkit-ui`、chart は AppKit UI の ECharts 系 primitive、table は TanStack Table 系 primitive を先に使う。
- second design system / chart / table library は既定で足さない。足りない interaction、accessibility、performance、license、保守費用を ADR で説明した場合に追加する。特定 package を使っただけで画面品質を保証しない。
- AppKit そのものの API・template version は [ADR-0004](ADR-0004-databricks-toolchain-and-identity.md)に従う。古い sample の component 名を発明したり、依存版を部分的に上書きしたりしない。
- user-facing UI は最初に synthetic fixture で実行できる mock を作る。本番と同じ component、routing、interaction state を使い、承認後も test fixture として残す。
- mock では primary journey、desktop / narrow、keyboard、loading / empty / error / partial / denied / success、単位・期間・timezone・freshness を確認する。静止画だけで interaction 合格にしない。
- human は KPI の意味、情報密度、操作の順序、誤解しない表現を承認する。agent は実装詳細、responsive layout、検査の反復を担当する。
- production data 接続と write authority は mock 承認とは別 gate。mock 承認を production 接続・機密データ利用・公開の許可に転用しない。

## データ・AI surface の分離

- analytical read は governed Delta / view / Metric View を通す。読み取り画面という理由だけで Lakebase を追加しない。
- transactional CRUD が必要な場合は Lakebase を候補とし、business key、validation、authorization、conflict、retry、監査、分析側への同期を設計する。
- Genie / conversational surface は回答の出典・SQL・権限主体・制限を分かる形で示し、代表質問・言い換え・曖昧質問・権限不足の benchmark を持つ。AI が出した数字を確定値のように扱わない。
- managed AI/BI dashboard を明示的に求められた場合、または custom interaction の必要がなく運用費用が優先される場合は、その選択を product requirement に記録する。すべてを custom app に強制しない。

## Consequences

ライブラリの選択肢を絞り、fixture を設計・実装・回帰テストに再利用できる。一方、custom app には frontend dependency、accessibility、performance、認証・認可、運用の責任が生じる。managed dashboard より常に安く・速く作れるという主張はしない。

## Verification and sources

具体的な受入証拠は [frontend 標準](../../product/standards/FRONTEND.md)、[operating model の mock gate](../operations/OPERATING_MODEL.md)、[evidence review の O-16 / O-17 / R-09](../research/2026-09-04-evidence-review.md)に従う。

この ADR は AppKit の scaffold、browser test、ユーザー mock review、Databricks 上の稼働、performance benchmark が完了したことを示さない。各 product の設計は `docs/product/` に置き、harness の設計と混ぜない。
