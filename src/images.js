// Finds a freely licensed photo for a story: Wikimedia Commons first (named places, people, objects),
// then Openverse (Flickr and other open collections). Only licences that allow commercial reuse
// are accepted, and the credit line required by the licence is stored with the image.
const UA = 'ATLAS-news/1.0 (https://github.com/Dirol982/Diroll25)';
const MIN_WIDTH = 1000;

// CC0, public domain, CC BY, CC BY-SA. NC (non-commercial) and ND (no derivatives, we crop) are rejected.
export function allowedLicense(name) {
  const n = String(name || '').toLowerCase().replace(/[-_]/g, ' ');
  if (/\bnc\b|non commercial|\bnd\b|no deriv|fair use|copyright/.test(n)) return false;
  return /^cc0|public domain|^pd\b|^pdm|^cc by( sa)?\b|^by( sa)?\b/.test(n.trim());
}

const strip = html => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const landscape = (w, h) => w >= MIN_WIDTH && h > 0 && w / h >= 1.2 && w / h <= 2.4;

export async function searchCommons(query, fetcher = fetch) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({action: 'query', format: 'json', origin: '*', generator: 'search', gsrsearch: `${query} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '12', prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1600'}).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetcher(url, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(20000)});
  if (!res.ok) throw Error('Commons HTTP ' + res.status);
  const pages = Object.values((await res.json()).query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  for (const page of pages) {
    const info = page.imageinfo?.[0], meta = info?.extmetadata || {};
    const license = meta.LicenseShortName?.value;
    if (!info || !allowedLicense(license) || !landscape(info.width, info.height) || /\.(svg|gif|tiff?)$/i.test(info.url)) continue;
    return {url: info.thumburl || info.url, title: page.title.replace(/^File:/, '').replace(/\.\w+$/, ''), creator: strip(meta.Artist?.value).slice(0, 120) || 'Wikimedia Commons', license, licenseUrl: meta.LicenseUrl?.value || null, sourceUrl: info.descriptionurl, provider: 'Wikimedia Commons'};
  }
  return null;
}

export async function searchOpenverse(query, fetcher = fetch) {
  const url = new URL('https://api.openverse.org/v1/images/');
  Object.entries({q: query, license: 'by,by-sa,cc0,pdm', aspect_ratio: 'wide', size: 'large', page_size: '12', mature: 'false'}).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetcher(url, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(20000)});
  if (!res.ok) throw Error('Openverse HTTP ' + res.status);
  for (const r of (await res.json()).results || []) {
    const license = `${r.license === 'cc0' || r.license === 'pdm' ? r.license.toUpperCase() : 'CC ' + r.license.toUpperCase()} ${r.license_version || ''}`.trim();
    if (!allowedLicense(license) || !landscape(r.width || 0, r.height || 0) || !/^https:\/\//.test(r.url)) continue;
    return {url: r.url, title: strip(r.title).slice(0, 160), creator: strip(r.creator).slice(0, 120) || r.source || 'Openverse', license, licenseUrl: r.license_url || null, sourceUrl: r.foreign_landing_url || r.url, provider: r.source ? r.source[0].toUpperCase() + r.source.slice(1) : 'Openverse'};
  }
  return null;
}

// Never throws: a missing photo just leaves the section cover in place.
export async function findImage(query, {fetcher = fetch} = {}) {
  const q = String(query || '').replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!q) return null;
  // Long queries (e.g. a whole headline) rarely match: retry with the names in it, then the first words.
  const stop = /^(the|a|an|of|in|on|at|to|for|and|with|by|from|as|its|is|are|was|were)$/i;
  const words = q.split(' ').filter(w => !stop.test(w));
  const names = q.match(/\b[A-Z][\p{L}.-]+(?:\s+[A-Z][\p{L}.-]+)*/gu)?.filter(n => !stop.test(n)) || [];
  // In Title Case headlines every word looks like a name, so only use names in sentence-case text.
  const titleCase = words.filter(w => /^[A-Z]/.test(w)).length / Math.max(1, words.length) > 0.6;
  const variants = [...new Set([q, titleCase ? null : names.sort((a, b) => b.length - a.length)[0], words.slice(0, 3).join(' '), words.slice(0, 2).join(' ')].filter(v => v && v.split(' ').length <= 6))];
  for (const variant of variants) {
    for (const search of [searchCommons, searchOpenverse]) {
      try { const image = await search(variant, fetcher); if (image) return {...image, query: variant}; } catch {}
    }
  }
  return null;
}

// Gives already published agent stories a photo (no AI calls). Returns how many were updated.
export async function backfillImages(articles, save, {fetcher = fetch, limit = 10} = {}) {
  let updated = 0;
  for (const a of articles.filter(a => a.publicationMode === 'agents' && !a.image && (a.imageAttempts || 0) < 2).slice(0, limit)) {
    const image = await findImage(a.imageQuery || a.originalTitle || a.title.en, {fetcher});
    await save({...a, ...(image ? {image} : {}), imageSearchedAt: new Date().toISOString(), imageAttempts: (a.imageAttempts || 0) + 1});
    if (image) updated++;
  }
  return updated;
}
