import http from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const file = root + 'data/articles.json';
await mkdir(root + 'data', { recursive: true });
const samples = [
 ['technology','US','Новые идеи в мире технологий','New ideas in technology'],
 ['science','GB','Наука: открытия, которые меняют мир','Science: discoveries shaping our world'],
 ['economy','RU','Экономика: на что обратить внимание','Economy: what to watch'],
 ['culture','GB','Культура без границ','Culture without borders'],
 ['sport','US','Спорт: главные темы недели','Sport: this week’s talking points'],
 ['travel','RU','Путешествия: открываем новые места','Travel: discovering new places']
 ].map(([category,country,ru,en],i)=>({id:String(i+1),category,country,title:{ru,en},body:{ru:'Это демонстрационный материал для проверки работы портала. Он не является реальной новостью. Здесь появится текст, подготовленный редакцией и проверенный перед публикацией.',en:'This is sample content for testing the portal, not a real news report. Verified editorial content will appear here before publication.'},status:i<4?'published':'pending',demo:true}));
let articles;
try { articles = JSON.parse(await readFile(file,'utf8')); } catch(e) { if(e.code!=='ENOENT') throw e; articles=samples; }
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
http.createServer(async(req,res)=>{
 try {
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/config' && req.method==='GET') return json(res,200,{editorEnabled:process.env.PUBLIC_DEMO!=='1'});
 if(process.env.PUBLIC_DEMO==='1' && (url.pathname==='/api/review' || url.pathname.startsWith('/api/review/'))) return json(res,403,{error:'Editorial access disabled in public demo'});
 if(url.pathname==='/api/articles' && req.method==='GET') return json(res,200,articles.filter(a=>a.status==='published'));
 if(url.pathname==='/api/review' && req.method==='GET') return json(res,200,articles.filter(a=>a.status==='pending'));
 if(url.pathname.startsWith('/api/review/') && req.method==='POST') {
  const origin=req.headers.origin;
  if(origin && origin!==`http://${req.headers.host}`) return json(res,403,{error:'Invalid origin'});
  const article=articles.find(a=>a.id===url.pathname.split('/')[3]);
  const action=url.searchParams.get('action');
  if(!article || !['publish','reject'].includes(action)) return json(res,400,{error:'Invalid request'});
  const updated=articles.map(a=>a.id===article.id?{...a,status:action==='publish'?'published':'rejected'}:a);
  await writeFile(file+'.tmp',JSON.stringify(updated,null,2));await rename(file+'.tmp',file);articles=updated;
  return json(res,200,{ok:true});
 }
 const imageNames=['space.jpg','landscape.jpg','travel.jpg','culture.jpg','nature.jpg','technology.jpg'];
 if(req.method==='GET' && imageNames.some(n=>url.pathname==='/images/'+n)) {
  res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=86400'});
  return res.end(await readFile(root+'public'+url.pathname));
 }
 const paths={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
 const path=paths[url.pathname];if(!path) return json(res,404,{error:'Not found'});
 res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html; charset=utf-8'});res.end(await readFile(root+'public/'+path));
 }catch(e){console.error(e);json(res,500,{error:'Server error'});}
}).listen(Number(process.env.PORT||3000), '127.0.0.1',()=>console.log('Portal ready on port '+(process.env.PORT||3000)));
