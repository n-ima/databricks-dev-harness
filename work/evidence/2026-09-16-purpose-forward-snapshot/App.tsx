import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@databricks/appkit-ui/react';
import { products } from './fixtures';
import { SalesEntry, DailySalesChart, type SaleDraft } from './SalesViews';
import './styles.css';

const yen = new Intl.NumberFormat('ja-JP');
const categories = [...new Set(products.map(product => product.category))];

function App() {
  const [screen, setScreen] = useState('products');
  const [draft, setDraft] = useState<SaleDraft>({ salesDate: '2026-09-16', productId: '', quantity: '' });
  const [period, setPeriod] = useState('7');
  const [category, setCategory] = useState('all');
  const visibleProducts = category === 'all' ? products : products.filter(product => product.category === category);
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">S</div><div>商品と売上<p>日々の記録を、ひとつに。</p></div></div>
      <nav aria-label="画面">{[{ id: 'products', label: '商品一覧' }, { id: 'sales', label: '売上入力' }, { id: 'chart', label: '日々の売上グラフ' }].map(item => <Button key={item.id} variant={screen === item.id ? 'default' : 'ghost'} className="nav-button" aria-current={screen === item.id ? 'page' : undefined} onClick={() => setScreen(item.id)}>{item.label}</Button>)}</nav>
      <div className="sidebar-note">架空データで<br/>配置と動きを確認中です。</div>
    </aside>
    <main>
      {screen === 'products' && <>
      <header className="page-header"><div><p className="eyebrow">商品管理</p><h1>商品一覧</h1><p className="subtitle">商品名・分類・価格をひと目で確認できます。</p></div><Badge variant="outline">画面の配置案</Badge></header>
      <Card className="product-card"><CardHeader className="list-header"><div><CardTitle>取り扱い商品</CardTitle><CardDescription>金額はすべて税込</CardDescription></div><Badge variant="secondary">円 / JPY</Badge></CardHeader><CardContent>
        <div className="filter-row">
          <div className="category-filter">
            <Label htmlFor="category-filter">商品分類で絞り込み</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category-filter" className="category-select"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">すべての商品分類</SelectItem>{categories.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <p className="result-count" aria-live="polite">{visibleProducts.length} / {products.length} 商品を表示</p>
        </div>
        <Table aria-label="商品一覧">
          <TableHeader><TableRow className="table-heading"><TableHead className="category-column">商品分類</TableHead><TableHead className="name-column">商品名</TableHead><TableHead className="price-column">税込単価（円）</TableHead></TableRow></TableHeader>
          <TableBody>{visibleProducts.map(product => <TableRow key={product.productId}><TableCell><Badge variant="secondary">{product.category}</Badge></TableCell><TableCell className="product-name">{product.name}</TableCell><TableCell className="price-column">¥{yen.format(product.priceInclusiveYen)}</TableCell></TableRow>)}</TableBody>
        </Table>
      </CardContent></Card>
      <p className="draft-note">架空の商品データを表示しています。今回は一覧の配置を確認する画面です。</p>
      </>}
      {screen === 'sales' && <SalesEntry draft={draft} onChange={setDraft} onBack={() => setScreen('products')} />}
      {screen === 'chart' && <DailySalesChart period={period} onPeriodChange={setPeriod} />}
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
