import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {checkArticle,mergeDrafts} from './editorial.js';
const root=fileURLToPath(new URL('.',import.meta.url));
const dir=process.env.ATLAS_DATA_DIR||root+'data';await mkdir(dir,{recursive:true});
const file=dir+'/articles.json';let articles;
try{articles=JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;articles=JSON.parse(await readFile(root+'config/samples.json','utf8'))}
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
let chain=Promise.resolve();const mutate=fn=>{const operation=chain.then(async()=>{const next=fn(articles);await writeFile(file+'.tmp',JSON.stringify(next,null,2));await rename(file+'.tmp',file);articles=next});chain=operation.catch(()=>{});return operation};
let collecting=false;
async function collectUpdates(){
 if(collecting)return null;collecting=true;
 try{
  const {stdout}=await promisify(execFile)('python3',[root+'tools/collect.py'],{timeout:55000,maxBuffer:2_000_000});
  const result=JSON.parse(stdout);let added=0;
  await mutate(old=>{const next=mergeDrafts(old,result.articles);added=next.length-old.length;return next});
  return {added,reports:result.reports};
 }finally{collecting=false}
}
const intervalMinutes=Number(process.env.ATLAS_COLLECT_INTERVAL_MINUTES||0);
if(process.env.PUBLIC_DEMO!=='1'&&Number.isFinite(intervalMinutes)&&intervalMinutes>=5){
 const collect=()=>collectUpdates().then(result=>{if(result)console.log('Collection:',JSON.stringify(result))}).catch(e=>console.error('Collection failed:',e.message));
 setTimeout(collect,1000).unref();setInterval(collect,intervalMinutes*60000).unref();
}
http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');const isEditor=url.pathname==='/api/collect'||url.pathname==='/api/review'||url.pathname.startsWith('/api/review/');
 if(process.env.PUBLIC_DEMO==='1'&&isEditor)return json(res,403,{error:'Editorial access disabled in public demo'});
 if(isEditor&&req.method!=='GET'){
  if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`))return json(res,403,{error:'Invalid origin'});
 }
 if(url.pathname==='/api/config'&&req.method==='GET')return json(res,200,{editorEnabled:process.env.PUBLIC_DEMO!=='1',staticPreview:false});
 if(url.pathname==='/api/articles'&&req.method==='GET')return json(res,200,articles.filter(a=>a.status==='published'));
 if(url.pathname==='/api/review'&&req.method==='GET')return json(res,200,articles.filter(a=>a.status==='pending').map(a=>({...a,checks:checkArticle(a)})));
 if(url.pathname==='/api/collect'&&req.method==='POST'){
  const result=await collectUpdates();return result?json(res,200,result):json(res,409,{error:'Collection already running'});
 }
 if(url.pathname.startsWith('/api/review/')&&req.method==='POST'){
  const id=url.pathname.split('/')[3],action=url.searchParams.get('action');
  if(!['publish','reject','edit'].includes(action))return json(res,400,{error:'Invalid action'});
  let body={};
  if(action==='edit'){
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16000)return json(res,413,{error:'Too large'})}
   try{body=JSON.parse(raw)}catch{return json(res,400,{error:'Invalid JSON'})}
   if(!['titleRu','titleEn','bodyRu','bodyEn','importanceRu','importanceEn','nextRu','nextEn'].every(k=>typeof body[k]==='string'&&body[k].trim()&&body[k].length<4000))return json(res,400,{error:'Fill all editorial fields'});
  }
  let failure;
  await mutate(old=>old.map(a=>{
   if(a.id!==id)return a;
   if(a.status!=='pending'){failure={status:409,error:'Article is no longer pending'};return a}
   if(action==='edit')return {...a,title:{ru:body.titleRu.trim(),en:body.titleEn.trim()},body:{ru:body.bodyRu.trim(),en:body.bodyEn.trim()},importance:{ru:body.importanceRu.trim(),en:body.importanceEn.trim()},next:{ru:body.nextRu.trim(),en:body.nextEn.trim()},factsReviewed:body.factsReviewed===true,translationStatus:body.translationReviewed===true?'reviewed':'original'};
   const checks=checkArticle(a);
   if(action==='publish'&&!checks.canPublish){failure={status:422,error:'Editorial checks require attention',checks};return a}
   return {...a,status:action==='publish'?'published':'rejected',...(action==='publish'?{approvedAt:new Date().toISOString()}:{} )};
  }));
  if(!articles.some(a=>a.id===id))return json(res,404,{error:'Not found'});
  if(failure)return json(res,failure.status,failure);
  return json(res,200,{ok:true});
 }
 const images=['space.jpg','landscape.jpg','travel.jpg','culture.jpg','nature.jpg','technology.jpg'];
 if(req.method==='GET'&&images.some(n=>url.pathname==='/images/'+n)){res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=86400'});return res.end(await readFile(root+'public'+url.pathname))}
 const paths={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};const path=paths[url.pathname];if(!path||req.method!=='GET')return json(res,404,{error:'Not found'});
 res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html; charset=utf-8'});res.end(await readFile(root+'public/'+path));
 }catch(e){console.error(e);json(res,500,{error:'Server error'})}
}).listen(Number(process.env.PORT||3000),'127.0.0.1',function(){console.log('Portal ready on port '+this.address().port)});
