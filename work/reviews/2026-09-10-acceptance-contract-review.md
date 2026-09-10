# HIMP-01 受入条件契約の独立レビュー

日付: 2026-09-10 / reviewer: acceptance_contract_review（実装担当とは別のsubagent）

対象: [要件 HIMP-01](../../docs/harness/requirements/retrospective-hardening.md)、[設計セクション1](../../docs/harness/design/RETROSPECTIVE_HARDENING.md)、[実行計画](../plans/2026-09-10-retrospective-hardening.md)。親の session `20260909-214048-619-retrospective-hardening` に対する仕様レビューである。

**契約として問題あり（3件の具体化が必要）。** ID検証の共有化、AC-D01互換、要件側重複拒否、review/receiptとの集合一致、承認前拒否の方針は妥当。ただし、定義候補の範囲・Markdown文脈・承認対象の最終文書が未確定で、同じ文言から異なる完了判定を実装できる。以下はdraft契約への指摘であり、まだ存在しない修正候補の不具合判定ではない。

accepted化、approval作成、seal、session/task完了、最終合格receipt作成は行っていない。実装、案件repo、実Databricks、ネットワーク操作、commit/pushは対象外。本レビューによるrepository書込はこの報告のみ。

## 契約に対する指摘

### F-01 / P1 — headingなし互換モードの不正な定義候補を明示する

箇所: 設計10–12行、要件HIMP-01。設計はheadingなし要件を認める一方、「定義らしいが未対応の記法」の拒否を Acceptance criteria / 受入条件セクション内にだけ明記している。外の一般的な箇条書きを除外するという規則との境界が未定義である。

再現: 現行 `acceptanceIds('- AC-01: first\n- ac-02: omitted')` は `['AC-01']` を返す。headingなしで `AC-01` と `AC-D01` を混在させた入力も現行では同じ結果になる。新しい文法だけを採用し、厳格な候補判定を指定セクション内だけに適用すると、小文字ID・番号付き箇条書き・全角colon等による同型の脱落が残り得る。

受入条件: 正式に対応するID文法を1つに固定する（例: ASCIIの `^[A-Z]+-[A-Z]*[0-9]+$`）。定義の抽出と、不正な定義候補の検出を区別し、headingなしでも `- ac-02: ...`、`1. AC-D01: ...`、`- AC-D01：...`、装飾されたIDなどを黙って落とさないことをfixtureで固定する。一般的な説明箇条書きや本文中のID参照は条件に数えない。対応しない表・見出し形式は、利用者が条件を書いた箇所を示して拒否する。既存 `H-01`、`AC-01`、新たな `AC-D01` は改名せず保持する。

これは「あらゆる自然言語から未記載の条件を推論する」という要求ではない。サポートする定義形式と、AC等のIDを定義しようとした未対応形式の境界を明示する要求である。

### F-02 / P1 — fenced code以外も含めてMarkdownの定義範囲を固定する

箇所: 設計10–12行。「Markdownの実際の定義行」と「fenced code内は除外」だけでは、frontmatter、HTMLコメント、indented code、blockquote、入れ子、見出しの境界を判定できない。

再現: 現行抽出器は次のすべてで `AC-01` を定義として返した。

- 4spaceでインデントした `    - AC-01: example only`
- 複数行HTMLコメント内の `- AC-01: hidden example`
- YAML frontmatterのblock scalar内の `  - AC-01: metadata example`
- fenced code内の `- AC-01: example only`（これは現設計が既に明示的に修正対象としている）

また、setext形式の `Acceptance criteria` 見出しの下で `- AC-01: first` と `2. AC-02: omitted` を置くと、現行は前者だけを返す。新実装がATXの完全一致見出しだけを厳格モードにすると同じ脱落を残せる。

受入条件: frontmatter・コメント・codeなど定義でない領域を除外し、引用・入れ子・表・装飾等の未対応な定義候補は明示拒否するなど、採用するMarkdown subsetを契約化する。ATX/setext、見出しのcaseと終端、下位見出し、複数の受入セクション、fence種類と長さ・未終端時の扱いをfixtureで固定する。fence内の見出しで解析モードを切り替えてはならない。既存の `## 受入候補（実装前に固定）` とheadingなし要件に対しても、現在の有効なIDが保持されることを確認する。

