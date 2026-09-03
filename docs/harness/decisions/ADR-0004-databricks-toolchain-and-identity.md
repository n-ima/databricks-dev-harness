# ADR-0004: Databricks toolchain・identity・供給元を明示する

- Status: proposed — 既存 Databricks / security 標準の具体化。CI federation と production workflow の有効化は管理者・人レビュー待ち。
- Date: 2026-09-04
- Review after: 2026-10-04 または CLI / AppKit / authentication の変更時
- Scope: scaffold、dependency distribution、local authentication、CI、deployment

## Context

手動設定を減らすほど、既定 profile、floating version、暗黙の権限、古い API を踏むリスクも増える。公式 README と実 CLI の既定動作が一致しない例も調査で見つかった。

この ADR は [Databricks 標準](../../product/standards/DATABRICKS.md)と[security 標準](../../product/standards/SECURITY.md)の実行契約を明示する。project layout / 更新配布は [ADR-0001](ADR-0001-distribution.md)を正本とし、plugin-only へ切り替えない。

## Decision

### Toolchain と scaffold

- CLI 1.6.0 を調査・初期互換 baseline とする。実際にテストした CLI patch 版を evidence に記録し、許容 range 全体が検証済みだとは扱わない。
- Declarative Automation Bundles に `bundle.engine: direct` と CLI version constraint を明示する。既存 Terraform-backed deployment の migration は別の変更計画・復旧確認・human gate とし、自動 bootstrap に混ぜない。
- AppKit の manifest と init に、[toolchain lock](../../../harness/toolchain.lock.json)の同じ明示 version を渡す。調査時は `v0.69.1`。`--version latest` は main であるため、stable pin の代用にしない。
- manifest から plugin / resource key を取得し、生成された dependency lock を commit する。AppKit API は生成後の installed package docs で確認し、想像した署名や異なる版の sample を混ぜない。
- 初期 scaffold は非 deploy とし、mock と接続準備を分ける。workspace resource の新規作成・書込権限を必要とする設定は human gate に残す。
- CLI 1.6.0 の `apps init` はserver-only mockでもworkspace認証が必要。明示した開発profile/hostを検証し、fixture以外の業務データは未接続にする。未指定なら初期化を止め、dummy credentials・暗黙DEFAULT・独自template rendererによる回避は行わない。根拠は下記追補と実失敗記録。

### Local identity

- local 開発は OAuth U2M を基本とし、workspace URL と profile をユーザーが一度選ぶ。以後の workspace 操作に明示的な `--profile` と target を渡す。
- 接続検証では expected host、current identity、必要権限、target を確認する。profile 名を選んだだけで環境変数による別認証の影響がないと仮定しない。
- token、client secret、OAuth cache、秘密を含む raw command output を repo / session / screenshot に保存しない。OAuth の対話 login と権限の選択は、人が関与すべき最小部分として残す。
- unattended CI に個人 U2M や PAT を流用しない。headless 環境で OS credential store が使えないことを理由に、token を repo へ plaintext 保存しない。

### CI と release identity

- CI は専用 service principal と GitHub OIDC federation を基本とする。federation の trust は repo / branch または GitHub Environment の subject に限定する。
- production は protected GitHub Environment の required reviewer と deployment branch 制約を使う。workflow を記述しただけでは管理画面の protection 設定済みとはみなさない。
- human release は「人が exact version / plan / target を確認し、承認済み job を実行する」ことを含む。agent の判断だけで production job を開始・承認しない。
- plan を artifact 化し、commit、CLI、target、digest と対応づける。人が承認した同一 plan を replay する。plan と違うコード・設定・target、古い plan、resource drift は再確認する。
- `bundle validate --strict` と App validation は前提条件。deploy 後には必要な resource run / App restart と health / smoke test を行う。CLI deploy の成功だけで利用者へ新コードが反映されたとしない。
- rollback / recovery の方法と権限を dev/test で確認する。本番への初回導入は、この ADR や fixture test だけでは承認しない。

### Supply chain

- official skills は [vendor lock](../../../vendor/databricks-skills.lock.json)で版と供給元を記録し、repo には明示 `--path` で取得する。stable を既定とし、experimental は目的・リスク・評価を別記する。
- CLI、AppKit、skill、hook、plugin、MCP server、GitHub Action は実行可能な依存としてレビューする。実行する release / commit と checksum / content digest を追跡できるようにする。
- GitHub Actions は full commit SHA で pin する。npm lock、license / vulnerability / secret 検査も更新 PR の対象に含める。
- 通常 setup / agent session で暗黙の upstream 更新をしない。更新は candidate を取得し、manifest / generated diff / test / golden task を評価した PR として配布する。
- provider plugin は後段の任意機能。導入時に repo hook と重複しないことを確認し、plugin がなくても template の基本 workflow と cloud support が成立するようにする。

## Alternatives rejected

- 既定 profile、環境変数、current workspace へ暗黙依存する操作。
- 毎回 main / latest を取得する bootstrap と、agent が業務変更のついでに行う toolchain 更新。
- 個人 token を CI secret として配り、production と development を同じ principal で動かす方式。
- validation / deploy exit 0 だけで production readiness とする方式。
- 公式 sample に含まれる floating action ref を、そのまま供給網の安全性の根拠とすること。

## Verification required

read-only doctor、explicit profile、別 host / identity の拒否、fresh scaffold、strict validation、dev/test deploy、OIDC の許可・拒否、Environment approval、plan replay、App health、rollback を分けて evidence に残す。外部の権限・組織設定・workspace が必要な項目は未実施として明示する。

## Sources and status

根拠・閲覧日・CLI 観察は [evidence review の O-15〜O-22 とセクション 3](../research/2026-09-04-evidence-review.md)。この設計は供給網リスクを減らすが、pin だけで安全性を保証しない。現時点の lock / workflow の存在を、外部接続・デプロイの成功証拠として扱わない。

実装検証追補: [CLI init source](https://github.com/databricks/cli/blob/v1.6.0/cmd/apps/init.go#L142)のworkspace client初期化と、[auth source](https://github.com/databricks/cli/blob/v1.6.0/cmd/root/auth.go#L247)の認証経路を確認した。ローカルのmock初期化試行は既定profileのOAuth処理で失敗し、成功扱いしていない。修正後はprofile inventoryを `--skip-validate` で取得してhostを先に照合し、選択したprofileだけを認証検証する。
