# 安全なローカル更新入口: 独立設計レビュー

2026-09-15。担当: `/root/safe_update_design_review`。設計のみを別contextで確認。最新判定: **再確認2で設計指摘2件を解消。設計上の阻害指摘なし**。初回および再確認1の指摘は履歴として残す。

## 対象と実施範囲

元要求は、信頼するローカルclone/ZIP展開先から進行中案件のハーネスを更新し、保持指定を省略しても案件固有資産を保護すること。旧版の初回橋渡しと次回の簡単な入口を含む。個別案件への適用、push、Databricks操作は対象外。

`AGENTS.md`、`orchestrate-work`、`review-work`、`improve-harness`、文書標準、品質契約、既存更新手順、関連session/plan、`tools/lib/distribution.mjs`を読取。`harness:context`、明示review route、workload resolveを実行。製品workloadは該当なし。レビュー記録以外は変更せず、実装・runtime・実providerの成功は主張しない。外部資料の内容は今回の根拠に使わない。

| 対象 | SHA-256 |
|---|---|
| `docs/harness/requirements/2026-09-15-safe-local-update.md` | `60535ece444246a17a54578c132a12ae593f663506398e892e02ab1a0507c141` |
| `docs/harness/design/SAFE_LOCAL_UPDATE.md` | `cc28ce32b632c28a47c76f38a5666afad17b57104d8ebbd165e70400b16faedc` |
| `tools/lib/distribution.mjs` | `763eefafdb278ad3edd0113fa47150cd756d6af0f478e383f5535dcd2aa41a31` |

## 指摘

### SU-D01 / P1: 旧版から新入口を起動する信頼境界が未定義

根拠: 設計11行は新しい`tools/update-harness.mjs`を入口とし、15行は更新元script実行を行わないとする。一方、要件10行は既存0.4/0.5初回手順を残すとしており、既存手順41〜44・56〜59行は更新元の`distribution.mjs`を動的importする。これはSU-03の「更新元のコードを動的に読み込まない」と整合せず、新CLIを持たない旧案件が最初に何を実行するのかも未定義。旧CLIのallowlistでは新版を拒否する点は既存手順41行にも記録されている。

最小改善: 信頼・確認済みの新CLIをどこから初回起動するか、実行ツールと`--source`データの区別、対象を案件cwd/明示`--target`へ固定すること、真正な旧baselineの登録、更新後に案件内CLIへ切り替えることを一連のコマンドで定義する。初回に信頼済みCLIを実行することと、任意の更新元コードを自動importしないことを区別し、旧手順が適用される版を明示する。

受入条件: 新CLIがない0.4/0.5相当の隔離案件から、ソース/配布物双方で計画・適用し、更新後は案件側の短い入口で次版の計画まで実行できるケースを定義する。各段階で案件資産保持と対象固定を照合する。未確認のbootstrapコードを自動実行しない。

### SU-D02 / P2: 実装前の試験契約と受入条件の追跡が未作成

根拠: 設計34行には試験観点が列挙されるが、SU-01〜05に対応する前提・操作・期待結果の具体ケースがない。確認時点で`work/quality/`も存在しない。`DELIVERY_ASSURANCE.md`の通常手順1〜3と`DOCUMENTATION_STANDARD.md`は、更新処理の振る舞い変更について実装前の品質契約・別context設計確認・design診断を要求する。

最小改善: 今回の要件/設計を参照する品質契約に正常・拒否・競合・中断の具体ケースを定義し、design診断を実行する。結果は実装前なので`null`とする。SU-D01の初回→次回経路、同一版異bytes拒否、ローカル削除/未知衝突、計画後のsnapshot/管理対象変更、途中失敗時のbaseline不更新・backup保持を含める。配布物とソースで「同じ計画」とはsourceRootや試行IDを除いた変更操作集合の一致であることも明記する。

受入条件: SU-01〜05からケース・期待結果・実在する設計artifactまで追跡でき、design診断と本レビューの指摘解消を記録する。診断成功を実行成功や受入完了と扱わない。

## 確認できた設計と残る検証

