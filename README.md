# ATLAS news portal

Bilingual development prototype, Node.js >=22 and Python >=3.10. No package installation or API keys required. Use the existing checkout; cloud tasks are isolated and do not need an additional worktree.

```sh
cd /workspace/Diroll25
npm start
```

Server: 127.0.0.1:3000; override PORT if needed. For a read-only server use `PUBLIC_DEMO=1 npm start`. The default local newsroom has no login: never expose it publicly. Public mode blocks collecting, reading drafts, editing and publishing. ATLAS_DATA_DIR overrides the local storage directory; default data/articles.json is ignored by Git. Storage mutations are serialized and atomic. No database, accounts, Telegram or background scheduler yet.

## Reader experience

Russian and English, manual world/country scope, remembered topic preferences, five-story briefing derived from the selected feed, dark mode, search, bookmarks, responsive layouts, reading progress and reduced-motion support. The article page explains what happened, why it matters and what comes next, with source links and publication/update times in Moscow time. Global source stories have no invented country. No IP geolocation. Selecting a country switches to local scope; the world tab keeps language and interests unchanged. Topic preferences apply across the feed.

## Collection and editorial review

Open the local Newsroom and choose Collect source updates. Configured first-party Atom feeds: Node.js and VS Code official releases, both via HTTPS github.com. This is a tested initial technology feed, not comprehensive general-news coverage or a trend-ranking agent. Sources for other categories and a scheduler remain to be added. Run `python3 tools/collect.py` to inspect collection as JSON without modifying the store. TLS verification stays enabled. Python uses inherited HTTPS proxy and trust.

The collector records canonical source links, original titles and timestamps, imports up to eight entries per source, and never publishes them. Recollection deduplicates URLs and preserves editorial decisions. Raw external HTML is not rendered. Full copyrighted articles are not copied. There is no LLM summarization, automated translation or AI fact-checking: imported titles remain in the original language until edited. Each source reports success or a bounded error.

The editor can compare the source with both language drafts, fill What happened / Why it matters / What next, and explicitly confirm facts and both languages. Publishing non-demo drafts requires an HTTPS source, valid date no more than 72 hours old and not over 15 minutes in the future, titles, reviewed facts and reviewed translation. These are formal gates, not proof of factual accuracy. The human must follow the source and check the actual claims. Old announcements remain in the queue but are not eligible for this fresh feed.

A collection test returned 16 real release announcements; these were stored as local pending drafts, without publication. They are excluded from the public build. Do not commit draft data or credentials.

## Public and offline demo

```sh
python3 tools/build-preview.py
```

Generates atlas-demo.html and docs/index.html from tracked fictional samples and embedded illustrative photographs, without reading local real drafts. The static Newsroom is a read-only interface demonstration; all writes are disabled. GitHub Pages cannot run the collector or a private newsroom. No Telegram buttons appear until real channels are connected. No fake dates, source citations or AI verification badges are added to samples. Advertising remains a labelled future placement.

The workflow publishes docs to GitHub Pages once Pages is enabled for GitHub Actions. Alternatively select main /docs in repository Pages settings for branch deployment. Neither mode runs the Node server. Backend approvals update only the server feed; publishing reviewed real content to Pages requires a separate explicit export, not automatic leakage of the queue.

## Verification

`npm test` exercises publication gates, URL deduplication, preservation of rejections, the HTTP edit/approve path, persisted approval after restart, cross-origin rejection and public-mode protection. Browser checks cover homepage, sections, articles, embedded photos, bookmarking, language/theme controls, preferences, briefing and the read-only newsroom.

## Rollback

The previous design is tagged `atlas-before-editorial-v2`. Use `git revert <editorial-change-commit>` to undo this update without rewriting history, then push to main to redeploy. The ignored data/articles.before-editorial-v2.json preserves local editorial data before the import. Code rollback does not automatically overwrite editorial data; inspect and stop the server before deliberately restoring a data backup.

## Images and design

Photographs are illustrative, not documentary evidence of fictional stories. Source: MIT-licensed Start Bootstrap Clean Blog, Grayscale and Landing Page repositories; license in public/images/LICENSE.txt. Current BBC, Guardian and Verge pages could not be inspected because of proxy policy. Design uses established editorial conventions, not a claimed live trend survey.

For automatic collection while the local server runs, use `npm run newsroom`. It collects on startup and every 30 minutes; ATLAS_COLLECT_INTERVAL_MINUTES can override this (minimum 5). `npm start` keeps collection manual. Public mode always disables the collector. This is a scheduled source reader, not an AI trend evaluator. Failed sources are reported; successful sources still import. Approval is always separate. The running server and scheduler do not survive a stopped cloud task.
