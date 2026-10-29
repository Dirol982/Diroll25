import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
export const validEmail=s=>typeof s==='string'&&s.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
const allowedTopics=['technology','science','economy','culture','sport','travel'];
export class Subscriptions{
 constructor(dir,{send,baseUrl,now=()=>Date.now()}={}){this.file=dir+'/subscribers.json';this.dir=dir;this.send=send;this.baseUrl=baseUrl;this.now=now;this.chain=Promise.resolve()}
 async transaction(fn){const op=this.chain.then(async()=>{let list=[];try{list=JSON.parse(await readFile(this.file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}const result=await fn(list);await mkdir(this.dir,{recursive:true});await writeFile(this.file+'.tmp',JSON.stringify(list,null,2),{mode:0o600});await rename(this.file+'.tmp',this.file);return result});this.chain=op.catch(()=>{});return op}
 async subscribe({email,consent,language,topics}){
  if(!this.send||!this.baseUrl)throw Object.assign(Error('Email subscriptions are not configured'),{status:503});
  if(!validEmail(email)||consent!==true||!['ru','en'].includes(language)||!Array.isArray(topics)||topics.some(t=>!allowedTopics.includes(t)))throw Object.assign(Error('Check email, language, topics and consent'),{status:400});
  email=email.trim().toLowerCase();
  return this.transaction(async list=>{
   let item=list.find(s=>s.email===email);
   if(item?.status==='confirmed'||(item&&this.now()-item.sentAt<3600000))return {ok:true};
   const token=randomBytes(32).toString('hex'),unsubscribe=randomBytes(32).toString('hex');
   const confirm=new URL('/api/newsletter/confirm',this.baseUrl);confirm.searchParams.set('token',token);
   const stop=new URL('/api/newsletter/unsubscribe',this.baseUrl);stop.searchParams.set('token',unsubscribe);
   await this.send({email,subject:language==='ru'?'Подтвердите подписку ATLAS':'Confirm your ATLAS subscription',text:language==='ru'?`Подтвердите подписку на новости ATLAS: ${confirm.href}\nБез подтверждения рассылка не начнётся. Если вы не запрашивали подписку, проигнорируйте письмо. Ссылка действует 24 часа.\nОтказаться: ${stop.href}`:`Confirm your ATLAS news subscription: ${confirm.href}\nNo newsletter is sent without confirmation. Ignore this email if you did not request it. The link expires in 24 hours.\nUnsubscribe: ${stop.href}`});
   const updated={email,language,topics:[...new Set(topics)],status:'pending',confirmationHash:hash(token),unsubscribeHash:hash(unsubscribe),unsubscribeToken:unsubscribe,sentAt:this.now(),consentAt:new Date(this.now()).toISOString()};
   if(item)Object.assign(item,updated);else list.push(updated);return {ok:true};
  });
 }
 async digest(articles,siteUrl){
  if(!this.send||!this.baseUrl)return {sent:0,failed:0};
  return this.transaction(async list=>{
   let sent=0,failed=0;
   for(const s of list.filter(s=>s.status==='confirmed')){
    if(this.now()-(s.lastDigestAt||0)<86400000)continue;
    const selected=articles.filter(a=>!a.demo&&!a.archive&&a.status==='published'&&(!s.topics.length||s.topics.includes(a.category))&&!(s.deliveredIds||[]).includes(a.id)).slice(0,5);
    if(!selected.length)continue;
    const stop=new URL('/api/newsletter/unsubscribe',this.baseUrl);stop.searchParams.set('token',s.unsubscribeToken);
    const text=selected.map(a=>{const url=new URL(siteUrl);url.hash='article/'+a.id;return a.title[s.language]+'\n'+a.body[s.language]+'\n'+url.href}).join('\n\n')+'\n\n'+(s.language==='ru'?'Отписаться: ':'Unsubscribe: ')+stop.href;
    try{await this.send({email:s.email,subject:s.language==='ru'?'ATLAS — ваша подборка новостей':'ATLAS — your news digest',text});s.lastDigestAt=this.now();s.deliveredIds=[...new Set([...(s.deliveredIds||[]),...selected.map(a=>a.id)])].slice(-500);sent++}catch{failed++}
   }
   return {sent,failed};
  });
 }
 async confirm(token){if(!/^[a-f0-9]{64}$/.test(token||''))return false;return this.transaction(list=>{const s=list.find(x=>x.confirmationHash===hash(token)&&x.status==='pending');if(!s||this.now()-s.sentAt>86400000)return false;s.status='confirmed';s.confirmedAt=new Date(this.now()).toISOString();delete s.confirmationHash;return true})}
 async unsubscribe(token){if(!/^[a-f0-9]{64}$/.test(token||''))return false;return this.transaction(list=>{const i=list.findIndex(x=>x.unsubscribeHash===hash(token));if(i<0)return false;list.splice(i,1);return true})}
}
export function brevoSender({apiKey,fromEmail}){return async({email,subject,text})=>{
 const response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':apiKey,'Content-Type':'application/json'},body:JSON.stringify({sender:{email:fromEmail,name:'ATLAS'},to:[{email}],subject,textContent:text}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Object.assign(Error('Email provider could not send the confirmation'),{status:502});
};}
