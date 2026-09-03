# Product documentation

このディレクトリは、テンプレートから作成した開発対象の正本です。ハーネス自体の設計は`docs/harness/`に置き、混在させません。

- `requirements/`: 業務成果、利用者、範囲、受入条件、人の承認
- `architecture/`: 対象システムのコンテキスト、構成、連携、非機能設計
- `data/`: データ契約、キー、品質、意味層、保持、権限
- `ui/`: ユーザーフロー、モック、状態、デザイントークン、アクセシビリティ
- `decisions/`: 対象固有のADR
- `runbooks/`: 配備、監視、障害、復旧
- `knowledge/`: 検証済みの対象固有知識
- `standards/`: テンプレートが採用する実装規約

進行中の状態は`work/`、実装は`apps/`、`src/`、`resources/`、`tests/`に置きます。
