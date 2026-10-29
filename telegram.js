// Telegram delivery. Sending is opt-in and needs owner-created channels plus an admin bot token.
export function telegramURL(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='t.me'&&/^\/[A-Za-z][A-Za-z0-9_]{4,31}$/.test(u.pathname)&&!u.search&&!u.hash&&!u.username&&!u.password?u.href:null}catch{return null}}
export function channelFor(connections,language,category){const value=connections.telegram?.[language]?.[category]||connections.telegram?.[language]?.all;return telegramURL(value)}
// Every channel an article goes to: its section channel, plus the main channel for top stories.
export function channelsForArticle(connections,language,article,mainThreshold=4){
 const list=[];const section=telegramURL(connections.telegram?.[language]?.[article.category]);if(section)list.push(section);
 const main=telegramURL(connections.telegram?.[language]?.main||connections.telegram?.[language]?.all);
 if(main&&!list.includes(main)&&(!section||(article.priority||0)>=mainThreshold))list.push(main);
 return list;
}
const html=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export function articleLink(siteUrl,article,language){const url=new URL(siteUrl);if(url.pathname.endsWith('/a/'))url.pathname+=article.id;else url.hash='article/'+article.id;if(language)url.searchParams.set('lang',language);return url.href}
export function formatArticlePost(article,{siteUrl,language='ru',hashtag='',linkBase}){
 const ru=language==='ru';
 const sources=(article.sources?.length?article.sources:[{publisher:article.source.name,url:article.source.url}]).filter(s=>/^https:\/\//.test(s.url)).slice(0,3);
 const parts=[`<b>${html(article.title[language])}</b>`,html(article.telegramText?.[language]||article.body[language])];
 if(sources.length)parts.push(`${ru?'Источники':'Sources'}: ${sources.map(s=>`<a href="${html(s.url)}">${html(s.publisher||s.name||new URL(s.url).hostname)}</a>`).join(', ')}`);
 parts.push(`<a href="${html(articleLink(linkBase||siteUrl,article,language))}">${ru?'Читать на сайте':'Read on the site'} →</a>${hashtag?'\n\n'+html(hashtag):''}`);
 return parts.join('\n\n').slice(0,4096);
}
// Russian law requires a visible "Реклама" label, the advertiser and an erid token for ads aimed at Russian users.
export function formatAdPost(campaign,language='ru'){
 const ru=language==='ru';
 const label=[ru?'Реклама':'Ad',campaign.advertiserName,campaign.erid?'erid: '+campaign.erid:''].filter(Boolean).join(' · ');
 return [`<b>${html(campaign.title)}</b>`,html(campaign.text),`<a href="${html(campaign.clickUrl)}">${ru?'Подробнее':'Learn more'} →</a>`,`<i>${html(label)}</i>`].join('\n\n').slice(0,4096);
}
export class TelegramRejected extends Error {}
// Resolves to message_id. TelegramRejected means Telegram definitely did not post; any other error is uncertain.
export async function sendTelegram({token,channel,text,fetcher=fetch,preview=true}){
 const target=telegramURL(channel);if(!token||!target)throw new TelegramRejected('Telegram bot and channel are not configured');
 const response=await fetcher(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:'@'+new URL(target).pathname.slice(1),text,parse_mode:'HTML',link_preview_options:{is_disabled:!preview}}),signal:AbortSignal.timeout(15000)});
 let body;try{body=await response.json()}catch{}
 if(body?.ok)return body.result.message_id;
 if(body&&body.ok===false&&[400,403].includes(body.error_code))throw new TelegramRejected(body.description||'Telegram rejected the message');
 throw Error('Telegram delivery outcome unknown');
}
export async function sendTelegramArticle(article,{token,channel,siteUrl,language='ru',hashtag='',fetcher=fetch}){
 return sendTelegram({token,channel,text:formatArticlePost(article,{siteUrl,language,hashtag}),fetcher});
}
