"""Build a standalone fictional demo, including illustrative photographs."""
from pathlib import Path
import json,base64
root=Path(__file__).resolve().parents[1]
css=(root/'public/style.css').read_text()
js=(root/'public/app.js').read_text()
# Include all explicitly fictional samples in the visual preview, without publishing server drafts.
articles=[dict(a,status='published') for a in json.loads((root/'data/articles.json').read_text()) if a.get('demo')]
images={p.name:'data:image/jpeg;base64,'+base64.b64encode(p.read_bytes()).decode() for p in (root/'public/images').glob('*.jpg') if p.name!='landscape.jpg'}
prefix='const previewImages='+json.dumps(images)+';\nconst demoArticles='+json.dumps(articles,ensure_ascii=False).replace('<','\\u003c')+''';
async function demoFetch(path){return {ok:true,status:200,json:async()=>path==='/api/config'?{editorEnabled:false}:path==='/api/articles'?demoArticles:[]};}
'''
js=js.replace('fetch(', 'demoFetch(')
js=js.replace('src="/images/${photos[a.category]||\'landscape.jpg\'}"','src="${previewImages[photos[a.category]||\'landscape.jpg\']}"')
html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ATLAS — демоверсия</title><style>'+css+'</style></head><body><div id="app"></div><script>'+prefix+js+'</script></body></html>'
(root/'atlas-demo.html').write_text(html)
print('Generated atlas-demo.html with',len(articles),'fictional articles and',len(images),'embedded photographs')
