# Independent private-source publication preflight

Date: 2026-09-10 (JST)
Reviewer: independent `deployment_contract_review` agent
Scope: HARD-08 adoption and accumulated harness source/evidence publication to existing private origin/main.
Status: **content/adoption/EOL and staged-warning classification passed; final restaging/blob equality remains the pre-send condition.**

この記録は内容と初回ステージの独立出版チェック。commit / push の実施報告、versioned release、完了 receipt、Databricks 実行許可ではない。reviewer は本ファイル以外を変更せず、内容・ローカル Git・承認済み GitHub 送信先の読み取りだけを行った。

## Authorization and target

ユーザーの「採用してOK。ここで１度pushしてください。リモートへ。」を記録した ADR-0008 と `work/evidence/2026-09-10-initialization-adoption.json` を確認した。対象は HARD-08 の限定ローカル採用と蓄積ソースの通常 push であり、全8要件完了や実環境適合の採用ではない。

読み取り確認:

```text
gh repo view n-ima/databricks-dev-harness --json nameWithOwner,isPrivate,defaultBranchRef
git ls-remote origin refs/heads/main
git rev-parse HEAD
git branch --show-current
```

GitHub は `n-ima/databricks-dev-harness`, `isPrivate=true`, default branch `main`。remote main と local HEAD は両方 `2ee3e7514f6cc937a75cb667065b9eeb0bc1ebe7`、現在 branch は `main`。観測後に remote が進んだ場合は再確認する。force-push、tag、visibility/permission 変更は承認範囲に含めない。

## Source and secret review

- 累積 tracked diff と untracked files を列挙し、初回190ファイル・約2MB、および追加の採用/追補ファイルを確認。task visibility、acceptance integrity、simulation-only deployment、initialization、関連調査/試験/レビュー/状態記録の蓄積であり、HARD-08 だけの差分とは主張しない。
- `apps/`, `src/`, `resources/`, `docs/product/`, `.harness/`, `.env`, `product.config.json`, root Bundle といった案件実体の追加はない。振り返り根拠には sibling product repo のローカルパス・commit/hash 参照があるが、製品本体や業務データのコピーではない。private 保存として扱い、一般公開の確認へ流用しない。
- 変更ファイル全体を読み、private key、GitHub token、Databricks PAT、AWS key、OpenAI key、JWT、credential入り URL の高確度パターンは0。追加の workspace識別host / Databricks Apps URL / password・client_secret・access_token・api_key の具体代入パターンも0。秘密候補の値をログへ出さない形で検査した。
- これは今回の差分のローカル pattern/内容検査であり、全過去 Git history の網羅的 secret scanner や未知形式の秘密情報不存在証明ではない。

## PUB-01: Git EOL normalization — resolved before staging

初回に26個の証拠 `.log` が CRLF を含むことを検出した。既定 `* text=auto eol=lf` と `core.autocrlf=true` のまま保存すると、レビューが参照する raw SHA-256 と Git blob の bytes が変わり得る。

主担当は `.gitattributes` の `work/evidence/**/*.log -text` だけを追加した。runtime/test/doc の通常 LF 方針は維持し、ログの現存 bytes やレビュー hash を書き換えていない。

変更後、195対象の `git hash-object --no-filters --stdin-paths` と `git hash-object --stdin-paths` の object IDs を比較し、差は0。代表の full-r6 log は effective `text: unset`、filter unspecified で、raw/clean が一致することも個別確認した。追加の新規採用/追補文書は LF。ステージ後にも実 blob と作業コピーの全件比較が必要である。

## PUB-02: one historical evidence log overwritten — explicitly excluded

`work/reviews/2026-09-10-initialization-alias-review.md` 内の `work/evidence/2026-09-10-initialization-final-replay.log` 参照に1件の不一致を検出した。

- Historical expected SHA-256: `23310706d914662f46f132b7f1df78aeda09506fc10352eceeb20a1c36fe5865`
- Current 6277 bytes SHA-256: `cd5611b0f7286128321a60f1fe2f5e947371a108d496731fb552802c4973a27d`

