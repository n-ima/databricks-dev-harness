import React, { useState } from 'react';
import { Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, LineChart, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@databricks/appkit-ui/react';
import { products, dailySales } from './fixtures';

export type SaleDraft = { salesDate: string; productId: string; quantity: string };
const yen = new Intl.NumberFormat('ja-JP');
const chartOptions = { animation: false, yAxis: { type: 'value', min: 0, axisLabel: { formatter: (value: number) => yen.format(value) }, splitLine: { lineStyle: { color: '#e8eef5' } } }, grid: { left: 64, right: 28, top: 24, bottom: 46 } };

export function SalesEntry({ draft, onChange, onBack }: { draft: SaleDraft; onChange: (value: SaleDraft) => void; onBack: () => void }) {
  const product = products.find(item => item.productId === draft.productId);
  const canPreview = Boolean(draft.salesDate && product && draft.quantity.trim());
  return <>
    <header className="page-header"><div><p className="eyebrow">売上管理</p><h1>売上入力</h1><p className="subtitle">売上日と商品を選び、数量を入力します。</p></div><Badge variant="outline">配置・動きの案</Badge></header>
    <div className="entry-layout">
      <Card><CardHeader><CardTitle>売上の内容</CardTitle><CardDescription>まずは1商品分の入力を確認します。</CardDescription></CardHeader><CardContent className="entry-form">
        <div className="field-group"><Label htmlFor="sales-date">売上日</Label><Input id="sales-date" type="date" value={draft.salesDate} onChange={event => onChange({ ...draft, salesDate: event.target.value })} /></div>
        <div className="field-group"><Label htmlFor="sale-product">商品</Label><Select value={draft.productId} onValueChange={value => onChange({ ...draft, productId: value })}><SelectTrigger id="sale-product" className="full-select"><SelectValue placeholder="商品を選択してください" /></SelectTrigger><SelectContent>{products.map(item => <SelectItem key={item.productId} value={item.productId}>{item.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="field-group quantity-field"><Label htmlFor="sale-quantity">数量</Label><Input id="sale-quantity" inputMode="decimal" value={draft.quantity} placeholder="例：2" onChange={event => onChange({ ...draft, quantity: event.target.value })} /><p className="field-help">数量の単位・小数の扱いは確認中です。</p></div>
        <div className="entry-actions"><Dialog><DialogTrigger asChild><Button disabled={!canPreview}>入力内容を確認</Button></DialogTrigger><DialogContent showCloseButton={false}><DialogHeader><DialogTitle>入力内容の確認</DialogTitle><DialogDescription>内容を見直すための画面です。まだ保存されません。</DialogDescription></DialogHeader><dl className="confirmation"><dt>売上日</dt><dd>{draft.salesDate}</dd><dt>商品</dt><dd>{product?.name}</dd><dt>数量</dt><dd>{draft.quantity}</dd></dl><DialogFooter><DialogClose asChild><Button>入力へ戻る</Button></DialogClose></DialogFooter></DialogContent></Dialog><Button variant="ghost" onClick={onBack}>商品一覧へ戻る</Button></div>
      </CardContent></Card>
      <Card className="selected-product"><CardHeader><CardTitle>選択した商品</CardTitle><CardDescription>商品を選ぶと内容が表示されます。</CardDescription></CardHeader><CardContent>{product ? <><Badge variant="secondary">{product.category}</Badge><h2>{product.name}</h2><p className="price-label">税込単価</p><p className="selected-price">¥{yen.format(product.priceInclusiveYen)}<span> / 商品</span></p></> : <p className="unselected-product">左側で商品を選択してください。</p>}</CardContent></Card>
    </div>
    <p className="draft-note">架空の商品を使った確認画面です。入力は画面移動で保持されますが、再読み込みすると消えます。</p>
  </>;
}

export function DailySalesChart({ period, onPeriodChange }: { period: string; onPeriodChange: (value: string) => void }) {
  const [showValues, setShowValues] = useState(false);
  const visible = dailySales.slice(-Number(period));
  const chartData = visible.map(row => ({ 日付: row.label, 売上金額: row.totalInclusiveYen }));
  return <>
    <header className="page-header"><div><p className="eyebrow">売上の推移</p><h1>日々の売上グラフ</h1><p className="subtitle">日ごとの売上金額を、期間を切り替えて確認します。</p></div><Badge variant="outline">配置・動きの案</Badge></header>
    <Card><CardHeader className="list-header"><div><CardTitle>日別の売上</CardTitle><CardDescription>税込売上金額 / 円</CardDescription></div><Badge variant="secondary">架空の売上データ</Badge></CardHeader><CardContent>
      <div className="filter-row"><div className="category-filter"><Label htmlFor="chart-period">表示期間</Label><Select value={period} onValueChange={onPeriodChange}><SelectTrigger id="chart-period" className="category-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">7日間</SelectItem><SelectItem value="14">14日間</SelectItem></SelectContent></Select></div><p className="result-count" aria-live="polite">{visible[0].salesDate} 〜 {visible[visible.length - 1].salesDate}</p></div>
      <LineChart data={chartData} xKey="日付" yKey="売上金額" height={340} colors={['#1764c0']} smooth={false} showSymbol showLegend={false} valueFormatter={value => `¥${yen.format(Number(value))}`} options={chartOptions} ariaLabel={`${period}日間の日別税込売上金額。数値は下の表でも確認できます。`} testId="daily-sales-chart" />
      <div className="chart-footer"><p>表示する値は日別に用意した見本です。売上入力とは連動していません。</p><Button variant="outline" onClick={() => setShowValues(value => !value)} aria-expanded={showValues} aria-controls="daily-sales-values">{showValues ? '数値を閉じる' : '数値を表示'}</Button></div>
      {showValues && <div id="daily-sales-values"><Table aria-label="日別売上の数値"><TableHeader><TableRow><TableHead>売上日</TableHead><TableHead className="price-column">税込売上金額（円）</TableHead></TableRow></TableHeader><TableBody>{visible.map(row => <TableRow key={row.salesDate}><TableCell>{row.salesDate}</TableCell><TableCell className="price-column">¥{yen.format(row.totalInclusiveYen)}</TableCell></TableRow>)}</TableBody></Table></div>}
    </CardContent></Card>
    <p className="draft-note">期間は2026年9月16日を基準にした表示例です。集計方法・表示期間は案として確認します。</p>
  </>;
}
