// Posts newly published stories to the section (and main) Telegram channels.
// Journal keys are article:language:channel, so each post is attempted at most once.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {channelsForArticle,sendTelegram,formatArticlePost,TelegramRejected} from '../telegram.js';
const root=new URL('../',import.meta.url);
const connections=JSON.parse(await readFile(new URL('config/connections.json',root),'utf8'));
const {topics}=JSON.parse(await readFile(new URL('config/topics.json',root),'utf8'));
const token=process.env.TELEGRAM_BOT_TOKEN;
if(!token){console.log('Telegram delivery not configured; no messages sent');process.exit(0)}
const published=JSON.parse(await readFile(new URL('config/published.json',root),'utf8'));
const path=new URL('config/telegram-deliveries.json',root);let log={};try{log=JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
async function persist(){await writeFile(new URL('config/telegram-deliveries.tmp',root),JSON.stringify(log,null,2)+'\n');await rename(new URL('config/telegram-deliveries.tmp',root),path)}
// Only fresh site publications: connecting a channel later must not flood it with the archive.
const fresh=a=>Date.now()-Date.parse(a.sitePublishedAt||a.collectedAt||0)<24*3600000;
const eligible=a=>!a.demo&&!a.archive&&a.status==='published'&&(a.publicationMode==='agents'||a.autoChecks?.length===2)&&fresh(a);
let sent=0;
for(const article of published.articles.filter(eligible).reverse()){
 for(const language of ['ru','en']){
  for(const channel of channelsForArticle(connections,language,article)){
   const key=article.id+':'+language+':'+channel;if(log[key])continue;
   log[key]={status:'sending',attemptedAt:new Date().toISOString()};await persist();
   const hashtag=topics.find(t=>t.id===article.category)?.hashtag?.[language]||'';
   try{const messageId=await sendTelegram({token,channel,text:formatArticlePost(article,{siteUrl:connections.siteUrl,language,hashtag})});log[key]={status:'sent',messageId,sentAt:new Date().toISOString()};sent++}
   catch(e){log[key]={status:e instanceof TelegramRejected?'rejected':'uncertain',error:String(e.message).slice(0,200)};console.error(e instanceof TelegramRejected?'Telegram rejected a post: '+e.message:'Delivery uncertain; inspect the channel before any manual retry')}
   await persist();await new Promise(r=>setTimeout(r,1100));
  }
 }
}
console.log('Telegram messages sent:',sent);
