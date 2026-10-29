import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';
import {Subscriptions} from '../subscriptions.js';import {telegramURL,sendTelegramArticle} from '../telegram.js';
test('email requires consent and confirmation, expires links, supports unsubscribe and deduplicates digest',{timeout:10000},async()=>{
 const dir=await mkdtemp(tmpdir()+'/atlas-mail-');const messages=[];let now=Date.now();
 const store=new Subscriptions(dir,{send:async m=>messages.push(m),baseUrl:'https://newsletter.example',now:()=>now});
 try{
 const fields={email:'reader@example.com',language:'ru',topics:['technology'],consent:true};
 await assert.rejects(store.subscribe({...fields,consent:false}),{status:400});
 await store.subscribe(fields);await store.subscribe(fields);assert.equal(messages.length,1);
 const article={id:'a',demo:false,status:'published',category:'technology',title:{ru:'Новость',en:'News'},body:{ru:'Текст',en:'Body'}};
 assert.equal((await store.digest([article],'https://site.example')).sent,0);
 const confirm=messages[0].text.match(/https:\/\/newsletter.example\/api\/newsletter\/confirm\?token=([a-f0-9]+)/)[1];
 const stop=messages[0].text.match(/unsubscribe\?token=([a-f0-9]+)/)[1];
 const raw=await readFile(dir+'/subscribers.json','utf8');assert(!raw.includes(confirm));
 assert(await store.confirm(confirm));assert.equal(await store.confirm(confirm),false);
 assert.equal((await store.digest([article],'https://site.example')).sent,1);assert.equal(messages.length,2);
 assert.equal((await store.digest([article],'https://site.example')).sent,0);
 now+=86400001;assert.equal((await store.digest([article],'https://site.example')).sent,0);
 assert(await store.unsubscribe(stop));assert.equal(JSON.parse(await readFile(dir+'/subscribers.json','utf8')).length,0);
 await store.subscribe(fields);now+=86400001;const expired=messages.at(-1).text.match(/confirm\?token=([a-f0-9]+)/)[1];assert.equal(await store.confirm(expired),false);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('missing email transport fails honestly and does not store addresses',async()=>{
 const dir=await mkdtemp(tmpdir()+'/atlas-no-mail-');try{await assert.rejects(new Subscriptions(dir).subscribe({email:'reader@example.com'}),{status:503});await assert.rejects(readFile(dir+'/subscribers.json'),{code:'ENOENT'})}finally{await rm(dir,{recursive:true,force:true})}
});
test('Telegram uses only a configured channel and requires an acknowledged send',async()=>{
 assert.equal(telegramURL('https://evil.example/channel'),null);assert.equal(telegramURL('https://t.me/share/url'),null);
 const article={id:'one',title:{ru:'Новость'},body:{ru:'Текст'},source:{url:'https://github.com/nodejs/node/releases'}};
 let payload;
 const result=await sendTelegramArticle(article,{token:'unit-test-placeholder',channel:'https://t.me/atlas_test_channel',siteUrl:'https://site.example/',fetcher:async(u,options)=>{payload=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true,result:{message_id:7}})}}});
 assert.equal(result,7);assert.equal(payload.chat_id,'@atlas_test_channel');assert(payload.text.includes('#article/one'));
 await assert.rejects(sendTelegramArticle(article,{token:'unit-test-placeholder',channel:'https://t.me/atlas_test_channel',siteUrl:'https://site.example/',fetcher:async()=>({ok:false,json:async()=>({ok:false})})}));
});
