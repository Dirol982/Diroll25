// Accounts and sessions: scrypt password hashes, random session tokens stored only as SHA-256.
import {scryptSync, randomBytes, timingSafeEqual, createHash} from 'node:crypto';
import {nowIso} from './db.js';
import {validEmail} from '../subscriptions.js';

const SESSION_DAYS = 30;
const sha = s => createHash('sha256').update(s).digest('hex');

export function hashPassword(password) {
  const salt = randomBytes(16);
  return 'scrypt$' + salt.toString('hex') + '$' + scryptSync(password, salt, 64).toString('hex');
}
export function checkPassword(password, stored) {
  const [kind, salt, hash] = String(stored).split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const actual = scryptSync(password, Buffer.from(salt, 'hex'), 64);
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}

export const publicUser = u => u && ({id: u.id, email: u.email, name: u.name, company: u.company, role: u.role, language: u.language, topics: JSON.parse(u.topics), createdAt: u.created_at});

export function authService(db) {
  return {
    register({email, password, name = '', role = 'reader', company = ''}) {
      email = String(email || '').trim().toLowerCase();
      if (!validEmail(email)) throw Object.assign(Error('Invalid email'), {status: 400});
      if (typeof password !== 'string' || password.length < 8 || password.length > 200) throw Object.assign(Error('Password must be at least 8 characters'), {status: 400});
      if (!['reader', 'advertiser'].includes(role)) throw Object.assign(Error('Invalid role'), {status: 400});
      if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw Object.assign(Error('This email is already registered'), {status: 409});
      // The owner's address (ATLAS_ADMIN_EMAIL) becomes the administrator on sign-up.
      const owner = !!process.env.ATLAS_ADMIN_EMAIL && email === process.env.ATLAS_ADMIN_EMAIL.trim().toLowerCase();
      const info = db.prepare('INSERT INTO users (email, password_hash, name, company, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(email, hashPassword(password), String(name).slice(0, 100), String(company).slice(0, 150), owner ? 'admin' : role, nowIso());
      return this.user(Number(info.lastInsertRowid));
    },
    login(email, password) {
      const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
      // Hash anyway so timing does not reveal whether the email exists.
      const ok = u ? checkPassword(String(password || ''), u.password_hash) : (hashPassword('x'), false);
      if (!ok) throw Object.assign(Error('Wrong email or password'), {status: 401});
      return u;
    },
    createSession(userId) {
      const token = randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(sha(token), userId, nowIso(), new Date(Date.now() + SESSION_DAYS * 86400000).toISOString());
      return {token, maxAge: SESSION_DAYS * 86400};
    },
    userForToken(token) {
      if (!/^[a-f0-9]{64}$/.test(token || '')) return null;
      return db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').get(sha(token), nowIso()) || null;
    },
    destroySession(token) { if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token)); },
    user(id) { return db.prepare('SELECT * FROM users WHERE id = ?').get(id); },
    updateProfile(id, {name, company, language, topics}, allowedTopics) {
      const u = this.user(id);
      const next = {
        name: typeof name === 'string' ? name.slice(0, 100) : u.name,
        company: typeof company === 'string' ? company.slice(0, 150) : u.company,
        language: ['ru', 'en'].includes(language) ? language : u.language,
        topics: Array.isArray(topics) ? JSON.stringify(topics.filter(t => allowedTopics.includes(t))) : u.topics,
      };
      db.prepare('UPDATE users SET name = ?, company = ?, language = ?, topics = ? WHERE id = ?').run(next.name, next.company, next.language, next.topics, id);
      return this.user(id);
    },
    setRole(id, role) {
      if (!['reader', 'advertiser', 'editor', 'admin'].includes(role)) throw Object.assign(Error('Invalid role'), {status: 400});
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    },
    becomeAdvertiser(id) { db.prepare("UPDATE users SET role = 'advertiser' WHERE id = ? AND role = 'reader'").run(id); },
  };
}