- SU-01: 固定manifestと管理bytesからのsnapshot方式は要求に整合。配布/ソース間の一致は未実行。
- SU-02: 既存allowlistと3者比較・競合全体停止の再利用は妥当。`operationsFor`は新版と同bytesの場合にkeep/adoptするため、要件の独自変更停止は「新版と一致しない独自変更」の意味を明記するとよい。案件資産保持の実測は未実行。
- SU-03: baseline必須、source/target包含拒否、厳格CLI、計画後再照合は必要な方向。SU-D01を解消する。
- SU-04: 適用後の全管理hash/削除照合をbaseline記録より前に置く設計は妥当。現行実装362〜363行はbaseline確認直後に新baselineを書くため、実装時は全体照合を追加した証拠が必要。
- SU-05: 停止・復旧・新context再開を含み、実provider/案件を未確認と区別している。初回と次回の一連の入口はSU-D01で補完する。

今回のレビューは設計判断のみ。実装の受入、正式採用、版上げ、公開、実案件更新の承認を兼ねない。

## 再確認1

同日、要件`07801964853e43955379263ec64964cc1e66d8e1f826a4213fb77437c94922ec`、設計`3817fb3072453b7b9bba4b1637b0f2e103ee91487a6a799b07abba8384fdba92`、品質契約`a14ba6b3fb09e01fe5fb87e4a428bac9833b6ef262028fb847c012c9fe41b2ba`を再確認。

- **SU-D01: 設計上解消。** SU-03は利用者が信頼するCLIの起動と、そのCLIによる任意sourceコードの自動実行を区別した。旧版からの入口は、既公開0.5 bridgeを既存運用として分離し、候補を含む次の採用版では信頼済み外部CLI・明示target、更新後は案件内CLIへ移ること、未対応の旧CLIでは新しい信頼済み実行器に戻ることを定義した。baselineを推測しない条件も明確。
- **SU-D02: 大部分を解消、試験定義2点を残す。** SU-01〜05とTC-SU-01〜06、運用、実在する設計/試験artifactの対応を確認。`npm run harness -- delivery check --contract work/quality/safe-local-update.json --phase design`を独立再実行し、終了値0、`findings: []`、`recordedExecutions: 0`を確認。ただしTC-SU-04は成功後の照合だけで、適用途中の中断を試すcaseがなく、recoveryもこのcaseだけを参照している。TC-SU-06の「再実行」は更新後の案件内CLIによる次版planか不明。中断→旧baseline不更新/元bytesのbackupとjournal保持/同一plan再適用拒否のcaseを加え、TC-SU-06の次回入口を明記すれば残る設計指摘は解消できる。

試験ファイルは定義として読んだ。実装試験や旧版bridgeのruntime検証は本再確認では実施していない。構造診断成功を中断復旧の確認済みとは扱わない。

## 再確認2: 設計指摘をクローズ

要件・設計は再確認1と同hash。品質契約`13d567371a8e6c5bf34b9702af2849fd903aeef8a375e141094a040e7abc6934`、試験定義`d1390dfd8ebf58636c5c36655524aea0d5d2c4252f21f453a30a4c5c48178c05`を読取確認。

TC-SU-06に、信頼済み外部CLIからの初回導入後、導入済み案件内CLIを起動して次版planを作る操作が明記された。対応する試験定義は外部cwdと明示targetを分け、案件内CLIで1.2.0→1.3.0のplanと案件資産保持を照合する。

TC-SU-07は更新途中でkeepファイルを改変し、適用後の全体照合が失敗したときの旧baseline不更新、元bytesのbackup、interrupted journal、同一plan再適用拒否を定義する。対応する試験定義でこれらのassertionを確認し、品質契約のrecoveryと完了誤認リスクからも参照されることを確認した。

design診断を再度独立実行し、終了値0、`findings: []`、`recordedExecutions: 0`を確認。これにより**SU-D02を設計上解消**とし、先に解消したSU-D01と合わせて、本設計レビューの未解消指摘はない。

ここで確認したのはSU-01〜05の設計と試験定義。提示された14/14 passを本担当は再実行していない。追加のbootstrap試験は合成した1.x fixtureであり、品質契約TC-SU-06の「公開済み旧版manifest」による実行証拠の代用ではない。実装後の独立検証では旧公開版baselineとの互換性、実際の失敗・回復動作、provider/実案件の未実施範囲を別に確定する。
