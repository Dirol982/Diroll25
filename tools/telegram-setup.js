// Checks the per-section Telegram channels listed in config/topics.json.
//   TELEGRAM_BOT_TOKEN=... node tools/telegram-setup.js                 report only
//   ... node tools/telegram-setup.js --apply                            also set title and description
//   ... node tools/telegram-setup.js --write-config                     put verified links in config/connections.json
// Channels must be created by the owner in Telegram first; the Bot API cannot create channels.
import {readFile, writeFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const token = process.env.TELEGRAM_BOT_TOKEN;
const apply = process.argv.includes('--apply');
const writeConfig = process.argv.includes('--write-config');
const {topics} = JSON.parse(await readFile(new URL('config/topics.json', root), 'utf8'));

if (!token) {
  console.log('Channels to create (public username → title):\n');
  for (const t of topics) for (const lang of ['ru', 'en']) console.log(`@${t.telegram[lang].username.padEnd(26)} ${t.telegram[lang].title}`);
  console.log('\nSet TELEGRAM_BOT_TOKEN to check bot permissions in each channel.');
  process.exit(0);
}

async function call(method, params) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(params), signal: AbortSignal.timeout(15000)});
  return response.json();
}

const me = await call('getMe', {});
if (!me.ok) { console.error('Bot token rejected by Telegram'); process.exit(1); }
console.log(`Bot: @${me.result.username}\n`);
const connections = JSON.parse(await readFile(new URL('config/connections.json', root), 'utf8'));
let ready = 0, total = 0;
for (const topic of topics) {
  for (const lang of ['ru', 'en']) {
    total++;
    const ch = topic.telegram[lang], chatId = '@' + ch.username;
    const chat = await call('getChat', {chat_id: chatId});
    if (!chat.ok) { console.log(`✗ ${chatId}: not found or bot not added (${chat.description})`); continue; }
    const member = await call('getChatMember', {chat_id: chatId, user_id: me.result.id});
    const canPost = member.ok && (member.result.status === 'creator' || (member.result.status === 'administrator' && member.result.can_post_messages));
    if (!canPost) { console.log(`✗ ${chatId}: bot is not an admin with "Post messages" permission`); continue; }
    if (apply) {
      if (chat.result.title !== ch.title) await call('setChatTitle', {chat_id: chatId, title: ch.title});
      if ((chat.result.description || '') !== ch.description) await call('setChatDescription', {chat_id: chatId, description: ch.description});
    }
    ready++;
    console.log(`✓ ${chatId}: ready${apply ? ', title and description synced' : ''}`);
    if (writeConfig) { connections.telegram[lang] ||= {}; connections.telegram[lang][topic.id] = 'https://t.me/' + ch.username; }
  }
}
if (writeConfig) { await writeFile(new URL('config/connections.json', root), JSON.stringify(connections, null, 2) + '\n'); console.log('\nconfig/connections.json updated with verified channels'); }
console.log(`\n${ready}/${total} channels ready`);
