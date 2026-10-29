# ATLAS / Context — test news portal

Node.js >=22, Python >=3.10; no package installation required. Use the existing checkout, not another worktree.

```sh
cd /workspace/Diroll25
npm start          # local server, manual collection
npm run newsroom  # collection + two-stage automatic publication on startup/every 30 min
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
```

Server binds 127.0.0.1:3000 (PORT override). The default editor is local and has no login: never expose it publicly. `PUBLIC_DEMO=1 npm start` blocks all editorial/collector APIs. Keep the server running for local schedules. GitHub Actions provides the independent scheduled public-site pipeline; schedules can be delayed by GitHub and require Actions permissions. Do not operate two delivery workers for the same Telegram channels.

## Current publication

16 real first-party release announcements passed two checks and are test-published alongside six clearly labelled fictional samples. Thirteen older announcements were explicitly imported as archive for this test; ordinary automatic publication only accepts announcements <=72h old, and existing items age into archive. No AI fact-checking, trend ranking, independent news reporting, full-article reproduction or security assessment is claimed.

Two deterministic stages in tools/publish.py:

1. Official Atom feed: configured repository/HTTPS URL, category, version in title, valid source timestamp, no future timestamps. Only Node.js and VS Code repositories are accepted.
2. A separate HTTPS request to the original release page: exact normalized H1 match and corroborated publication timestamp. Redirects and mismatches are held, not published. TLS verification remains enabled. Source-page hash and checked-at time are retained for traceability.

Only then does a fixed bilingual template say that the official repository announced the specific release. It makes no claims about release quality, safety or undocumented changes. Original wording and source link remain visible. Both checks use the same first-party publisher and do not constitute two independent journalistic sources.

```sh
python3 tools/collect.py                         # inspect source drafts, no publication
python3 tools/publish.py                         # verify and publish fresh announcements
python3 tools/publish.py --include-archive        # explicit one-off test of older entries
python3 tools/build-preview.py                   # regenerate docs/index.html and atlas-demo.html
```

config/published.json is an intentionally public, verified export; data/articles.json and all subscriber data remain ignored by Git. Rejecting a local draft stops local automatic overwrite; the static public snapshot is separate. To retract a public announcement, remove it from config/published.json and remove/disable its source or exclude it from publication before the next refresh. A full shared moderation database is not implemented.

The Pages workflow tests, refreshes every 30 minutes/on manual dispatch, builds, optionally delivers Telegram, saves the snapshot and deploys. It does not need an LLM key. Push deployments build the committed verified snapshot. GitHub Pages must be enabled; this workflow uses the Actions deployment mode. GitHub's scheduled jobs are not a guaranteed realtime service.

## Reading experience

Larger responsive type, photograph thumbnails in the five-story briefing, source/date/archive labels, world/country scope, interests, dark mode, search, local bookmarks, article What happened / Why it matters / What next and a source-check explanation. Photos are illustrations, not documentary evidence for each story. Russian and English use fixed release templates for automatic stories; arbitrary news translation is not connected. No country is invented for global releases. Dates are shown in Europe/Moscow. No IP geolocation.

The static newsroom is a read-only layout demonstration. The local editor supports comparing the source with bilingual drafts and manual approval. Manual stories still require human-confirmed facts/translation, source/date/title checks. PUBLIC_DEMO blocks access to real drafts.

## Telegram

Article links open Telegram's real share dialog. Subscription links appear only for actual channels configured in config/connections.json. None are configured yet. Proposed names and owner setup: TELEGRAM_SETUP.md. Username availability was not confirmed: t.me returned proxy 403. Neither channels nor a bot can be created through the available tools.

Sending requires owner-created channels, an admin bot, actual links in connections.telegram.ru/en, and TELEGRAM_BOT_TOKEN stored securely. For GitHub Actions use repository secrets; cloud-environment credentials do not automatically become repository secrets. For local delivery explicitly enable ATLAS_TELEGRAM_DELIVERY=1. Only fresh, non-demo verified announcements are delivered. The journal holds uncertain outcomes to prevent automatic retries after ambiguous delivery. Real Telegram sending has not been validated and no messages were sent; adapter behavior was tested with a simulated response.

## Email subscriptions

The UI is present but disabled while the transport/backend is missing: no addresses are collected and no fake success is shown. Backend implementation supports explicit consent, language/topics, confirmation with a one-time 24-hour link, per-IP request limits, one-hour confirmation resend cooldown, deletion on unsubscribe, and daily digests only for confirmed readers. Delivery tracks previously sent article IDs. Tests use simulated email transport; no real emails were sent.

To activate, create a Brevo account, verify the sender, and add BREVO_API_KEY, NEWSLETTER_FROM and NEWSLETTER_PUBLIC_URL securely. The latter is an HTTPS URL of a running Node backend, not a Pages URL. Set connections.newsletterEndpoint to that backend's `/api/newsletter/subscribe`; allowed frontend origin is derived from connections.siteUrl. Serve only public-mode APIs on that backend. Enable ATLAS_EMAIL_DELIVERY=1 on the local scheduler after testing email delivery. GitHub Pages cannot accept subscriptions, store private subscriber lists or run this backend.

Subscribers live in private data/subscribers.json (0600, ignored by Git). Keep this directory on persistent storage, back it up securely and never publish it. Confirmation tokens are hashed; a private unsubscribe token is retained to insert an opt-out link in each digest. No subscriber-list endpoint is exposed. One backend process/storage writer is supported; production scale needs a database and a durable job queue. Daily digest delivery has in-process serialization but no transactional external-email guarantee on crashes.

Environment-setting requirements are saved as metadata, not secret values. Saving a draft does not supply credentials, start a backend, publish the environment or set GitHub Actions secrets. Real integration remains blocked until the accounts and backend exist.

## Rollback and data

Previous release tag: atlas-before-autopublish-v3. Earlier design: atlas-before-editorial-v2. Use `git revert` on the update commit and push main; do not rewrite shared history. Code rollback is separate from local editorial/subscriber data. Backup of pre-update local articles: data/articles.before-autopublish-v3.json. ATLAS_DATA_DIR selects an alternate private store. Stop the server before deliberate data restoration. Do not delete subscriber data as part of a visual rollback.

## Photography

Illustrative assets: Start Bootstrap MIT-licensed Clean Blog, Grayscale and Landing Page repositories; license public/images/LICENSE.txt. All are local and embedded in the offline build. Current BBC/Guardian/Verge designs could not be inspected due to proxy restrictions; design uses established editorial patterns.
