# Architecture map

このファイルは設計の境界を示す短い入口です。

## ハーネス自体

AIの動かし方、配布、セッション、知識、検証、安全制御、改善ループは `docs/harness/` が正本です。

- [Harness architecture](docs/harness/design/ARCHITECTURE.md)
- [Operating model](docs/harness/operations/OPERATING_MODEL.md)
- [Session and knowledge](docs/harness/operations/SESSION_AND_KNOWLEDGE.md)
- [Improvement loop](docs/harness/operations/IMPROVEMENT_LOOP.md)
- [Research basis](docs/harness/research/2026-09-harness-research.md)

## テンプレートから作る開発対象

業務要件、アプリやデータ基盤の構成、画面、データ契約、運用設計は `docs/product/` が正本です。このハーネスの設計と混在させません。

- [Product documentation map](docs/product/README.md)
- `docs/product/requirements/`
- `docs/product/architecture/`
- `docs/product/data/`
- `docs/product/ui/`
- `docs/product/decisions/`
- `docs/product/runbooks/`
- `docs/product/knowledge/`

実装中の一時状態でありながら引き継ぎに必要な情報は、`docs/`ではなく`work/`に置きます。
