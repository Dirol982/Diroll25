import unittest,sys
from pathlib import Path
from datetime import datetime,timezone,timedelta
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from publish import stage_one,stage_two,verify
class PublicationTests(unittest.TestCase):
 def setUp(self):
  self.now=datetime(2026,10,29,tzinfo=timezone.utc)
  self.registry=[{'id':'nodejs','name':'Node.js','url':'https://github.com/nodejs/node/releases.atom','category':'technology'}]
  self.a={'id':'test','category':'technology','source':{'name':'Node.js','url':'https://github.com/nodejs/node/releases/tag/v1.2.3'},'originalTitle':'Release 1.2.3','publishedAt':'2026-10-28T10:00:00Z','title':{'ru':'test','en':'test'},'demo':False}
  self.html='<h1>Release 1.2.3</h1><relative-time datetime="2026-10-28T10:00:00Z"></relative-time>'
 def test_both_independent_checks_required(self):
  out,error=verify(self.a,self.registry,self.now,False,lambda _:self.html)
  self.assertIsNone(error);self.assertEqual(out['status'],'published');self.assertEqual(len(out['autoChecks']),2);self.assertFalse(out['factsReviewed']);self.assertEqual(out['verificationScope'],'release-announcement-only')
  for html in ['<h1>Different release</h1>','<h1>Release 1.2.3</h1><relative-time datetime="2026-10-20T10:00:00Z"></relative-time>']:
   out,error=verify(self.a,self.registry,self.now,False,lambda _:html);self.assertIsNone(out);self.assertIsNotNone(error)
 def test_archive_is_explicit_and_future_date_is_blocked(self):
  old={**self.a,'publishedAt':'2026-09-01T10:00:00Z'}
  with self.assertRaises(ValueError):stage_one(old,self.registry,self.now,False)
  self.assertTrue(stage_one(old,self.registry,self.now,True)[2])
  with self.assertRaises(ValueError):stage_one({**self.a,'publishedAt':'2026-11-01T10:00:00Z'},self.registry,self.now,True)
 def test_untrusted_source_and_wrong_version_are_blocked(self):
  for url in ['https://evil.example/nodejs/node/releases/tag/v1.2.3','https://github.com/other/repo/releases/tag/v1.2.3','https://user@github.com/nodejs/node/releases/tag/v1.2.3','https://github.com/nodejs/node/releases/tag/v9.9.9']:
   with self.assertRaises(ValueError):stage_one({**self.a,'source':{'name':'Node.js','url':url}},self.registry,self.now,True)
if __name__=='__main__':unittest.main()
