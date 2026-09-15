# 安全なローカル更新入口の設計（0.6.0採用）

2026-09-15、[ADR-0011](../decisions/ADR-0011-safe-local-update-adoption.md)で正式採用。以下の安全性・所有権の設計は候補から変更しない。

## 判断

取得と適用を分離する。常時共有参照やフォルダーの丸ごとコピーではなく、各案件に固定版を導入する。既存の所有権allowlist・元版比較・競合停止・計画hash・バックアップを再利用し、別のmergeエンジンや依存を増やさない。

根拠は[Spec Kitの更新](https://github.com/github/spec-kit/blob/main/docs/upgrade.md)、[BMADのローカルmodule](https://docs.bmad-method.org/customize/add-modules/)、[OpenSpecの更新入口](https://github.com/Fission-AI/OpenSpec/blob/main/docs/cli.md#openspec-update)、[Copierの元版比較](https://copier.readthedocs.io/en/stable/updating/)。いずれもそのまま移植せず、案件のGit有無に依存しない既存manifest方式に入口だけ追加する。

## 構成と外部境界

- `tools/update-harness.mjs`: 安定した独立CLI。対象は実行ファイルの場所ではなく作業ディレクトリ、または明示した`--target`。npm scriptsの移行は不要。
- `planLocalUpdate`: 初期化済み案件の`product.config.json`と導入済みbaselineを必須にし、source/targetの同一・包含を拒否する。既存の空ディレクトリ初期導入APIは変えない。
- 更新元は`manifest.json + files/`の配布物、または`harness/base-release.json`を持つソースフォルダー。全管理bytesを照合する。ソース内の未管理ファイルは取り込まない。
- 開発中ソースに変更があっても、同じbase manifestに一致する`.harness/releases/<version>`があれば固定配布物を使用し、その選択を表示する。別版や単に最新のディレクトリを探さない。該当配布物がない場合は不一致を拒否する。
- 検証したbytesを案件内`.harness/updates/sources/<unique-id>/`へ固定し、通常のplan/applyへ渡す。計画には元の選択元と使用形態を残す。Git・ZIP解凍・ネットワーク・指定sourceのscript実行は行わない。実行するCLI自体の信頼は前提とする。
- `apply`は保存済み計画と`--yes`のみ。保護解除・force・baseline再生成のオプションはない。適用直前の再照合とlockを維持し、適用後に全管理bytes/削除を確認してからbaselineを記録する。

## データと所有者

### 旧版からの入口

0.4/0.5案件には新CLIがない。旧0.5へのAPI bridgeは履歴として残す。0.6.0への初回更新は、その信頼済み配布物の`files/tools/update-harness.mjs`またはclean sourceの`tools/update-harness.mjs`を絶対パスで起動し、`--target`に案件を指定する。これは明示的に選んだ信頼済み実行器であり、実行器が`--source`からコードを自動importするものではない。次回以降は案件に入ったCLIを使用可能。ただし新版manifest形式/管理対象に旧CLIが未対応なら、新しい信頼済み実行器へ戻る。旧CLIのallowlistを手で弱めない。

baselineがない場合は真正な元版manifestを元に既存baseline登録を行う。新入口は自動推測/登録しない。ソースの新CLIをharness本体への更新と誤認しないよう、product markerとbaselineを必須にする。未公開候補をいきなり実案件へコピーしない。

| データ | 所有者・粒度 | 書込み |
|---|---|---|
| 案件の実装・docs/product・work・設定・秘密情報 | 案件、各ファイル | updater対象外 |
| 管理manifest | ハーネス版、path/hash/size/mode | 元版は再生成しない |
| 更新plan | 案件、更新試行単位 | 元版/先版/対象/変更前後hash/競合/選択元を保存 |
| source snapshot | 案件local、検証済み配布bytes | 新規のみ。共有sourceへは書かない |
| recovery journal / backup | 案件local、更新試行単位 | 置換前bytesと実行状況。自動rollbackなし |

## 通常・例外フローと試験観点

`短い依頼 → 案件checkpoint・書込み停止確認 → 更新元/元版確認 → 固定snapshotと差分計画 → 差分/手動移行確認 → 適用 → hash照合 → 案件試験・独立レビュー → 新contextで再開`。

計画は管理ファイルを変えないがlocal metadataは作る。競合は自動解決しない。手動移行や削除の判断は人へ返す。適用中断はjournalと差分を照合して復旧し、やり直しのためにbaselineやplanを書換えない。以前からの独自変更を最新版と誤認することを防ぐ。実行中agentの完全検知はできないため、停止確認はworkflowの責任とする。

試験は配布/clean source/Gitなし/dirty sourceの固定版選択、product保持、競合、旧baseline、sourceとtargetの誤指定、symlink/junction、改変・途中変更・未知引数、バックアップ、適用後の一致を対象にする。外部HTTPは提供しないためOpenAPIは適用外。運用は利用者と案件agentが担当し、異常を終了値・計画・journalで観測する。費用はローカルI/Oとsnapshot容量、AIの独立レビュー。自動無限再試行・課金操作はしない。
