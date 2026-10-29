import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {checkArticle,mergeDrafts} from '../editorial.js';
const sample=()=>({id:'real-1',category:'technology',country:null,title:{ru:'Заголовок',en:'Headline'},body:{ru:'Описание',en:'Description'},source:{name:'Official',url:'https://github.com/nodejs/node/releases/tag/test'},publishedAt:new Date().toISOString(),demo:false,status:'pending',translationStatus:'original',factsReviewed:false});
test('real drafts cannot publish until facts and both languages are reviewed',()=>{
 const a=sample();assert.deepEqual(checkArticle(a).issues,['translation','facts']);
 assert.equal(checkArticle({...a,factsReviewed:true,translationStatus:'reviewed'}).canPublish,true);
 for(const [key,value,issue] of [['publishedAt','broken','date'],['publishedAt',new Date(Date.now()+3600000).toISOString(),'future'],['publishedAt',new Date(Date.now()-96*3600000).toISOString(),'stale'],['source',{url:'javascript:alert(1)'},'source']])assert(checkArticle({...a,[key]:value}).issues.includes(issue));
});
test('recollection preserves editorial decisions and deduplicates source URLs',()=>{
 const a={...sample(),status:'rejected'};const result=mergeDrafts([a],[sample(),{...sample(),id:'other-id'}]);assert.equal(result.length,1);assert.equal(result[0].status,'rejected');
 assert.equal(mergeDrafts([],[{...sample(),status:'published',factsReviewed:true}])[0].status,'pending');
});
async function start(dir,publicMode=false){
 const child=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',ATLAS_DATA_DIR:dir,PUBLIC_DEMO:publicMode?'1':'0'},stdio:['ignore','pipe','pipe']});
 const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(Error('Startup timed out'))},10000);child.once('error',reject);child.once('exit',code=>reject(Error('Exit '+code)));child.stdout.on('data',chunk=>{const m=chunk.toString().match(/port (\d+)/);if(m){clearTimeout(timer);resolve(m[1])}})});
 return {child,url:'http://127.0.0.1:'+port};
}
test('HTTP workflow blocks unreviewed drafts, persists approval, and locks public mode',{timeout:20000},async()=>{
 const dir=await mkdtemp(tmpdir()+'/atlas-test-');let child;
 try{
 await writeFile(dir+'/articles.json',JSON.stringify([sample()]));let server=await start(dir);child=server.child;
 const request=(path,options)=>fetch(server.url+path,options);
 assert.equal((await (await request('/api/articles')).json()).length,0);
 assert.equal((await request('/api/review/real-1?action=publish',{method:'POST'})).status,422);
 const fields={titleRu:'Проверено',titleEn:'Reviewed',bodyRu:'Описание',bodyEn:'Description',importanceRu:'Значимость',importanceEn:'Importance',nextRu:'Дальше',nextEn:'Next',factsReviewed:true,translationReviewed:true};
 assert.equal((await request('/api/review/real-1?action=edit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields)})).status,200);
 assert.equal((await request('/api/review/real-1?action=publish',{method:'POST',headers:{Origin:'https://evil.example'}})).status,403);
 assert.equal((await request('/api/review/real-1?action=publish',{method:'POST'})).status,200);
 assert.equal((await request('/api/review/real-1?action=reject',{method:'POST'})).status,409);
 const feed=await (await request('/api/articles')).json();assert.equal(feed.length,1);assert.equal(feed[0].title.ru,'Проверено');
 assert.equal(JSON.parse(await readFile(dir+'/articles.json','utf8'))[0].status,'published');
 child.kill();await new Promise(resolve=>child.once('exit',resolve));
 server=await start(dir,true);child=server.child;
 assert.equal((await (await request('/api/articles')).json()).length,1);
 assert.equal((await request('/api/review')).status,403);
 assert.equal((await request('/api/collect',{method:'POST'})).status,403);
 assert.equal((await request('/api/review/real-1?action=edit',{method:'POST'})).status,403);
 }finally{child?.kill();await rm(dir,{recursive:true,force:true})}
});