現存内容は 20260910-002104 の plan を含む後続主担当 run（33 probes / 32 pass / 1 collision-message failure）であり、元の alias-review が記録した26成功 run のログではない。名前再利用による過去証拠の欠落として扱う。復元・上書き・旧 hash の訂正で一致したと装わない。

主担当の `work/evidence/2026-09-10-initialization-log-erratum.md` を確認した。旧参照は採用根拠から除外し、独立最終レビューの「過去ログ保持」という一般的説明にもこの例外を明示している。新採用JSONも `historicalEvidenceErratum` と boundary で同じ限定を記録する。現在ログと追補を両方保存する。

レビュー表の work/evidence・work/reviews への25参照を横断比較し、不一致はこの1件だけ。最終 HARD-08 採用が直接束縛する26対象は別名r6証拠を含めてすべて一致し、42独立成功を再確認できる。そのため、欠落を隠さず明示除外する条件で今回の限定採用・private送信を妨げない。ログの排他的作成は後続課題であり、今回実装済みではない。

## Adoption and verification preserved

読み取りで実行:

```text
node work/evidence/2026-09-10-initialization-adoption-check.mjs
node work/evidence/2026-09-10-acceptance-adoption-check.mjs
```

- HARD-08: immutable final review `4220e6213ce940db76b23a080fd621684511722cdf99b6e1f5661147f07efe81` と26固定対象が一致。
- Prior simulation: review と11 snapshot が一致。既存採用JSONに記録された2文書のstatus注記だけを許容。
- Prior HIMP-01: code/test 5対象が一致し、3文書は承認済みstatus/link差のみ。8受入条件、独立レビュー、verifying task、receipt未発行を保持。
- 主担当の直前 `work/evidence/2026-09-10-private-push-full.log` は505 tests / 504 pass / 0 fail / 1既存skip、exit0。これは読んだ主担当結果であり、出版チェック中に別の全回帰を行ったとは主張しない。
- HARD-08 の実装レビューで独立42 pass、関連151 pass / 1既存skipを確認済み。今回 runtime / 既存レビュー bytes の変更はない。

## Staged whitespace classification

全体の `git diff --cached --check` は **exit2** であり、全面成功とは報告しない。独立に staged 内容から4913警告を分類した結果、CR末尾だけが4866、過去logのその他末尾空白が39、EOFの空行が8だった。CR以外は合計47。非logの警告は task-visibility要件、source-ledger、work STATUS、独立probe/reviewの最終空行のみで、コード中の変更や誤った実行内容ではない。

次の実装・設定・通常設計/運用文書の範囲は **exit0**:

```text
git diff --cached --check -- .gitattributes tools tests harness .claude .github docs/harness/design docs/harness/operations docs/harness/decisions
```

Gitの空白設定を緩めず、固定証拠bytesを整形して警告を隠すこともしない。この限定された非意味的警告は記録したうえで受容できる。

初回197ステージblobを `git cat-file --batch` のraw bufferと作業コピーで独立比較した。差は当時編集・追記中の `work/evidence/2026-09-10-private-source-push.md` 1件だけで、runtime / 固定採用対象の差は0。本レビューと当該出版記録を最終restageした後、全件一致を再確認する。

## Final send conditions

内容・採用根拠・改行保存に未解消の送信阻害事項はない。主担当は本記録・追補・採用JSON・`.gitattributes` を含む意図した差分をステージし、次を満たしてから通常 push する。

1. ステージ対象が意図した累積ハーネス差分で、無関係ファイルや秘密情報を追加していない。
2. 上記の実装・設定・通常文書範囲の cached check が成功し、全体checkは明記した履歴CR/末尾空白/EOF以外の問題を含まない。本レビュー・出版記録をrestageした後、全ステージblobの bytes が作業コピーに一致し、採用snapshotチェックも成功する。
3. 送信先が同じ private origin/main のままで、remote の進行や新たな変更がない。必要なら再確認し、force を使わない。
4. push 後に remote main が送信 commit と一致することを別途確認する。本報告はその完了証拠ではない。

version/tag、public化、Databricks接続/生成/deploy、provider、案件反映、成熟度昇格は範囲外。限定採用を再び人の承認待ちへ戻す必要はないが、残る機械的送信確認は省略しない。
