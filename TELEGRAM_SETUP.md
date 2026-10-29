# ATLAS / Контекст — channel plan

No channels or bot are connected yet. Proposed brand: **ATLAS / Контекст** (English: **ATLAS / Context**). These are candidates, not reserved or confirmed available usernames. Network requests to t.me returned proxy 403 on the setup machine; no availability claim can be made. A public page check alone would not guarantee that a username is available. Creation in Telegram is the authoritative availability check; global uniqueness of a brand across the Internet cannot be guaranteed.

| Section | Russian candidate | English candidate |
| --- | --- | --- |
| Main | @atlas_context_ru | @atlas_context_en |
| Technology | @atlas_context_tech_ru | @atlas_context_tech_en |
| Science | @atlas_context_science_ru | @atlas_context_science_en |
| Economy | @atlas_context_economy_ru | @atlas_context_economy_en |
| Culture | @atlas_context_culture_ru | @atlas_context_culture_en |
| Sport | @atlas_context_sport_ru | @atlas_context_sport_en |
| Travel | @atlas_context_travel_ru | @atlas_context_travel_en |

The owner must create channels under their own Telegram account, select available public usernames, create a bot through the official @BotFather and grant it posting rights only in owned channels. The Bot API does not create channels. Do not share a bot token in chat or commit it.

Once created, put the actual https://t.me/... links in config/connections.json under telegram.ru/en (all or category key). Only configured links appear as subscriptions. Telegram share links on articles work independently of these channels.

For scheduled Pages delivery, store TELEGRAM_BOT_TOKEN in repository Actions secrets. For the local server, add it securely in environment settings and explicitly set ATLAS_TELEGRAM_DELIVERY=1. Use one delivery worker, not both. Neither is enabled currently. New, non-archive verified announcements are eligible. Per-channel/per-language delivery state prevents repeated scheduled sends; uncertain outcomes are held for human inspection rather than blindly retried. Successful send requires the Telegram API acknowledgement. No Telegram messages were sent during setup.
