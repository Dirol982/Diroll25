import {readFile,writeFile,rename} from 'node:fs/promises';
import {channelFor,sendTelegramArticle} from '../telegram.js';
const root=new URL('../',import.meta.url);
const connections=JSON.parse(await readFile(new URL('config/connections.json',root),'utf8'));
const token=process.env.TELEGRAM_BOT_TOKEN;
if(!token){console.log('Telegram delivery not configured; no messages sent');process.exit(0)}
const published=JSON.parse(await readFile(new URL('config/published.json',root),'utf8'));
const path=new URL('config/telegram-deliveries.json',root);let log={};try{log=JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
async function persist(){await writeFile(new URL('config/telegram-deliveries.tmp',root),JSON.stringify(log,null,2)+'\n');await rename(new URL('config/telegram-deliveries.tmp',root),path)}
let sent=0;
for(const article of published.articles.filter(a=>!a.demo&&!a.archive&&a.autoChecks?.length===2)){
 for(const language of ['ru','en']){
  const channel=channelFor(connections,language,article.category);if(!channel)continue;
  const key=article.id+':'+language+':'+channel;if(log[key])continue;
  log[key]={status:'sending',attemptedAt:new Date().toISOString()};await persist();
  try{const messageId=await sendTelegramArticle(article,{token,channel,siteUrl:connections.siteUrl,language});log[key]={status:'sent',messageId,sentAt:new Date().toISOString()};sent++}catch{log[key]={status:'uncertain'};console.error('Delivery uncertain; inspect the channel before any manual retry')}
  await persist();
 }
}
console.log('Telegram messages sent:',sent);
