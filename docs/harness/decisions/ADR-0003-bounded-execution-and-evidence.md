# ADR-0003: Bounded execution と証拠ベースの完了判定

- Status: proposed — 既存の安全方針を具体化する設計案。無人運転の有効化は独立検証と人レビュー後。
- Date: 2026-09-04
- Review after: 2026-10-04 または provider lifecycle / budget API の変更時
- Scope: harness runtime、provider adapter、session、verifier、evaluation

## Context

ユーザーは普通の自然言語から agent が手順を進めることを求めている。一方で、継続回数を増やすだけでは業務上の完了、安全な停止、context loss からの復旧は得られない。

配布は [ADR-0001](ADR-0001-distribution.md)、記憶の正本は [ADR-0002](ADR-0002-session-memory.md) に従う。本 ADR はそれらを変更せず、[HARNESS H-08、H-12〜H-16](../requirements/HARNESS.md) を runtime の検証契約へ落とす。

## Decision

1. **ファイルを正本にする。** 人が読める session と機械が検査する state を関連づけ、objective、acceptance、phase、iteration、開始時刻、budget、evidence、gate、終了理由を永続化する。provider transcript や内部 task list を唯一の記憶にしない。
2. **有限の反復を実行する。** 1 回は小さい検証可能な変更単位とし、iteration、wall time、child process timeout、cancel を runtime で扱う。provider が提供する金額制限は hard / soft、適用範囲を区別する。予算不明を無制限の許可に変えない。
3. **成功と停止を区別する。** 成功、human gate、外部 blocker、budget exhaustion、実行失敗、cancel を区別する。内部 enum 名は実装 schema を正本とし、すべてを session の「completed」に丸めない。
4. **機械的検証と独立 review を分離する。** ファイル存在・schema・lint・test・platform validation の合格に加え、別 context の verifier が acceptance と実際の振る舞いを検査する。verifier は実装を変更せず、具体的な反例・根拠・未検証を返す。
5. **完了証拠を対象版へ結びつける。** evidence に commit / working-tree digest、実行した検査、結果、対象環境、時刻を記録する。証拠作成後の関連変更は再検証を必要とする。ログの中の「done」や exit 0 だけで semantic acceptance を満たしたことにしない。
6. **lifecycle hook は補助的に使う。** SessionStart で短い context、PreCompact で checkpoint の必要性、Stop / agentStop で未達証拠と残予算を扱う。human gate や budget exhaustion の後に継続を強制しない。通知しかできない event に停止保証を持たせない。
7. **保護契約を自己改変させない。** implementation loop は evaluator、acceptance、security policy、budget の緩和を提案できるが、自分で承認して成功に変えられない。保護ファイルの編集制御、CI、branch / environment protection、least privilege を重ねる。
8. **human gate を明示する。** product intent、UI mock、sensitive data / permission、destructive migration、production release、および harness policy / verifier / budget の変更で停止する。承認は対象 scope・version・artifact に結びつけ、別 gate の承認へ流用しない。

## Provider adapter の境界

共通 workflow / state / validator は provider-neutral に保つ。event 名、JSON payload、skill metadata、CLI 引数だけを薄い adapter に置く。

- Claude `/goal` は継続の補助であり、ファイルを独立検証する完了証明ではない。
- Copilot Autopilot の continuation cap を利用しても、共通 runtime の総予算・監査を省略しない。
- VS Code、CLI、cloud は同じ provider でも別の実行 host として適合性を確認する。Preview、組織設定、workspace trust、hook 探索・重複発火の差を隠さない。
- review の context 分離は必須。実装の context を毎反復 reset するか compaction を利用するかは、モデル・task の評価で選ぶ。

## Alternatives rejected

- 無限に再起動する shell loop: 停止理由・予算・権限・復旧の契約がない。
- instruction だけの安全制御: hook timeout、設定無効化、自己改変、別経路を防げない。
- implementer の自己採点だけ: 同じ誤解を実装・テスト・説明へ繰り返す可能性がある。
- provider ごとに別の設計書・記憶・完了条件を持つ方式: switch / handoff と回帰評価が難しくなる。
- 毎 task で同じ重い multi-agent 構造を強制: 費用と latency が増える。独立 verification の要件を満たしつつ、不要な構成は評価して削る。

## Verification required before enablement

- 予算、cancel、crash、resume、stale evidence、未承認 gate を含む負例が deterministic test で失敗を検出する。
- fresh session が session file から再開し、実装の状態を再確認できる。
- provider / host 別に hook と skill discovery の実測を残す。payload fixture の合格だけで end-to-end compatibility を宣言しない。
- [golden-task 評価](../operations/EVALUATION.md)を同条件で反復し、verifier の見逃し・誤検知、費用、時間、人の介入を記録する。
- evaluator・閾値・権限・予算の変更は、実装 agent とは別の review と人の承認を必要とする。

## Consequences and evidence

安全な停止も正当な成果として報告できる一方、state / adapter / 負例テストの維持費用が生じる。human gate の承認自体は自動化できない。

根拠は [2026-09-04 evidence review の O-02〜O-14、R-02〜R-06](../research/2026-09-04-evidence-review.md)。この ADR は runtime が実装・実環境検証済みであることを示さず、L2 / L3 昇格の代わりにもならない。
