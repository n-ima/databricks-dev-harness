# 受入条件の記法とエラーの直し方

HIMP-01の正式採用済み仕様（2026-09-10、[ADR-0006](../decisions/ADR-0006-acceptance-integrity-adoption.md)）。ローカルハーネスへの採用であり、公開・案件反映は別段階。要件を承認する前と、レビュー結果をseal・利用するときに共通の検証を行う。

## 対応形式

- ID文法: ASCIIの大文字prefix、任意の大文字subprefix、最後は数値。実装の式は ^[A-Z]+(?:-[A-Z]+)*-[A-Z]*\d+$ 。長さ96文字以内。AC-01、AC-D01、AC-DATA-02、H-01に対応する。
- 定義: ハイフン等のbullet（-/*/+）、任意のcheckbox（空白/x/X）、ID、半角colon、同じ行の空でない本文。IDの装飾・大小文字の自動変換・重複排除はしない。
- 例:

~~~markdown
## Acceptance criteria

- AC-D01: ログイン済み利用者が商品を登録し、再読込後も内容が一致する。
- [ ] AC-D02: 未認証の登録要求を拒否する。
~~~

- 見出しなしの旧形式も対応。Acceptance criteria（大文字小文字不問）、受入条件、受け入れ条件のATX/setext見出しがあれば正式な範囲になる。同じ深さ以上の次の見出しでその範囲を終了する。複数範囲は合算し重複を拒否する。
- 正式範囲の外に定義候補がある場合は無視せず場所を示して拒否する。単なる本文中の参照、一般的な箇条書き、生成された質問台帳は条件と数えない。
- headingなしでも、ACで始まるID候補、大文字prefixと区切りを持つ候補、数字を持つIDラベル、小文字の数値付きIDを見落とさない。自然言語から書かれていないIDを推論する機能ではない。
- 定義候補の検知では、先頭の非対応bullet（•等）・装飾・不可視format文字を取り除いて調べるが、実際のID・本文は修正せず不正な元記法を拒否する。見出しも同じ候補判定を通す。例外は生成済みの質問台帳内にある所定深さのQ-ID + category見出しのみで、Q-prefix全体を除外しない。

## Markdownの境界

CommonMark全体を実装したparserではなく、限定した契約をfail-closedに読む。0〜3spaceの同じインデントで定義する。混在インデント・入れ子、4space/tabコード風定義、引用、表、番号付きリスト、装飾IDは条件の定義に使わない。対応しない書き方を受理したふりはせず、通常のbulletへ移すようエラーを出す。

閉じた先頭frontmatter、HTMLコメント、fenced codeの例は受入条件ではない。例しかなければ0件として拒否する。frontmatter/comment/fenceが閉じていない場合も拒否する。fenceの種類・長さを照合し、backtickのinfo内にbacktickがある曖昧な記法は拒否する。raw HTML blockは未対応として明示拒否する。

## 診断と対応

| 診断 | 対応 |
| --- | --- |
| No acceptance criteria | 合意した観測可能な条件を記載する。空文書を完了扱いにしない。 |
| Invalid acceptance / location | 指定行の記法や配置を直す。条件の意味を勝手に変えない。 |
| Empty acceptance criterion | IDだけでなく成功を判定できる本文を書く。 |
| Duplicate acceptance criterion | 両方の内容を確認し、一意なIDに整理して必要な再承認を得る。 |
| Missing acceptance criteria | 表示されたIDの検証と証拠を追加する。条件を削除して通さない。 |
| Unexpected acceptance criteria | 別要件の結果を混ぜていないか、レビュー対象を確認する。 |
| Verification policy hash is stale | 新しい検証器で独立再レビューする。古いreceiptのhashを書き換えない。 |

要件承認では、入力と回答台帳反映後の最終要件を検査し、不正なら要件・session・plan・manifest・既存approvalを更新しない。一般的なI/O障害の全ファイルtransactionを保証するものではない。

既存要件のproduct-intent承認は、解析した本文bytesのhashとsessionの要件参照を固定する。session lock内で参照と現hashを再確認し、不一致ならapprovalを作らず承認状態を変更しない。sealもreviewと要件の解析済みbytesをhashし、保存前に変化を再確認する。receipt利用時は、hash照合した同じ要件bytesからstatusと受入条件を解析する。hash後に別の未照合本文を読んで合格することは許さない。

これはローカル読取時点の整合性であり、複数ファイルを跨ぐdatabase transactionや同一OS権限の敵対的writerを停止する仕組みではない。全書込完了まで他プロセスが編集できないという保証はしない。要件を変更したら再承認・再レビューし、旧hashを新しい内容へ付け替えて使わない。

既存accepted要件や案件ファイルは自動移行しない。レビューは要件のIDと過不足なく一致させる。fail/not-runを含む正しいレビューはfail receiptになり、完了には使えない。session/task/loopの完了は引き続き独立性、ハッシュ、有効な承認などの既存検証を必要とする。

## 依存と配布

外部Markdown ASTも比較したが、今の依存なしCLIのbootstrap・隔離fixture・配布方式を同時に変更する必要があるため今回は追加しない。限定記法と曖昧さの拒否を回帰で固定する。一般Markdownの完全対応が必要になったら、依存固定・bootstrappingを含む別の変更として評価する。
