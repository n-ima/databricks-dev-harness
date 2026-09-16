// Opt-in real dependency/browser probe. Never runs during the dependency-free test suite.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,lstat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,join,dirname,relative,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';

const args=process.argv.slice(2),opts={};
for(let i=0;i<args.length;i+=2){assert(['--runtime-root','--browser-packages','--output'].includes(args[i])&&args[i+1]&&!opts[args[i]],'invalid/duplicate argument');opts[args[i]]=args[i+1];}
for(const key of ['--runtime-root','--browser-packages','--output'])assert(opts[key],key+' required');
const fixture=dirname(fileURLToPath(import.meta.url)),repo=resolve(fixture,'../../..'),output=resolve(repo,opts['--output']);
assert(output.startsWith(join(repo,'work','evidence')+sep),'output must be a new work/evidence subdirectory');
// A lexical prefix does not contain writes when an existing ancestor is a link.
// Check before mkdir or loading dependencies; this is not an OS sandbox or a
// defense against another process replacing ancestors concurrently.
for(let current=output;;current=dirname(current)){
  try{assert(!(await lstat(current)).isSymbolicLink(),'symlink or junction output is not allowed');}
  catch(error){if(error.code!=='ENOENT')throw error;}
  if(dirname(current)===current)break;
}
await mkdir(output); // refuse reuse/overwrite; no recursive removal
const runtime=resolve(opts['--runtime-root']),deps=join(runtime,'node_modules');
const requireRuntime=createRequire(join(runtime,'package.json'));
const requireBrowser=createRequire(join(resolve(opts['--browser-packages']),'__probe__.cjs'));
const packageAt=async name=>JSON.parse(await readFile(join(deps,name,'package.json'),'utf8'));
const versions={appkitUi:(await packageAt('@databricks/appkit-ui')).version,react:(await packageAt('react')).version,vite:(await packageAt('vite')).version,node:process.version};
const {build}=await import(pathToFileURL(requireRuntime.resolve('vite')).href);
const {default:react}=await import(pathToFileURL(requireRuntime.resolve('@vitejs/plugin-react')).href);
const {default:tailwind}=await import(pathToFileURL(requireRuntime.resolve('@tailwindcss/vite')).href);
const {chromium}=requireBrowser('playwright');
const aliases=[
  ...['@databricks/appkit-ui/react','@databricks/appkit-ui/styles.css'].map(name=>({find:name,replacement:requireRuntime.resolve(name).replaceAll('\\','/')})),
  {find:'tw-animate-css',replacement:join(deps,'tw-animate-css',(await packageAt('tw-animate-css')).exports['.'].style).replaceAll('\\','/')},
  {find:'tailwindcss',replacement:join(deps,'tailwindcss/index.css').replaceAll('\\','/')},
  ...['react-dom','react'].map(name=>({find:name,replacement:join(deps,name).replaceAll('\\','/')})),
];
const started=Date.now(),dist=join(output,'dist');
const sourceHashes={};for(const name of ['main.jsx','style.css','index.html','probe.mjs'])sourceHashes[name]=createHash('sha256').update(await readFile(join(fixture,name))).digest('hex');
let server,browser;
const result={versions,sourceHashes,fixtureType:'prepared real-component display; not an agent/provider evaluation',checks:[],errors:[],remoteRequests:[],backendRequests:[]};
try{
  await build({root:fixture,configFile:false,envDir:false,envPrefix:[],plugins:[react(),tailwind()],resolve:{alias:aliases},build:{outDir:dist,emptyOutDir:false},logLevel:'warn'});
  result.buildMilliseconds=Date.now()-started;
  server=createServer(async(req,res)=>{
    try{const requested=new URL(req.url,'http://localhost').pathname;const path=resolve(dist,'.'+(requested==='/'?'/index.html':requested));if(!path.startsWith(dist+sep))throw Error('outside fixture');const bytes=await readFile(path);res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(bytes);}catch{res.writeHead(404);res.end('not found');}
  });
  await new Promise(resolveReady=>server.listen(0,'127.0.0.1',resolveReady));
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});
  versions.browser=browser.version();
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror',error=>result.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')result.errors.push(message.text());});
  page.on('websocket',socket=>result.backendRequests.push(socket.url()));
  await page.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){result.remoteRequests.push(route.request().url());return route.abort();}if(['fetch','xhr'].includes(route.request().resourceType())){result.backendRequests.push(route.request().url());return route.abort();}return route.continue();});
  await page.goto(origin);
  await page.getByRole('cell',{name:'青いノート'}).waitFor();
  await page.screenshot({path:join(output,'01-list.png'),fullPage:true});result.checks.push('actual Table and Input rendered');
  const beforeInput=await page.getByLabel('商品分類（配置確認用）').boundingBox(),beforeTable=await page.getByRole('table').boundingBox();assert(beforeInput.y>beforeTable.y);
  await page.getByLabel('商品分類（配置確認用）').fill('文房具');await page.getByRole('button',{name:'絞り込む（未接続）'}).click();assert.match(await page.getByRole('status').innerText(),/未接続/);
  await page.getByRole('button',{name:'売上入力',exact:true}).click();await page.getByLabel('数量').fill('2');await page.getByRole('button',{name:'登録（未接続）'}).click();assert.match(await page.getByRole('status').innerText(),/未実装/);await page.screenshot({path:join(output,'02-entry.png'),fullPage:true});result.checks.push('local input and explicit unimplemented save');
  await page.getByRole('button',{name:'日々の売上',exact:true}).click();await page.locator('canvas').waitFor();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('canvas')).some(canvas=>{const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let blue=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+2]>pixels[i+1]*1.3&&pixels[i+2]>pixels[i]*1.3&&pixels[i+3]>100)blue++;return blue>20;}),null,{timeout:5000});
  await page.screenshot({path:join(output,'03-chart.png'),fullPage:true});result.checks.push('actual LineChart static data and colored series rendered');
  await page.goto(origin+'/?layout=revised');await page.getByRole('cell',{name:'青いノート'}).waitFor();const afterInput=await page.getByLabel('商品分類（配置確認用）').boundingBox(),afterTable=await page.getByRole('table').boundingBox();assert(afterInput.y<afterTable.y);await page.screenshot({path:join(output,'04-layout-change.png'),fullPage:true});result.checks.push('same components support filter above table');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(output,'05-narrow.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));result.checks.push('narrow page has no horizontal overflow');
  assert.deepEqual(result.remoteRequests,[]);assert.deepEqual(result.backendRequests,[]);assert.deepEqual(result.errors,[]);result.status='pass';
}catch(error){result.status='fail';result.failure=error.stack;process.exitCode=1;}
finally{if(browser)await browser.close();if(server)await new Promise(done=>server.close(done));result.wallMilliseconds=Date.now()-started;await writeFile(join(output,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({output:relative(repo,output),...result},null,2));}
