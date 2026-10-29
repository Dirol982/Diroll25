import {test} from 'node:test';
import assert from 'node:assert/strict';
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
