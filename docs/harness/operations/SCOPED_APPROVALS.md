# 案件の承認範囲の記録と引継ぎ

状態: HARD-03のローカル実装候補。正式採用前。ハーネス自身をDatabricksへ配備する機能ではない。
[契約と制約](../design/SCOPED_APPROVALS.md)。

## 普段の使い方

ユーザーは案件のチャットで「この開発環境・資源・操作・上限の範囲で進めてよい」と
判断する。エージェントは実際の判断を資料に記録し、具体的なscopeと有効期限を保存する。
資料から推測した内容や単なる「続けて」を、新しい環境・権限・費用の承認に変換しない。

次のsessionや別providerへ引き継ぐとき、エージェントが同じrequestをcheckする。
一致すれば同じscopeについて人に聞き直す必要はない。ただし要件・モックなどの
未解決gate、実行先の権限、実配備の別条件はそのまま残る。
今回のcheckは実行を開始せず、実行adapterや旧loop gateへ自動的に接続もしない。

## requestの例（合成値。実環境の承認には使わない）

```json
{
  "schemaVersion": 1,
  "product": "orders",
  "component": "apps/orders",
  "candidateSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "environment": "dev",
  "workspace": { "host": "https://fixture.invalid", "id": "workspace-1", "profile": "fixture-dev" },
  "principal": "app-1",
  "resources": ["table-1", "app-1"],
  "operations": ["deploy", "read"],
  "permissions": [{ "resource": "table-1", "privilege": "SELECT" }],
  "cost": { "currency": "USD", "maximumMinor": 100, "basis": "total-candidate" }
}
```

USDのminor unitはcent、JPYは円。上限は同じ候補についての合計予算の申告であり、
予算の消費測定・予約や課金側hard limitではない。candidateSha256も呼出し元が明示する
識別値であり、このcheckがbuild/artifact一致を検証したことにはならない。
hostは接続先の記録のみで通信しない。componentも存在/型/パスを調べるだけで実行しない。

## エージェント用コマンド

以下のID・path・日時は説明用。案件rootで実際の人の決定と対象へ置換する。
expires-atは発行時より未来・30日以内のUTC日時でなければ拒否する。

```text
npm run harness -- approval-scope record --id dev-orders-01 --session SESSION_ID --request work/evidence/scope-request.json --actor product-owner --evidence work/evidence/human-scope-decision.md --expires-at 2026-09-11T00:00:00Z
npm run harness -- approval-scope check --id dev-orders-01 --session RESUMED_SESSION_ID --request work/evidence/scope-request.json
npm run harness -- approval-scope revoke --id dev-orders-01 --actor product-owner --evidence work/evidence/human-revocation.md
```

record/revokeが作るファイルは `work/approvals/scopes/` 内だけ。原本の上書きや期限延長は
ない。変更は新しい人の判断と別IDで記録する。旧IDのcheckには撤回が反映される。
原本のJSONを手で編集しない。破損・根拠変更・期限切れは再判断が必要。

`eligibleForReuse: true` は現在のファイルを照合した瞬間に範囲が一致したという記録。
`executionAuthorized: false`、`identityAuthenticated: false`、`candidateVerified: false`、
`costEnforced: false`は常に維持する。`unresolvedGate`があればそれも別途解決する。
falseまたは読取errorは停止してreasonを調べ、近い承認やDEFAULTへfallbackしない。

## 検証限界

ローカルJSONのhashは署名や本人認証ではない。同じproject config/文書をコピーした
checkoutの独立した所有者を識別できない。同権限の敵対processに対するOS sandboxでもない。
既存legacy approvalとsimulation approvalは新台帳として受理せず、逆向きの旧gateへの流用も拒否する。
ハーネス更新でcontrol codeが変われば旧scopeは不一致となる。原本を新hashへ書換えて通さない。
