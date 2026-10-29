# ATLAS — prototype news portal

Requires Node.js 22 or newer. No third-party packages or installation needed.

```sh
cd /workspace/Diroll25
npm start
```

The server listens on 127.0.0.1:3000 (override PORT as needed). Russian and English UI and sample stories, manual region/topic selection, browser language detection, remembered preferences, and editorial approve/reject queue are implemented. Editorial decisions persist to data/articles.json. Initial stories are explicitly fictional demo material. There is no live collection, translation, AI verification, geolocation, Telegram delivery, authentication, or advertising integration yet.

For a read-only public demo, run `PUBLIC_DEMO=1 npm start`. This hides the newsroom button and denies both reading the review queue and all review mutations with HTTP 403. Never expose the default editorial mode. A public tunnel requires platform TCP access to the provider; current environment has no TCP destinations configured and its TCP proxy refused the connection during validation. No public tunnel has been established.

This is a local development prototype. The editorial API has no authentication: do not expose this service publicly. Before deployment add authenticated editor roles, CSRF protection, persistent database transactions, source attribution/licensing, independent fact checks, job retries and Telegram delivery tracking. IP-based location must remain an overridable suggestion. Never commit API keys or bot tokens.

Next stage: agree on licensed RSS/API sources; implement collection with timestamps and deduplication, source-backed bilingual drafts, review checks, and Telegram delivery only after approval. AI review does not guarantee factual accuracy. Create channels under the owner's Telegram account and grant a bot only required permissions.

## Visual prototype, second edition

The homepage, category routes (`#category/science`), and article routes (`#article/2`) now have editorial layouts, local illustrative photography, dark mode, headline search, bookmarks, reading progress, and reduced-motion support. Bookmarks and preferences are local to the browser. Category and article navigation works in the offline file. Newsroom APIs remain unchanged and are disabled in public demo mode.

Build the offline preview with `python3 tools/build-preview.py`, then open `atlas-demo.html`. All six fictional sample stories are included for design review, independently of server publication decisions. This does not publish drafts on the server. No external requests are required by the offline preview. It is a visual prototype, not live news or a fact-checked feed.

Current BBC, Guardian, and Verge pages could not be inspected: the environment returned proxy 403 for each. Design decisions use established editorial patterns rather than a claimed live trend analysis. Photographs are illustrative assets from Start Bootstrap's MIT-licensed Clean Blog, Grayscale and Landing Page template repositories, not documentary evidence for the fictional stories. License: public/images/LICENSE.txt. Sources: https://github.com/StartBootstrap/startbootstrap-clean-blog, https://github.com/StartBootstrap/startbootstrap-grayscale, https://github.com/StartBootstrap/startbootstrap-landing-page.
