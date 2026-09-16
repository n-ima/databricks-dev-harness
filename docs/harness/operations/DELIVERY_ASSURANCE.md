# 品質契約の使い方（標準採用）

2026-09-15。[採用記録](../decisions/ADR-0010-human-readable-delivery.md)。従来のsession/task、approval、evidence sealを置換しない、読取専用の診断。

## 通常はagentが行うこと

以下は本実装に向けた品質契約と正式な検証の手順。初期の配置相談・隔離した小さな技術検証へ完成版の契約を先取りして要求しない。その段階では既存設計/計画へ目的・未決・確認範囲を残す。本実装開始/受入時の要件対応・独立確認・承認は省略しない。

1. [文書標準](DOCUMENTATION_STANDARD.md)に沿って要件・設計を具体化する。新規/振る舞い変更は `harness/templates/delivery-contract.json` を参考に `work/quality/<feature>.json` を作る。人は自然言語で依頼し、確認用の日本語一覧を見る。
2. 原本の受入ID、実装/テスト/設計のartifact、主要リスク、外部契約、正常/異常/境界のケース、運用の適用判断を対応付ける。初期テンプレートの例や未確定をそのまま通さない。設計段階のartifactsは実在する設計・試験定義を含め、実装後は実装/設定/依存も対象へ加える。
3. 実装前に別contextで設計・観点を確認し、design診断を行う。既知の欠落を未解決のまま実装準備完了としない。
4. 許可された環境で実際にテストする。結果と版・環境・証拠を記録し、verify診断後に別contextの独立検証を行う。レビューの結果を更新したら再診断する。
5. 既存のevidence seal/完了判定に正本・品質JSON・診断結果も含める。診断だけでsessionを閉じない。実装・契約変更後はbasisと証拠を取り直す。

```text
npm run harness -- delivery check --contract work/quality/FEATURE.json --phase design
npm run harness -- delivery hashes --contract work/quality/FEATURE.json
npm run harness -- delivery check --contract work/quality/FEATURE.json --phase verify
```

FEATUREは案件の実ファイル名へ置換。checkの終了値は0=構造上の指摘なし、1=指摘あり、2=引数/読取失敗。`recordedExecutions` は実行したと記録された件数で、実行事実の確認ではない。`certifiesAcceptance:false` を常に維持する。hashesは記録からの計算のみで、証拠の検証ではない。

## 機械契約（JSONキーは原語、説明・期待結果は日本語）

| 欄 | 意味と形式 |
|---|---|
| schemaVersion | 1 |
| producer | actor/context（実装担当と作業context。認証ではない） |
| requirement | 正本要件の `{path, sha256}` |
| artifacts | 設計・実装・設定・試験の `{path, sha256}` 配列。関連する変更の選択漏れは独立確認 |
| requirements | 正本から取得した受入IDの完全な集合 |
| risks | `{id, description, testIds}` |
| interfaces | HTTPは `{id, kind:"http", contract:{path,sha256}, operations, concerns}` |
| interface.operations | `{id:operationId, positive:[testId], negative:[testId]}`。正常/異常を別caseにする |
| interface.concerns | authentication/authorization/validation/errors/idempotency/concurrency/compatibility/limits の各 `{id,status,reason,testIds}` |
| testCases | `{id, requirements, level, environment, preconditions, steps, expected, result}` |
| level / environment | unit/contract/integration/e2e/evaluation/recovery / local/dev/prod |
| result | 未実行ならnull。実行記録は `{status,environment,basisSha256,evidence:[ref],command,versions}` |
| operations | ownership/monitoring/recovery/data-protection/cost/dependency-updates の各 `{id,status,reason,testIds,document:refまたはnull}` |
| reviews | `{actor,context,independent,status,reviewedSha256,coverage,evidence:[ref]}` |
| coverage | `{requirements:[ID],risks:[ID],interfaces:[ID],operations:[ID]}` の完全な集合 |

適用判断statusはapplicable/not-applicable、結果/レビューstatusはpass/fail/not-run/blocked。適用外でも具体的なreasonを残す。適用する運用項目はdocumentを参照するが全項目への一律自動試験は要求しない。recorded commandは単なる文字列であり、この診断は実行しない。

## HTTP範囲と限界

最初の機械検査はOpenAPI 3.1/3.2 JSONのpaths/operationId。YAML、path `$ref`、callbacks、webhooks、additionalOperationsは未対応として指摘する。一般的なOpenAPI/JSON Schema validatorの代わりにはしない。HTTP以外は既存のデータ・イベント等の契約をartifactsから参照し、その形式のvalidator/試験を使う。interfacesを空にしてHTTPの欠落を隠してはいけない。

designはresult:nullを許容し、verifyは未実行/失敗/blocked/nullを指摘する。環境は完全一致。localの結果をdev/prodと書き換えない。basisは結果/reviewを除いた契約、reviewedSha256はreview以外の全契約。参照ファイルはSHA-256を照合し、古いsnapshotを指摘する。ただし選択外ファイル・実環境の変更を自動検出するものではない。

repo相対path、通常file、各1 MiB、全体16 MiB、最大128参照file。契約1 MiB、各配列1000件以内。絶対path/UNC/親参照/隠しfile/予約名/symlink/junction経由を拒否し、外部参照をfetchしない。ログのsecretや実データは記録前に除く。敵対的な同時filesystem操作を防ぐOS sandboxではない。

risk/IF自体の記載漏れ、不適切な適用外、空疎な期待結果、架空の実行、虚偽のactor/contextは構造検査だけでは排除できない。独立レビューは要求から逆に洗い出す。標準スキルへの接続と通常CLIの提供は、全既存案件への強制移行やCIの新しい強制gateを意味しない。未対応の仕様や実provider/実環境を確認済みとしない。
