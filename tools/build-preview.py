"""Build a standalone fictional demo, including illustrative photographs."""
from pathlib import Path
import json,base64
root=Path(__file__).resolve().parents[1]
css=(root/'public/style.css').read_text()
js=(root/'public/app.js').read_text()
# Include all explicitly fictional samples in the visual preview, without publishing server drafts.
articles=[dict(a,status='published') for a in json.loads((root/'config/samples.json').read_text()) if a.get('demo')]
publication=json.loads((root/'config/published.json').read_text()) if (root/'config/published.json').exists() else {'articles':[]}
articles=publication['articles']+articles
connections=json.loads((root/'config/connections.json').read_text())
images={p.name:'data:image/jpeg;base64,'+base64.b64encode(p.read_bytes()).decode() for p in (root/'public/images').glob('*.jpg') if p.name!='landscape.jpg'}
pending=[a for a in json.loads((root/'config/samples.json').read_text()) if a['status']=='pending']
prefix='const publicConnections='+json.dumps(connections)+';\nconst demoPending='+json.dumps(pending,ensure_ascii=False).replace('<','\\u003c')+';\nconst previewImages='+json.dumps(images)+';\nconst demoArticles='+json.dumps(articles,ensure_ascii=False).replace('<','\\u003c')+''';
async function demoFetch(path,options={}){if(path===publicConnections.newsletterEndpoint&&publicConnections.newsletterEndpoint)return window.fetch(path,options);const ok=!options.method||options.method==='GET';return {ok,status:ok?200:403,json:async()=>path==='/api/config'?{editorEnabled:false,staticPreview:true,connections:publicConnections,newsletterReady:!!publicConnections.newsletterEndpoint}:path==='/api/articles'?demoArticles:path==='/api/review'?demoPending:[]};}
'''
js=js.replace('fetch(', 'demoFetch(')
js=js.replace('src="/images/${photos[a.category]||\'landscape.jpg\'}"','src="${previewImages[photos[a.category]||\'landscape.jpg\']}"')
html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ATLAS — демоверсия</title><style>'+css+'</style></head><body><div id="app"></div><script>'+prefix+js+'</script></body></html>'
(root/'atlas-demo.html').write_text(html)
(root/'docs').mkdir(exist_ok=True)
(root/'docs/index.html').write_text(html)
# Cabinet preview: real cabinet UI on top of an in-memory demo API (nothing is sent anywhere).
topics=json.loads((root/'config/topics.json').read_text())['topics']
def channel(lang,topic):
 value=(connections.get('telegram',{}).get(lang) or {}).get(topic)
 return value if isinstance(value,str) and value.startswith('https://t.me/') else None
demo_topics=[{'id':t['id'],'name':t['name'],'telegram':{l:channel(l,t['id']) for l in ('ru','en')},'suggested':{l:'@'+t['telegram'][l]['username'] for l in ('ru','en')}} for t in topics]
packages=json.loads((root/'config/ad-packages.json').read_text())
cabinet_data='window.atlasDemoTopics='+json.dumps(demo_topics,ensure_ascii=False)+';window.atlasDemoPackages='+json.dumps(packages,ensure_ascii=False)+';window.atlasDemoArticles='+json.dumps([{'id':a['id'],'title':a['title']} for a in publication['articles'][:5]],ensure_ascii=False).replace('<','\\u003c')+';'
cabinet='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ATLAS — личный кабинет (демо)</title><style>'+(root/'public/cabinet.css').read_text()+'</style></head><body><div id="cabinet"></div><div class="toast" id="toast" role="status"></div><script>'+cabinet_data+(root/'public/cabinet-demo.js').read_text()+'</script><script type="module">'+(root/'public/cabinet.js').read_text()+'</script></body></html>'
(root/'docs/cabinet.html').write_text(cabinet)
print('Generated atlas-demo.html with',len(articles),'public articles (real and labelled samples) and',len(images),'embedded photographs')
