import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedLicense, findImage, backfillImages} from '../src/images.js';

const json = body => ({ok: true, json: async () => body});
const commons = pages => json({query: {pages}});
const page = (title, license, width = 1600, height = 1000, index = 1) => ({index, title: 'File:' + title, imageinfo: [{url: 'https://upload.wikimedia.org/' + title, thumburl: 'https://upload.wikimedia.org/thumb/' + title, descriptionurl: 'https://commons.wikimedia.org/wiki/File:' + title, width, height, extmetadata: {LicenseShortName: {value: license}, LicenseUrl: {value: 'https://creativecommons.org/licenses/by-sa/4.0'}, Artist: {value: '<a href="x">NASA</a>'}}}]});

test('only licences that allow commercial reuse are accepted', () => {
  for (const ok of ['CC BY-SA 4.0', 'CC BY 2.0', 'CC0', 'Public domain', 'PDM 1.0', 'BY-SA 3.0']) assert.ok(allowedLicense(ok), ok);
  for (const bad of ['CC BY-NC 2.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 3.0', 'Fair use', '', 'All rights reserved']) assert.ok(!allowedLicense(bad), bad);
});

test('Commons first, skipping non-free, small and portrait files; Openverse as fallback', async () => {
  const calls = [];
  const fetcher = async url => {
    calls.push(String(url));
    if (String(url).includes('commons')) return commons({a: page('Duma_NC.jpg', 'CC BY-NC 2.0', 1600, 1000, 1), b: page('Duma_portrait.jpg', 'CC BY-SA 4.0', 900, 1400, 2), c: page('State_Duma.jpg', 'CC BY-SA 4.0', 2000, 1200, 3)});
    return json({results: []});
  };
  const image = await findImage('State Duma building', {fetcher});
  assert.equal(image.url, 'https://upload.wikimedia.org/thumb/State_Duma.jpg');
  assert.equal(image.creator, 'NASA');
  assert.equal(image.license, 'CC BY-SA 4.0');
  assert.equal(calls.length, 1);

  const fallback = await findImage('spacewalk', {fetcher: async url => String(url).includes('commons') ? commons({}) : json({results: [
    {url: 'https://live.staticflickr.com/nc.jpg', license: 'by-nc', license_version: '2.0', width: 2000, height: 1200},
    {url: 'https://live.staticflickr.com/ok.jpg', title: 'EVA', creator: 'NASA Johnson', license: 'by', license_version: '2.0', license_url: 'https://creativecommons.org/licenses/by/2.0/', foreign_landing_url: 'https://flickr.com/p/1', source: 'flickr', width: 2048, height: 1365},
  ]})});
  assert.equal(fallback.url, 'https://live.staticflickr.com/ok.jpg');
  assert.equal(fallback.license, 'CC BY 2.0');
  assert.equal(fallback.provider, 'Flickr');
  assert.equal(await findImage('x', {fetcher: async () => { throw Error('offline'); }}), null);
});

test('backfill gives older agent stories a photo once', async () => {
  const saved = [];
  const articles = [{id: 'a', publicationMode: 'agents', title: {en: 'ISS spacewalk'}}, {id: 'b', publicationMode: 'agents', title: {en: 'x'}, image: {url: 'https://x'}}, {id: 'c', title: {en: 'release'}}];
  const n = await backfillImages(articles, async a => saved.push(a), {fetcher: async url => String(url).includes('commons') ? commons({c: page('ISS.jpg', 'Public domain')}) : json({results: []})});
  assert.equal(n, 1);
  assert.equal(saved.length, 1);
  assert.ok(saved[0].image && saved[0].imageSearchedAt);
});
