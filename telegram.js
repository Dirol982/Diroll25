// Actual delivery is opt-in and requires owner-created channels and a bot token.
export function telegramURL(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='t.me'&&/^\/[A-Za-z][A-Za-z0-9_]{4,31}$/.test(u.pathname)&&!u.search&&!u.hash&&!u.username&&!u.password?u.href:null}catch{return null}}
export function channelFor(connections,language,category){const value=connections.telegram?.[language]?.[category]||connections.telegram?.[language]?.all;return telegramURL(value)}
export async function sendTelegramArticle(article,{token,channel,siteUrl,language='ru',fetcher=fetch}){
 const target=telegramURL(channel);if(!token||!target)throw Error('Telegram bot and channel are not configured');
 const url=new URL(siteUrl);url.hash='article/'+article.id;
 const text=`${article.title[language]}\n\n${article.body[language]}\n\n${language==='ru'?'Источник':'Source'}: ${article.source.url}\n${url.href}`;
 const response=await fetcher(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:'@'+new URL(target).pathname.slice(1),text,link_preview_options:{is_disabled:false}}),signal:AbortSignal.timeout(15000)});
 let body;try{body=await response.json()}catch{}
 if(!response.ok||!body?.ok)throw Error('Telegram rejected delivery');return body.result.message_id;
}
