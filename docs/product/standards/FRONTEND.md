# Frontend and visualization standard

Last verified: 2026-09-04  
Review after: 2026-10-04

## Default stack

- Databricks AppKit
- React + TypeScript + Vite
- `@databricks/appkit-ui`
- AppKit UI charts backed by Apache ECharts
- AppKit UI tables backed by TanStack Table
- React Hook Form plus schema validation
- Vitest and Playwright

Do not add MUI, another design system, Recharts, Plotly, Highcharts, or another table framework by default. A second library requires an ADR showing the required interaction AppKit/ECharts cannot reasonably provide.

## Executable mock gate

画面の設計・プレビューからDatabricks Appsを既定にする。AppKitはハーネスの既定であり、Databricksプラットフォームの唯一の対応frameworkという意味ではない。外部ホスティング/別frameworkは明示された要件と例外判断が必要。

HTMLの紙芝居も、採用した実コンポーネント・スタイルを描画して生成したものに限定する。独自CSSやspanで似せた別UIを実装予定画面として承認依頼しない。静的描画は見た目専用で、操作承認には同じアプリのfixtureモックが必要。既存アプリを再利用する。詳細と変更時の再確認は `docs/harness/operations/UI_RUNTIME_FIDELITY.md` に従う。

Mocks use production components and synthetic fixtures. They are kept as deterministic application states and tests, not discarded after approval.

Required evidence:

- primary journey;
- desktop and narrow screenshots;
- loading, empty, error, partial, denied, and success states as applicable;
- realistic Japanese labels without production data;
- units, definitions, filters, time zone, and freshness;
- keyboard path and accessibility result;
- explicit unresolved questions.

Do not connect production data, create write permission, or optimize the backend before mock approval.

## Visual design

- Start with the user decision, not all available metrics.
- Give a page one primary task and a message-oriented title.
- Prefer three to five top KPIs with comparison and freshness.
- Use lines for time, bars for ranked comparisons, tables for high-cardinality details, scatter for relationships.
- Avoid pie/donut charts where comparison matters or categories exceed five.
- Keep semantic color consistent and reserve warning/error colors.
- Do not truncate axes or use dual axes without analytical justification.
- Genie output shows sources/SQL when available and a persistent verification notice.

Page components compose domain components; domain components use AppKit UI primitives. Data acquisition and mutation stay outside visual components. Validate responses at the boundary and represent all states explicitly.

## Sources

- https://github.com/databricks/appkit
- https://github.com/databricks/app-templates
- https://github.com/databricks/databricks-agent-skills/tree/main/skills/databricks-app-design