CommonMark全体の実装が必要という意味ではない。対応範囲を小さくしてよいが、未対応の実条件を黙って無視して成功にしてはならない。正式な受入セクションを権威的範囲にする場合も、外にある `- AC-D01: 別の実条件` のような例示と識別できない定義は、セクションへの移動を求める等の明示エラーにする。本文中の単なるID参照とは区別する。

### F-03 / P1 — 承認前に検証するのは書込予定の最終要件とする

箇所: 設計14行、`tools/lib/intake.mjs:409`、同445行以降、`tools/lib/approval.mjs:16`。

現行 `approveIntakeLocked` は `updateArtifacts(..., true)` で要件のstatusと回答ブロック、session、planを更新した後に要件をhashする。`updateArtifacts` は入力要件をそのまま保存する処理ではなく、回答台帳から `intake-answers` ブロックを再構成する。共有検証を冒頭の読取にだけ追加しても、保存する最終本文を検証したことにはならない。

再現: メモリ内で現行の回答ブロック置換式を実行した。入力文書には `- AC-01: outcome` が1行だけあり、手で編集した回答ブロックにも重複はない。台帳回答に `- AC-01: second independent outcome` が残っていると、最終文書には同じIDの定義行が2行になる。現行抽出器はbefore/afterとも `['AC-01']` で差を見落とした。CLI回答は改行を除去するが、この1行のbulletを禁止していない。これは処理式の再現であり、実際のintake承認は実行していない。

受入条件: ロック下で最新入力を取得し、回答ブロック等を含む保存予定の要件本文をメモリ上で構成し、共有検証を通してから永続artifactを更新する。検証した同じ要件内容を承認hashへ結び付ける。生成でも最終生成本文を確認する。既存要件のproduct-intent承認でも、検証した要件・sessionの参照と承認に束ねる対象を取り違えない。

不正要件、0件、重複をそれぞれ与え、要件・architecture・plan・session・manifest・既存approvalのbytesが不変で、新しいapprovalが発生しないことを確認する。temporary lockの取得・解放は永続artifact更新と区別する。後続のI/O失敗まで含む汎用transactionの新設は本指摘の要求範囲ではない。

## 現行実装との照合

| 契約要素 | 現行の根拠 | レビュー結果 |
| --- | --- | --- |
| AC-D01、重複、不正形式、空本文 | `evidence.mjs:13` のregexとSet | AC-D01は未抽出、要件重複はdedupe、空本文は受理。pure probeで確認。 |
| reviewと要件の集合一致 | `evidence.mjs:26`–28 | review側重複は拒否するが、必要IDを含むかのみ。余分なID・ID自体の文法を検証しない。 |
| receipt利用時の集合一致 | `evidence.mjs:52`、63–65 | receipt側重複は拒否するが、必要IDを含むかのみ。sealを修正するだけでは既存/直接作成receiptへの検証にならない。 |
| 生成・承認の共通検証 | `intake.mjs:353`、409、`approval.mjs:16` | 要件文法の検証なし。承認のstatus/質問台帳チェックを保持した上で追加が必要。 |
| 旧receiptの失効 | `policy.mjs:15`–21、`evidence.mjs:56` | tools/libのmjsもpolicyHash対象。共有モジュール追加で既存receiptはstaleになる設計説明と整合。自動的にhashを更新しない。 |
| すべての完了入口 | `memory.mjs:93`、`loop.mjs:236`、`tasks.mjs:97` | 現行はvalidateReceiptを共有。session closeだけでなくtask完了とloop完了も回帰対象に含める。 |

既存の `tests/memory.test.mjs` はmissing AC、draft、非独立、provider不正、証拠なし、stale hash、receipt重複等を検証する。`tests/approval.test.mjs` は既存accepted要件の承認とintake経由必須を、`tests/contracts.test.mjs` はH-01〜H-20の抽出と質問回答後の承認を、`tests/loop-concurrency.test.mjs` はロックと関連文書の部分更新拒否を検証する。今回の文法・文脈・要件側重複・余分なreview IDを満たす十分な試験は現行のこれらのテストにはない。

## 実装後に独立確認する最小マトリクス

