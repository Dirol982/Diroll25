"""Two-stage verification of first-party release announcements, not general fact-checking."""
import argparse,json,re,hashlib,os
from pathlib import Path
from datetime import datetime,timezone
from urllib.request import Request,urlopen
from urllib.parse import urlsplit
from html.parser import HTMLParser
from concurrent.futures import ThreadPoolExecutor
from collect import collect
ROOT=Path(__file__).resolve().parents[1]
class Evidence(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.heading=False;self.title=False;self.headings=[];self.dates=[];self.titles=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='h1':self.heading=True;self.headings.append('')
  if tag=='title':self.title=True
  if tag=='relative-time' and a.get('datetime'):self.dates.append(a['datetime'])
 def handle_endtag(self,tag):
  if tag=='h1':self.heading=False
  if tag=='title':self.title=False
 def handle_data(self,value):
  if self.heading:self.headings[-1]+=value
  if self.title:self.titles.append(value)
def normalized(s):return re.sub(r'\s+',' ',s).strip()
def stage_one(a,registry,now,include_archive=False):
 u=urlsplit(a.get('source',{}).get('url',''));date=a.get('publishedAt','');title=a.get('originalTitle','')
 match=next((s for s in registry if a['source']['name']==s['name'] and u.path.startswith(urlsplit(s['url']).path.removesuffix('/releases.atom')+'/releases/tag/')),None)
 if not match or u.scheme!='https' or u.hostname!='github.com' or u.username or u.password or u.port not in (None,443) or u.query or u.fragment:raise ValueError('Source is not a configured first-party release URL')
 if a.get('category')!=match['category']:raise ValueError('Category does not match source')
 version=u.path.rsplit('/',1)[-1]
 if not re.fullmatch(r'v?\d+\.\d+\.\d+(?:[-.][A-Za-z0-9.]+)?',version):raise ValueError('Unsupported release version')
 if version.lstrip('v') not in title:raise ValueError('Feed title does not identify the version')
 published=datetime.fromisoformat(date.replace('Z','+00:00'))
 if published.tzinfo is None:raise ValueError('Date lacks timezone')
 age=(now-published).total_seconds()
 if age < -900:raise ValueError('Future publication date')
 if age>72*3600 and not include_archive:raise ValueError('Old entry not eligible for fresh automatic publication')
 return match,version,age>72*3600
def stage_two(a,html):
 e=Evidence();e.feed(html)
 if normalized(a['originalTitle']) not in [normalized(h) for h in e.headings]:raise ValueError('Release page heading differs from feed title')
 expected=datetime.fromisoformat(a['publishedAt'].replace('Z','+00:00'))
 if not any(matches_date(d,expected) for d in e.dates):raise ValueError('Release page does not corroborate feed date')
 return hashlib.sha256(html.encode()).hexdigest()
def matches_date(value,expected):
 try:return abs((datetime.fromisoformat(value.replace('Z','+00:00'))-expected).total_seconds())<60
 except (ValueError,TypeError):return False
def verify(a,registry,now,include_archive,fetch_page):
 try:
  source,version,archive=stage_one(a,registry,now,include_archive)
  html=fetch_page(a['source']['url']);digest=stage_two(a,html)
  product='Node.js' if source['id']=='nodejs' else 'Visual Studio Code'
  # Fixed bilingual templates make only the claim corroborated by both checks.
  title={'ru':f'{product}: опубликован выпуск {version}','en':f'{product}: release {version} published'}
  body={'ru':f'В официальном репозитории {product} опубликовано объявление о выпуске {version}. Подробности и список изменений доступны по ссылке на первоисточник.','en':f'The official {product} repository published a release announcement for {version}. Details and changes are available at the original source.'}
  stamp=now.isoformat()
  result={**a,'title':title,'body':body,'status':'published','publicationMode':'test','archive':archive,'sitePublishedAt':stamp,'translationStatus':'bilingual-template','factsReviewed':False,'importance':{'ru':'Пользователи продукта могут проверить список изменений и совместимость. Мы не делаем выводов о безопасности или качестве выпуска.','en':'Users can review the changes and compatibility. We make no claims about release security or quality.'},'next':{'ru':'Изучите примечания к выпуску в первоисточнике перед обновлением.','en':'Read the original release notes before upgrading.'},'autoChecks':[{'id':'feed','status':'passed','checkedAt':stamp},{'id':'release-page','status':'passed','checkedAt':stamp,'evidenceSha256':digest}],'verificationScope':'release-announcement-only'}
  return result,None
 except Exception as exc:return None,{'id':a.get('id'),'title':a.get('originalTitle'),'error':str(exc)[:300]}
def fetch_page(url):
 with urlopen(Request(url,headers={'User-Agent':'ATLAS-source-verifier/0.3'}),timeout=20) as r:
  if r.url!=url:raise ValueError('Unexpected release page redirect')
  raw=r.read(3_000_001)
  if len(raw)>3_000_000:raise ValueError('Release page exceeds limit')
 return raw.decode('utf-8')
def run(output,include_archive=False):
 registry=json.loads((ROOT/'config/sources.json').read_text());collected=collect(registry);now=datetime.now(timezone.utc)
 previous=json.loads(output.read_text()) if output.exists() else {'articles':[]}
 items={a['source']['url']:a for a in previous.get('articles',[])};failed=[];passed=[]
 for a in items.values():a['archive']=(now-datetime.fromisoformat(a['publishedAt'].replace('Z','+00:00'))).total_seconds()>72*3600
 with ThreadPoolExecutor(max_workers=3) as executor:
  for article,error in executor.map(lambda a:verify(a,registry,now,include_archive,fetch_page),collected['articles']):
   if article:items[article['source']['url']]=article;passed.append(article['id'])
   else:failed.append(error)
 result={'schemaVersion':1,'builtAt':now.isoformat(),'verification':'Two deterministic checks, not AI or independent journalistic fact-checking','articles':sorted(items.values(),key=lambda a:a['publishedAt'],reverse=True),'reports':collected['reports'],'held':failed}
 if not all(r['ok'] for r in collected['reports']) and not collected['articles']:raise RuntimeError('No source could be read; existing publication remains unchanged')
 output.parent.mkdir(parents=True,exist_ok=True);temp=output.with_suffix('.tmp');temp.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');os.replace(temp,output)
 return {'passed':len(passed),'held':len(failed),'publicTotal':len(items),'reports':collected['reports'],'reasons':failed}
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--include-archive',action='store_true',help='Explicit one-off test of older announcements, visibly labelled archive');parser.add_argument('--output',type=Path,default=ROOT/'config/published.json');args=parser.parse_args()
 print(json.dumps(run(args.output,args.include_archive),ensure_ascii=False))
