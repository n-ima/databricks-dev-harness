import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Button, Card, CardHeader, CardTitle, CardContent, Input, Label, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, LineChart} from '@databricks/appkit-ui/react';
import './style.css';

// Only display fixtures: no API, SQL, identity, persistence or business calculation.
const products=[{name:'青いノート',category:'文房具',price:350},{name:'白いマグ',category:'生活雑貨',price:900}];
const daily=[{日付:'9/14',売上:2100},{日付:'9/15',売上:3450},{日付:'9/16',売上:2900}];
const screens=[['list','商品一覧'],['entry','売上入力'],['dashboard','日々の売上']];

function Fixture(){
  const [screen,setScreen]=useState('list');
  const [query,setQuery]=useState('');
  const [note,setNote]=useState('');
  const revised=new URLSearchParams(location.search).get('layout')==='revised';
  const filters=<div className="filters"><Label htmlFor="category">商品分類（配置確認用）</Label><Input id="category" value={query} onChange={e=>setQuery(e.target.value)} placeholder="例：文房具"/><Button variant="outline" onClick={()=>setNote('絞り込みは未接続です。配置を確認してください。')}>絞り込む（未接続）</Button></div>;
  return <main>
    <header><p className="eyebrow">Databricks Apps / 実AppKit部品のローカル検証</p><h1>商品・売上の配置確認</h1><p>合成データのみ。保存・集計・認証・DBは未実装。正式な画面承認ではありません。</p></header>
    <nav aria-label="検証画面">{screens.map(([id,title])=><Button key={id} variant={screen===id?'default':'outline'} onClick={()=>{setScreen(id);setNote('');}}>{title}</Button>)}</nav>
    {screen==='list'&&<section aria-label="商品一覧画面"><Card><CardHeader><CardTitle>商品一覧</CardTitle></CardHeader><CardContent>
      {revised&&filters}
      <Table><TableHeader><TableRow><TableHead>商品名</TableHead><TableHead>商品分類</TableHead><TableHead>税込単価（円）</TableHead></TableRow></TableHeader><TableBody>{products.map(p=><TableRow key={p.name}><TableCell>{p.name}</TableCell><TableCell>{p.category}</TableCell><TableCell>{p.price}</TableCell></TableRow>)}</TableBody></Table>
      {!revised&&filters}
    </CardContent></Card></section>}
    {screen==='entry'&&<section aria-label="売上入力画面"><Card><CardHeader><CardTitle>売上入力</CardTitle></CardHeader><CardContent><div className="entry">
      <Label htmlFor="date">売上日</Label><Input id="date" type="date" defaultValue="2026-09-16"/>
      <Label htmlFor="product">商品（試作）</Label><Input id="product" defaultValue="青いノート"/>
      <Label htmlFor="quantity">数量</Label><Input id="quantity" type="number" min="1" defaultValue="1"/>
      <Button onClick={()=>setNote('保存処理は未実装です。入力配置だけを確認しています。')}>登録（未接続）</Button>
    </div></CardContent></Card></section>}
    {screen==='dashboard'&&<section aria-label="日々の売上画面"><Card><CardHeader><CardTitle>日々の売上（架空の税込金額・円）</CardTitle></CardHeader><CardContent><LineChart data={daily} xKey="日付" yKey="売上" height={280} colors={['#2563eb']} options={{animation:false}} ariaLabel="3日間の架空売上" testId="daily-chart"/><p>9/14：2,100円、9/15：3,450円、9/16：2,900円。実集計は未接続。</p></CardContent></Card></section>}
    <p role="status">{note}</p>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