1. AC-01 / AC-D01 / H-01、混在、headingなし、checkboxの有無、`-`/`*`/`+`、LF/CRLFの正常系。IDは完全一致し、case変換やdedupeをしない。
2. 0件・不正ID・空本文・要件重複を独立した診断で拒否。定義の両行番号を提示し、空白だけの本文も拒否。
3. validな1件に未対応形式を混ぜる反例を、正式受入セクションとheadingなしの両方で拒否。
4. 定義対象外として採用したcode/comment/frontmatterだけの文書は有効条件0件。曖昧なindented code等を非対応として明示拒否する設計でもよい。隠れた例と実条件が混在しても、例のIDがcoverageやduplicate判定に混入しない。
5. reviewの不足・余分・重複・不正文法・非string/null等を検証。AC-D01を1件落としたレビューはseal不可。全件passでない正しいreviewは従来どおりfail receiptとなり、完了には使えない。
6. seal経由を使わず用意したreceiptでも、ID不正・不足・余分・重複は拒否。session/task/loopの完了状態が不変である。
7. 承認前拒否は、入力要件と最終再構成要件の両方の反例で確認。失敗時は既存artifactと既存approvalを変更しない。
8. 既存accepted文書の内容は自動修正しない。旧policyHashのreceipt、要件本文が変わったreceiptはstaleとして拒否し、既存の独立性・証拠hash・人のgateは保持する。

## 実施した確認と限界

`AGENTS.md`、`orchestrate-work`、`review-work`、`improve-harness`、関連する改善・品質・security標準を読んだ。`npm run harness:context` で関連sessionを照合し、明示 `--intent review` のrouteは `review-work` / `executionAuthorized:false`。workload解決は対象なしで、製品実装を開始していない。

独立実行は既存 `acceptanceIds` をimportしたメモリ内の10入力probeと、回答ブロック再構成の1入力probe。前者では混在・重複・小文字ID・空本文・plus bullet・fence・indented code・HTML comment・frontmatter・setextを確認した。実行方式はPowerShell literal here-stringを `node --input-type=module` のstdinへ渡すもので、fixtureファイルやreceiptは作成していない。

通常sandboxでの読取は `helper_unknown_error: setup refresh had errors` により失敗。承認対象を限定した `require_escalated` の読取・メモリ内probeで実行できた。自動承認による却下ではない。最初の `node -e` はWindows引数処理で失敗したため、上記stdin方式で再実行した。実装候補の全回帰、seal/closeの統合試験、live provider、実Databricks、browserは本仕様レビューでは未実施。前回報告の348 pass等を本レビューの試験結果として流用していない。

## 対象snapshot（SHA-256）

レビューは以下の読み取ったbytesに対応する。後続の親による編集はこの判定の対象外で、最終昇格には変更後の独立レビューと人の判断が必要。

| 対象 | SHA-256 |
| --- | --- |
| docs/harness/requirements/retrospective-hardening.md | 8C32ADD25200E9F5D58F15C0540158DDD5DBD1F87F8A84093E71AC5C64E731C0 |
| docs/harness/design/RETROSPECTIVE_HARDENING.md | DA811FB01AF0439415952EB24F79B71328ACCA570904EBDBF4FC5E5CC3572D95 |
| work/plans/2026-09-10-retrospective-hardening.md | FC805C13CDEFAC3360FC88453A2813E1C01713D25585A54097625F00F3B4F58B |
| tools/lib/evidence.mjs | 9F5B4E070F72C8FF12C9DBD527C5A8296A4B414DD7D1F1D745C7AB2D8C24FB1A |
| tools/lib/intake.mjs | 1881247DB860FDC79548AB4171FE5BEAFBEE86962533939782D8A667E7539392 |
| tools/lib/approval.mjs | B016D7900394E17630CB038C583E6A899B3C94C777B8EF3434FB7BD76EF1FDC8 |
| tools/lib/policy.mjs | 55F1F1B8F609356D1CA5EFFBA417662AD9D7E57CB5B3F882F00B087AE2E12ACA |
| tests/approval.test.mjs | F33746C2722514116585E1A9FF2E071154DD51264D1C790B1689A91DD730B21E |
| tests/contracts.test.mjs | A5B1ED9887E1479610E50F502B733299D14A25E40464976123007F76BC4B3FE1 |
| tests/memory.test.mjs | A48D73D844A3B6139FCC1FD2DBBF1BEA249F396A954A0E9FE25B432353008EDA |
| tests/loop-concurrency.test.mjs | 1AF3FCDC0C12E067CC11CDD5DB372BAA0ACD4E39412B7A62F0A32A871BA951CD |

次の担当: F-01〜F-03を契約と反例fixtureに反映し、red→greenの実装候補を作成する。その後、変更後のhashを固定した実装レビューへ進む。本報告はHIMP-01の完了承認ではない。
