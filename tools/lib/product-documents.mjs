import { readFile } from 'node:fs/promises';

// Human-facing descriptions. IDs and original catalog hints remain in intake.json.
const NOTES = {
  'rich-app': 'AppKitの画面とserverを分離。業務データ接続前にfixtureモックを確認する。',
  api: 'Apps HTTP / Model Serving / platform API clientを選び分ける。Appsは /api/、OAuth、CAN USEを確認する。',
  analysis: '読み取り中心の探索分析。問い・仮説・再現条件とwarehouse/Connectを明示する。',
  'data-pipeline': 'Lakeflow Jobs/PipelinesとDeltaの分析用処理。アプリのトランザクション更新とは分ける。',
  ingestion: 'connector/CDC/Zerobusの取り込み。利用可能性、schema変更、再送・offset・回復を確認する。',
  lakebase: 'LakebaseのPostgreSQLトランザクション。制約・競合・冪等性・OAuth更新・移行を検証する。',
  genie: 'Genieによる管理された自然言語分析。代表/曖昧/拒否質問と権限を評価する。',
  dashboard: 'AI/BI Dashboardは明示選択時だけ。独自の分析画面はAppKitで作る。指標一致と閲覧権限を確認する。',
  'metric-view': 'Unity Catalog metric viewでSQL・Genie・Appsの指標定義を共有し、MEASUREの一致を検証する。',
  ml: 'Classical ML（機械学習）の学習・評価・登録。GenAIの採点と分離し、データ漏洩・分割・MLflowの来歴を確認する。',
  'model-serving': '管理された推論endpoint。Apps HTTPとは分け、入出力、失敗、権限、遅延、段階公開を検証する。',
  rag: '検索/indexと生成を分離し、出典・検索品質・鮮度・ACL・prompt injectionへの耐性を評価する。',
  agent: 'agentのtool権限・実行主体・MCP境界・費用上限を明示し、拒否とtraceを検証する。自動更新権限は推定しない。',
  governance: 'まず読み取りの資産調査。grant、masking、owner変更には承認。別の実行主体で拒否を確認する。',
  sharing: '共有/federationは外部データ境界。受取先・失効・検索範囲・費用を検証する。',
  automation: 'workspace/account APIと実行主体を区別。明示profile/targetと最小権限で差分を確認する。',
};
export const documentedWorkloads = Object.keys(NOTES);
const uiDesign = [
  '| 画面ID | 画面名・目的 | 利用者・機能ID | 表示/入力項目ID | 操作・遷移先 | 状態・権限 |',
  '|---|---|---|---|---|---|',
  '| UI-01 | 未確定 | 未確定 | 未確定 | 未確定 | 未確定 |',
  '',
  '| 遷移元→遷移先 | 操作・条件 | 引き継ぐデータ | 戻る/取消・未保存・拒否 |',
  '|---|---|---|---|',
  '| 未確定 | 未確定 | 未確定 | 未確定 |',
  '',
  '必要な状態（通常・読込・空・エラー・権限不足・部分データ）と入力の必須/検証/メッセージを定義する。配置・導線が不確かなら軽量HTML紙芝居で先に確認する。紙芝居だけの承認は入力や状態を確認したui-mock承認ではない。詳細は docs/product/ui/ に分離できる。',
].join('\n');

async function template(name, values) {
  // Templates ship beside this installed module; caller data is never a template path.
  const source = await readFile(new URL('../../harness/templates/' + name + '.md', import.meta.url), 'utf8');
  return source.replace(/\{\{([a-zA-Z]+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw new Error('Unknown document template key: ' + key);
    return values[key]; // One pass: user text is data, never recursively expanded.
  });
}
export async function productDocuments(manifest, requirementPath, name) {
  const tick = String.fromCharCode(96);
  const values = {
    id: manifest.id, title: manifest.title, created: manifest.createdAt, updated: manifest.updatedAt,
    intake: 'docs/product/intake/' + manifest.id + '/intake.json', summary: manifest.summary,
    requirement: requirementPath, name,
    sources: manifest.sources.map(s => '- ' + tick + s.path + tick + '（SHA-256 ' + tick + s.sha256 + tick + '、未検証の入力）').join('\n') || '- 添付資料なし。現時点の根拠は上記の依頼のみ。',
    workloads: manifest.workloadSelection.workloads.map(w => '- **' + w.id + '**: ' + (NOTES[w.id] || '未確定。対象機能と入出力の確認が必要。')).join('\n') || '- 未確定。Q-00を解決してから実装方式を選ぶ。',
    questions: manifest.questions.map(q => '- [ ] **' + q.id + ' ' + q.category + '** — ' + q.question).join('\n'),
    ui: manifest.capabilities.ui
      ? '画面と導線を確認し、必要な入力・状態を含むfixtureモックを実行して人が確認する。対象sliceの業務データ接続前にui-mock承認を記録する。'
      : '画面は適用外（現在の選択にUIなし）。API/分析等の入出力で確認する。UIを追加する場合は要件と承認範囲を見直す。',
    uiDesign: manifest.capabilities.ui ? uiDesign : '画面一覧・画面遷移は適用外（現在の選択にUIなし）。UI承認は不要。APIや分析の出力契約は外部境界で定義する。',
    verification: '- 対象機能ごとの主要リスクを上記の設計条件から洗い出し、正常・拒否・回復を検証する。実環境の確認は承認された開発環境で別途行う。',
  };
  values.boundaries = values.workloads + '\n\n参照する公式skill（対象に関係するものだけ読む）:\n' +
    [...new Set(manifest.workloadSelection.workloads.flatMap(w => w.skills))].map(s => '- ' + tick + 'vendor/databricks-skills/' + s + '/SKILL.md' + tick).join('\n');
  return {
    requirement: await template('product-requirement', values),
    architecture: await template('product-architecture', values),
  };
}
