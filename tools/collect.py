"""Read configured first-party Atom feeds; output drafts, never publish them."""
import json,sys,hashlib,re
from datetime import datetime,timezone
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET
from html.parser import HTMLParser
class Plain(HTMLParser):
 def __init__(self):super().__init__();self.parts=[]
 def handle_data(self,data):self.parts.append(data)
def plain(value):
 p=Plain();p.feed(value);return re.sub(r'\s+',' ',' '.join(p.parts)).strip()
def collect(sources):
 articles=[];reports=[];ns={'a':'http://www.w3.org/2005/Atom'}
 for source in sources:
  try:
   request=Request(source['url'],headers={'User-Agent':'ATLAS-development-reader/0.2','Accept':'application/atom+xml'})
   with urlopen(request,timeout=20) as response:
    if urlsplit(response.url).hostname!='github.com':raise ValueError('Unexpected feed redirect')
    raw=response.read(2_000_001)
   if len(raw)>2_000_000:raise ValueError('Feed exceeds size limit')
   if b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():raise ValueError('Unsupported XML declarations')
   root=ET.fromstring(raw)
   for entry in root.findall('a:entry',ns)[:8]:
    link=next((a.get('href','') for a in entry.findall('a:link',ns) if a.get('rel','alternate')=='alternate'),'')
    if urlsplit(link).scheme!='https' or urlsplit(link).hostname!='github.com':continue
    title=plain(entry.findtext('a:title','',ns))[:300]
    if not title:continue
    date=entry.findtext('a:published','',ns) or entry.findtext('a:updated','',ns)
    # Keep original wording; do not claim translation or invent significance.
    body='Official release announcement. Open the source to read the release notes.'
    articles.append({'id':'feed-'+hashlib.sha256(link.encode()).hexdigest()[:20],'category':source['category'],'country':source['country'],'title':{'ru':title,'en':title},'body':{'ru':'Официальное объявление о выпуске. Заголовок сохранён на языке оригинала; подробности доступны в первоисточнике.','en':body},'status':'pending','demo':False,'source':{'name':source['name'],'url':link,'language':source['language']},'originalTitle':title,'publishedAt':date,'updatedAt':date,'collectedAt':datetime.now(timezone.utc).isoformat(),'translationStatus':'original','factsReviewed':False,'importance':{'ru':'Редактор ещё не добавил объяснение значимости.','en':'An editor has not added the significance yet.'},'next':{'ru':'Проверьте примечания к выпуску и применимость изменений.','en':'Review the release notes and relevance of the changes.'}})
   reports.append({'source':source['name'],'ok':True,'items':len(root.findall('a:entry',ns)[:8])})
  except Exception as exc:reports.append({'source':source['name'],'ok':False,'error':str(exc)[:300]})
 return {'articles':articles,'reports':reports}
if __name__=='__main__':
 root=Path(__file__).resolve().parents[1]
 print(json.dumps(collect(json.loads((root/'config/sources.json').read_text())),ensure_ascii=False))
