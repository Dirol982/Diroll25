export function checkArticle(a,now=Date.now()) {
 const issues=[];
 if(a.demo) return {issues:['demo'],canPublish:true,factCheck:'not-performed'};
 let source;
 try{source=new URL(a.source?.url)}catch{}
 if(!source || source.protocol!=='https:' || source.username || source.password)issues.push('source');
 if(!a.title?.en?.trim() || !a.title?.ru?.trim())issues.push('title');
 const time=Date.parse(a.publishedAt);
 if(!Number.isFinite(time))issues.push('date');
 else if(time>now+15*60*1000)issues.push('future');
 else if(now-time>72*60*60*1000)issues.push('stale');
 if(a.translationStatus!=='reviewed')issues.push('translation');
 if(!a.factsReviewed)issues.push('facts');
 return {issues,canPublish:issues.length===0,factCheck:a.factsReviewed?'human-reviewed':'not-performed'};
}
export function mergeDrafts(existing,incoming){
 const ids=new Set(existing.map(a=>a.id));const urls=new Set(existing.map(a=>a.source?.url).filter(Boolean));
 return [...existing,...incoming.filter(a=>{if(ids.has(a.id)||urls.has(a.source?.url))return false;ids.add(a.id);if(a.source?.url)urls.add(a.source.url);return true}).map(a=>({...a,status:'pending',factsReviewed:false}))];
}
