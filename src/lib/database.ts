import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'tickets.sqlite');

function ensureDataDir(dbPath: string) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDataDir(DB_PATH);

const db = new Database(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS guild_settings (
  guildId TEXT PRIMARY KEY,
  staffRoleId TEXT,
  allowedRoles TEXT,
  categoryId TEXT,
  closedCategoryId TEXT,
  claimEnabled INTEGER DEFAULT 1,
  transcriptEnabled INTEGER DEFAULT 1,
  transcriptChannelId TEXT,
  feedbackChannelId TEXT,
  closeTimeout INTEGER DEFAULT 0,
  embedColor TEXT,
  embedFooter TEXT,
  ticketChannelId TEXT,
  logsChannelId TEXT,
  channelPrefix TEXT DEFAULT '{category}-{count}'
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  channelId TEXT NOT NULL,
  userId TEXT NOT NULL,
  status TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  closedAt INTEGER,
  transcriptPath TEXT,
  closedBy TEXT
);

CREATE TABLE IF NOT EXISTS ticket_meta (
  ticketId INTEGER PRIMARY KEY,
  guildId TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  claimedBy TEXT,
  ownerId TEXT
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  authorId TEXT NOT NULL,
  targetUserId TEXT,
  content TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  isPrivate INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS staff_profiles (
  guildId TEXT NOT NULL,
  userId TEXT NOT NULL,
  bio TEXT,
  timezone TEXT DEFAULT 'UTC',
  activeHours TEXT,
  PRIMARY KEY (guildId, userId)
);

CREATE TABLE IF NOT EXISTS staff_stats (
  guildId TEXT NOT NULL,
  userId TEXT NOT NULL,
  closedCount INTEGER DEFAULT 0,
  claimedCount INTEGER DEFAULT 0,
  PRIMARY KEY (guildId, userId)
);

CREATE TABLE IF NOT EXISTS tags (
  guildId TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  createdBy TEXT,
  createdAt INTEGER,
  PRIMARY KEY (guildId, name)
);

CREATE TABLE IF NOT EXISTS panels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  title TEXT,
  description TEXT,
  creatorId TEXT,
  buttons TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  channelId TEXT,
  messageId TEXT,
  embedColor TEXT,
  includeStats INTEGER DEFAULT 0,
  statsMessageId TEXT
);

CREATE TABLE IF NOT EXISTS ticket_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  ticketId INTEGER NOT NULL,
  userId TEXT NOT NULL,
  score INTEGER NOT NULL,
  handledBy TEXT,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  name TEXT NOT NULL,
  discordCategoryId TEXT,
  createdAt INTEGER NOT NULL,
  UNIQUE(guildId, name)
);

CREATE TABLE IF NOT EXISTS category_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoryId INTEGER NOT NULL,
  question TEXT NOT NULL,
  placeholder TEXT,
  required INTEGER DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
);
`);

try {
  const info = db.prepare("PRAGMA table_info(guild_settings)").all();
  const cols = (info || []).map((c: any) => c.name);
  if (!cols.includes('feedbackChannelId')) {
    db.prepare('ALTER TABLE guild_settings ADD COLUMN feedbackChannelId TEXT').run();
  }
  if (!cols.includes('embedColor')) {
    db.prepare('ALTER TABLE guild_settings ADD COLUMN embedColor TEXT').run();
  }
  if (!cols.includes('embedFooter')) {
    db.prepare('ALTER TABLE guild_settings ADD COLUMN embedFooter TEXT').run();
  }
  if (!cols.includes('ticketChannelId')) {
    db.prepare('ALTER TABLE guild_settings ADD COLUMN ticketChannelId TEXT').run();
  }
  if (!cols.includes('logsChannelId')) {
    db.prepare('ALTER TABLE guild_settings ADD COLUMN logsChannelId TEXT').run();
  }
  if (!cols.includes('ticketChannelId')) {
    db.prepare('ALTER TABLE guild_settings ADD COLUMN ticketChannelId TEXT').run();
  }
  if (!cols.includes('logsChannelId')) {
    db.prepare('ALTER TABLE guild_settings ADD COLUMN logsChannelId TEXT').run();
  }
} catch (e) { /* ignore */ }

try {
  const info2 = db.prepare("PRAGMA table_info(tickets)").all();
  const cols2 = (info2 || []).map((c: any) => c.name);
  if (!cols2.includes('closedBy')) {
    db.prepare('ALTER TABLE tickets ADD COLUMN closedBy TEXT').run();
  }
} catch (e) { /* ignore */ }

try {
  const info3 = db.prepare("PRAGMA table_info(categories)").all();
  const cols3 = (info3 || []).map((c: any) => c.name);
  if (!cols3.includes('discordCategoryId')) {
    db.prepare('ALTER TABLE categories ADD COLUMN discordCategoryId TEXT').run();
  }
  if (!cols3.includes('title')) {
    db.prepare('ALTER TABLE categories ADD COLUMN title TEXT').run();
  }
  if (!cols3.includes('description')) {
    db.prepare('ALTER TABLE categories ADD COLUMN description TEXT').run();
  }
} catch (e) { /* ignore */ }

try {
  const info4 = db.prepare("PRAGMA table_info(panels)").all();
  const cols4 = (info4 || []).map((c: any) => c.name);
  if (!cols4.includes('embedColor')) {
    db.prepare('ALTER TABLE panels ADD COLUMN embedColor TEXT').run();
  }
  if (!cols4.includes('description')) {
    db.prepare('ALTER TABLE panels ADD COLUMN description TEXT').run();
  }
  if (!cols4.includes('includeStats')) {
    db.prepare('ALTER TABLE panels ADD COLUMN includeStats INTEGER DEFAULT 0').run();
  }
  if (!cols4.includes('statsMessageId')) {
    db.prepare('ALTER TABLE panels ADD COLUMN statsMessageId TEXT').run();
  }
} catch (e) { /* ignore */ }

try {
  const info5 = db.prepare("PRAGMA table_info(staff_profiles)").all();
  const cols5 = (info5 || []).map((c: any) => c.name);
  if (!cols5.includes('timezone')) {
    db.prepare('ALTER TABLE staff_profiles ADD COLUMN timezone TEXT DEFAULT "UTC"').run();
  }
  if (!cols5.includes('activeHours')) {
    db.prepare('ALTER TABLE staff_profiles ADD COLUMN activeHours TEXT').run();
  }
  if (cols5.includes('displayName')) {
    try {
      db.prepare(`
        CREATE TABLE staff_profiles_new (
          guildId TEXT NOT NULL,
          userId TEXT NOT NULL,
          bio TEXT,
          timezone TEXT DEFAULT 'UTC',
          activeHours TEXT,
          PRIMARY KEY (guildId, userId)
        )
      `).run();
      db.prepare('INSERT INTO staff_profiles_new SELECT guildId, userId, bio, timezone, activeHours FROM staff_profiles').run();
      db.prepare('DROP TABLE staff_profiles').run();
      db.prepare('ALTER TABLE staff_profiles_new RENAME TO staff_profiles').run();
    } catch (e) {
      console.warn('Failed to migrate staff_profiles table:', e);
    }
  }
} catch (e) { /* ignore */ }

try {
  const infoGuildSettings = db.prepare("PRAGMA table_info(guild_settings)").all();
  const colsGuildSettings = (infoGuildSettings || []).map((c: any) => c.name);
  if (!colsGuildSettings.includes('channelPrefix')) {
    db.prepare("ALTER TABLE guild_settings ADD COLUMN channelPrefix TEXT DEFAULT '{category}-{count}'").run();
  }
} catch (e) { /* ignore */ }


export type GuildSettingsRow = {
  guildId: string;
  staffRoleId?: string | null;
  allowedRoles?: string | null;
  categoryId?: string | null;
  closedCategoryId?: string | null;
  claimEnabled?: number;
  transcriptEnabled?: number;
  transcriptChannelId?: string | null;
  feedbackChannelId?: string | null;
  closeTimeout?: number;
   embedColor?: string | null;
   embedFooter?: string | null;
   ticketChannelId?: string | null;
   logsChannelId?: string | null;
   channelPrefix?: string | null;
};

export function getGuildSettings(guildId: string): GuildSettingsRow | null {
  const stmt = db.prepare('SELECT * FROM guild_settings WHERE guildId = ?');
  const row = stmt.get(guildId) as GuildSettingsRow | undefined;
  return row ?? null;
}

export function upsertGuildSettings(settings: GuildSettingsRow) {
  const stmt = db.prepare(`INSERT INTO guild_settings (
    guildId, staffRoleId, allowedRoles, categoryId, closedCategoryId, claimEnabled, transcriptEnabled, transcriptChannelId, feedbackChannelId, closeTimeout, embedColor, embedFooter, ticketChannelId, logsChannelId, channelPrefix
  ) VALUES (@guildId,@staffRoleId,@allowedRoles,@categoryId,@closedCategoryId,@claimEnabled,@transcriptEnabled,@transcriptChannelId,@feedbackChannelId,@closeTimeout,@embedColor,@embedFooter,@ticketChannelId,@logsChannelId,@channelPrefix)
  ON CONFLICT(guildId) DO UPDATE SET
    staffRoleId=excluded.staffRoleId,
    allowedRoles=excluded.allowedRoles,
    categoryId=excluded.categoryId,
    closedCategoryId=excluded.closedCategoryId,
    claimEnabled=excluded.claimEnabled,
    transcriptEnabled=excluded.transcriptEnabled,
    transcriptChannelId=excluded.transcriptChannelId,
    feedbackChannelId=excluded.feedbackChannelId,
    closeTimeout=excluded.closeTimeout,
    embedColor=excluded.embedColor,
    embedFooter=excluded.embedFooter,
    ticketChannelId=excluded.ticketChannelId,
    logsChannelId=excluded.logsChannelId,
    channelPrefix=excluded.channelPrefix
  `);
  stmt.run(settings as any);
}

export type TicketRow = {
  id: number;
  guildId: string;
  channelId: string;
  userId: string;
  status: string;
  createdAt: number;
  closedAt?: number | null;
  transcriptPath?: string | null;
  closedBy?: string | null;
};

export type NewTicketRow = Omit<TicketRow, 'id'>;

export function createTicketRow(t: NewTicketRow): number {
  const stmt = db.prepare(`INSERT INTO tickets (guildId, channelId, userId, status, createdAt, closedAt, transcriptPath)
  VALUES (@guildId,@channelId,@userId,@status,@createdAt,@closedAt,@transcriptPath)`);
  const params = {
    guildId: t.guildId,
    channelId: t.channelId,
    userId: t.userId,
    status: t.status,
    createdAt: t.createdAt,
    closedAt: t.closedAt ?? null,
    transcriptPath: t.transcriptPath ?? null,
  };
  const info = stmt.run(params as any);
  return Number(info.lastInsertRowid);
}

export function setTicketMeta(ticketId: number, meta: Partial<{ priority: string; claimedBy: string; ownerId: string; guildId: string }>){
  type TicketMetaRow = { ticketId: number; guildId: string; priority?: string | null; claimedBy?: string | null; ownerId?: string | null };
  const existing = db.prepare('SELECT * FROM ticket_meta WHERE ticketId = ?').get(ticketId) as TicketMetaRow | undefined;
  if (!existing) {
    const stmt = db.prepare('INSERT INTO ticket_meta (ticketId, guildId, priority, claimedBy, ownerId) VALUES (@ticketId,@guildId,@priority,@claimedBy,@ownerId)');
    stmt.run({ ticketId, guildId: meta.guildId, priority: meta.priority || 'normal', claimedBy: meta.claimedBy || null, ownerId: meta.ownerId || null });
  } else {
    const keys = Object.keys(meta);
    if (!keys.length) return;
    const set = keys.map(k => `${k} = @${k}`).join(', ');
    const stmt = db.prepare(`UPDATE ticket_meta SET ${set} WHERE ticketId = @ticketId`);
    (stmt as any).run({ ...meta, ticketId });
  }
}

export function getTicketMeta(ticketId: number){
  type TicketMetaRow = { ticketId: number; guildId: string; priority?: string | null; claimedBy?: string | null; ownerId?: string | null };
  const stmt = db.prepare('SELECT * FROM ticket_meta WHERE ticketId = ?');
  const row = stmt.get(ticketId) as TicketMetaRow | undefined;
  return row ?? null;
}

export function addNote(guildId: string, authorId: string, targetUserId: string | null, content: string, isPrivate = 1){
  const stmt = db.prepare('INSERT INTO notes (guildId, authorId, targetUserId, content, createdAt, isPrivate) VALUES (?, ?, ?, ?, ?, ?)');
  const info = stmt.run(guildId, authorId, targetUserId, content, Date.now(), isPrivate ? 1 : 0);
  return Number(info.lastInsertRowid);
}

export function getNotesForUser(guildId: string, userId: string){
  type NoteRow = { id: number; guildId: string; authorId: string; targetUserId?: string | null; content: string; createdAt: number; isPrivate: number };
  const stmt = db.prepare('SELECT * FROM notes WHERE guildId = ? AND targetUserId = ? ORDER BY createdAt DESC');
  return stmt.all(guildId, userId) as NoteRow[];
}

export function deleteNote(id: number, guildId: string){
  const stmt = db.prepare('DELETE FROM notes WHERE id = ? AND guildId = ?');
  const info = stmt.run(id, guildId);
  return Number((info as any).changes || 0);
}

export function createOrUpdateProfile(guildId: string, userId: string, bio?: string, timezone?: string, activeHours?: string){
  const stmt = db.prepare(`INSERT INTO staff_profiles (guildId,userId,bio,timezone,activeHours) VALUES (@guildId,@userId,@bio,@timezone,@activeHours)
    ON CONFLICT(guildId,userId) DO UPDATE SET bio=excluded.bio, timezone=excluded.timezone, activeHours=excluded.activeHours`);
  stmt.run({ guildId, userId, bio, timezone, activeHours });
}

export function getProfile(guildId: string, userId: string){
  type ProfileRow = { guildId: string; userId: string; bio?: string | null; timezone?: string | null; activeHours?: string | null };
  const stmt = db.prepare('SELECT * FROM staff_profiles WHERE guildId = ? AND userId = ?');
  const row = stmt.get(guildId, userId) as ProfileRow | undefined;
  return row ?? null;
}

export function incStaffStat(guildId: string, userId: string, field: 'closedCount' | 'claimedCount'){
  const stmt = db.prepare(`INSERT INTO staff_stats (guildId,userId,${field}) VALUES (@guildId,@userId,1)
    ON CONFLICT(guildId,userId) DO UPDATE SET ${field} = ${field} + 1`);
  stmt.run({ guildId, userId });
}

export function getLeaderboard(guildId: string, limit = 10){
  type StatRow = { userId: string; closedCount: number; claimedCount: number };
  const stmt = db.prepare('SELECT userId, closedCount, claimedCount FROM staff_stats WHERE guildId = ? ORDER BY closedCount DESC LIMIT ?');
  return stmt.all(guildId, limit) as StatRow[];
}

export function createTag(guildId: string, name: string, content: string, createdBy?: string){
  const stmt = db.prepare('INSERT INTO tags (guildId,name,content,createdBy,createdAt) VALUES (?,?,?,?,?)');
  stmt.run(guildId, name, content, createdBy || null, Date.now());
}

export function getTag(guildId: string, name: string){
  type TagRow = { guildId: string; name: string; content: string; createdBy?: string | null; createdAt?: number | null };
  const stmt = db.prepare('SELECT * FROM tags WHERE guildId = ? AND name = ?');
  const row = stmt.get(guildId, name) as TagRow | undefined;
  return row ?? null;
}

export function listTags(guildId: string){
  const stmt = db.prepare('SELECT name FROM tags WHERE guildId = ?');
  return (stmt.all(guildId) as { name: string }[]).map(r => r.name);
}


type PanelButton = { label: string; categoryId?: string | null; categoryDbId?: number | null; color?: string | null; emoji?: string | null };

export function createPanel(guildId: string, title: string | null, creatorId: string | null, buttons: Array<string | PanelButton>, embedColor?: string | null, description?: string | null, includeStats?: boolean){
  const normalized = buttons.map(b => typeof b === 'string' ? { label: b, categoryId: null, categoryDbId: null, color: null, emoji: null } : { label: b.label, categoryId: b.categoryId ?? null, categoryDbId: b.categoryDbId ?? null, color: b.color ?? null, emoji: b.emoji ?? null });
  const stmt = db.prepare('INSERT INTO panels (guildId,title,description,creatorId,buttons,createdAt,embedColor,includeStats) VALUES (?,?,?,?,?,?,?,?)');
  const info = stmt.run(guildId, title || null, description || null, creatorId || null, JSON.stringify(normalized), Date.now(), embedColor || null, includeStats ? 1 : 0);
  return Number((info as any).lastInsertRowid || info.lastInsertRowid);
}

export function getLatestPanelForGuild(guildId: string){
  type PanelRow = { id: number; guildId: string; title?: string | null; creatorId?: string | null; buttons: string; createdAt: number; channelId?: string | null; messageId?: string | null; embedColor?: string | null; includeStats?: number; statsMessageId?: string | null };
  const stmt = db.prepare('SELECT * FROM panels WHERE guildId = ? ORDER BY createdAt DESC LIMIT 1');
  const row = stmt.get(guildId) as PanelRow | undefined;
  if (!row) return null;
  let parsed: any;
  try { parsed = JSON.parse(row.buttons); } catch { parsed = []; }
  const buttons: PanelButton[] = (parsed || []).map((p: any) => typeof p === 'string' ? { label: p, categoryId: null, categoryDbId: null, color: null, emoji: null } : { label: p.label || String(p), categoryId: p.categoryId ?? null, categoryDbId: p.categoryDbId ?? null, color: p.color ?? null, emoji: p.emoji ?? null });
  return { ...row, buttons };
}

export function getPanelById(id: number){
  type PanelRow = { id: number; guildId: string; title?: string | null; creatorId?: string | null; buttons: string; createdAt: number; channelId?: string | null; messageId?: string | null; embedColor?: string | null; includeStats?: number; statsMessageId?: string | null };
  const stmt = db.prepare('SELECT * FROM panels WHERE id = ?');
  const row = stmt.get(id) as PanelRow | undefined;
  if (!row) return null;
  let parsed: any;
  try { parsed = JSON.parse(row.buttons); } catch { parsed = []; }
  const buttons: PanelButton[] = (parsed || []).map((p: any) => typeof p === 'string' ? { label: p, categoryId: null, categoryDbId: null, color: null, emoji: null } : { label: p.label || String(p), categoryId: p.categoryId ?? null, categoryDbId: p.categoryDbId ?? null, color: p.color ?? null, emoji: p.emoji ?? null });
  return { ...row, buttons };
}

export function updatePanelMessage(panelId: number, channelId: string, messageId: string){
  const stmt = db.prepare('UPDATE panels SET channelId = @channelId, messageId = @messageId WHERE id = @panelId');
  stmt.run({ channelId, messageId, panelId });
}

export function getPanelByChannel(channelId: string){
  type PanelRow = { id: number; guildId: string; title?: string | null; creatorId?: string | null; buttons: string; createdAt: number; channelId?: string | null; messageId?: string | null; embedColor?: string | null; includeStats?: number; statsMessageId?: string | null };
  const stmt = db.prepare('SELECT * FROM panels WHERE channelId = ? LIMIT 1');
  const row = stmt.get(channelId) as PanelRow | undefined;
  if (!row) return null;
  let parsed: any;
  try { parsed = JSON.parse(row.buttons); } catch { parsed = []; }
  const buttons: any[] = (parsed || []).map((p: any) => typeof p === 'string' ? { label: p, categoryId: null } : { label: p.label || String(p), categoryId: p.categoryId ?? null });
  return { ...row, buttons };
}

export function listPanels(guildId: string){
  type PanelRow = { id: number; guildId: string; title?: string | null; creatorId?: string | null; buttons: string; createdAt: number; channelId?: string | null; messageId?: string | null; embedColor?: string | null; includeStats?: number; statsMessageId?: string | null };
  const stmt = db.prepare('SELECT * FROM panels WHERE guildId = ? ORDER BY createdAt DESC');
  const rows = stmt.all(guildId) as PanelRow[];
  return rows.map(r => ({ ...r, buttons: (() => { try { return JSON.parse(r.buttons); } catch { return []; } })() }));
}

export function deletePanel(panelId: number){
  const stmt = db.prepare('DELETE FROM panels WHERE id = ?');
  const info = stmt.run(panelId);
  return Number((info as any).changes || 0);
}

export function updatePanel(panelId: number, updates: { title?: string; description?: string; embedColor?: string | null; buttons?: string }) {
  const keys = Object.keys(updates).filter(k => updates[k as keyof typeof updates] !== undefined);
  if (!keys.length) return;
  const set = keys.map(k => `${k} = @${k}`).join(', ');
  const stmt = db.prepare(`UPDATE panels SET ${set} WHERE id = @id`);
  (stmt as any).run({ ...updates, id: panelId });
}

export function updateTicketRow(id: number, patch: Partial<TicketRow>) {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const set = keys.map(k => `${k} = @${k}`).join(', ');
  const stmt = db.prepare(`UPDATE tickets SET ${set} WHERE id = @id`);
  (stmt as any).run({ ...patch, id });
}

export function addFeedback(guildId: string, ticketId: number, userId: string, score: number, handledBy?: string | null) {
  const stmt = db.prepare('INSERT INTO ticket_feedback (guildId,ticketId,userId,score,handledBy,createdAt) VALUES (?,?,?,?,?,?)');
  const info = stmt.run(guildId, ticketId, userId, score, handledBy || null, Date.now());
  return Number((info as any).lastInsertRowid || info.lastInsertRowid);
}

export function getFeedbackForTicket(ticketId: number){
  const stmt = db.prepare('SELECT * FROM ticket_feedback WHERE ticketId = ? ORDER BY createdAt DESC');
  return stmt.all(ticketId) as any[];
}

export function listFeedbackForGuild(guildId: string) {
  const stmt = db.prepare('SELECT * FROM ticket_feedback WHERE guildId = ? ORDER BY createdAt DESC');
  return stmt.all(guildId) as any[];
}

export function deleteFeedback(feedbackId: number) {
  const stmt = db.prepare('DELETE FROM ticket_feedback WHERE id = ?');
  const info = stmt.run(feedbackId);
  return Number((info as any).changes || 0);
}

export function getTicketByChannel(channelId: string) {
  const stmt = db.prepare('SELECT * FROM tickets WHERE channelId = ?');
  const row = stmt.get(channelId) as TicketRow | undefined;
  return row ?? null;
}

export function getTicketById(id: number) {
  const stmt = db.prepare('SELECT * FROM tickets WHERE id = ?');
  const row = stmt.get(id) as TicketRow | undefined;
  return row ?? null;
}

export function listTicketsForGuild(guildId: string) {
  const stmt = db.prepare('SELECT * FROM tickets WHERE guildId = ? ORDER BY createdAt DESC');
  return stmt.all(guildId) as TicketRow[];
}

export function listTicketsForUser(guildId: string, userId: string){
  const stmt = db.prepare('SELECT * FROM tickets WHERE guildId = ? AND userId = ? ORDER BY createdAt DESC');
  return stmt.all(guildId, userId) as TicketRow[];
}

export function countTicketsByGuild(guildId: string){
  const stmt = db.prepare('SELECT COUNT(*) as c FROM tickets WHERE guildId = ?');
  const row = stmt.get(guildId) as { c: number } | undefined;
  return Number(row?.c ?? 0);
}

export function countOpenTicketsByGuild(guildId: string){
  const stmt = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guildId = ? AND status = 'open'");
  const row = stmt.get(guildId) as { c: number } | undefined;
  return Number(row?.c ?? 0);
}

export function deleteTicketRow(id: number) {
  const stmt = db.prepare('DELETE FROM tickets WHERE id = ?');
  const info = stmt.run(id);
  return Number((info as any).changes || 0);
}

export function createCategory(guildId: string, name: string, discordCategoryId?: string | null, title?: string | null, description?: string | null) {
  const stmt = db.prepare('INSERT INTO categories (guildId, name, discordCategoryId, title, description, createdAt) VALUES (?, ?, ?, ?, ?, ?)');
  const info = stmt.run(guildId, name, discordCategoryId || null, title || null, description || null, Date.now());
  return Number((info as any).lastInsertRowid || info.lastInsertRowid);
}

export function listCategories(guildId: string) {
  const stmt = db.prepare('SELECT * FROM categories WHERE guildId = ? ORDER BY createdAt DESC');
  return stmt.all(guildId) as any[];
}

export function getCategoryById(id: number) {
  const stmt = db.prepare('SELECT * FROM categories WHERE id = ?');
  const row = stmt.get(id) as any | undefined;
  return row ?? null;
}

export function updateCategory(id: number, updates: { name?: string; discordCategoryId?: string | null; title?: string | null; description?: string | null }) {
  const keys = Object.keys(updates).filter(k => updates[k as keyof typeof updates] !== undefined);
  if (!keys.length) return;
  const set = keys.map(k => `${k} = @${k}`).join(', ');
  const stmt = db.prepare(`UPDATE categories SET ${set} WHERE id = @id`);
  (stmt as any).run({ ...updates, id });
}

export function deleteCategory(id: number) {
  const stmt = db.prepare('DELETE FROM categories WHERE id = ?');
  const info = stmt.run(id);
  return Number((info as any).changes || 0);
}

export default db;

export function updatePanelStatsMessage(panelId: number, statsMessageId: string){
  const stmt = db.prepare('UPDATE panels SET statsMessageId = @statsMessageId, includeStats = 1 WHERE id = @panelId');
  stmt.run({ statsMessageId, panelId });
}

export function getPanelsWithStats(guildId: string){
  type PanelRow = { id: number; guildId: string; title?: string | null; creatorId?: string | null; buttons: string; createdAt: number; channelId?: string | null; messageId?: string | null; includeStats: number; statsMessageId?: string | null };
  const stmt = db.prepare('SELECT * FROM panels WHERE guildId = ? AND includeStats = 1');
  const rows = stmt.all(guildId) as PanelRow[];
  return rows.map(row => {
    let parsed: any;
    try { parsed = JSON.parse(row.buttons); } catch { parsed = []; }
    const buttons: any[] = (parsed || []).map((p: any) => typeof p === 'string' ? { label: p, categoryId: null } : { label: p.label || String(p), categoryId: p.categoryId ?? null });
    return { ...row, buttons };
  });
}

export function enablePanelStats(panelId: number){
  const stmt = db.prepare('UPDATE panels SET includeStats = 1 WHERE id = @panelId');
  stmt.run({ panelId });
}

export function getCategoryByDiscordId(guildId: string, discordCategoryId: string) {
  const stmt = db.prepare('SELECT * FROM categories WHERE guildId = ? AND discordCategoryId = ?');
  const row = stmt.get(guildId, discordCategoryId) as any | undefined;
  return row ?? null;
}

export function createQuestion(categoryId: number, question: string, placeholder?: string | null, required = true, orderIndex = 0) {
  const stmt = db.prepare('INSERT INTO category_questions (categoryId, question, placeholder, required, order_index, createdAt) VALUES (?, ?, ?, ?, ?, ?)');
  const info = stmt.run(categoryId, question, placeholder || null, required ? 1 : 0, orderIndex, Date.now());
  return Number((info as any).lastInsertRowid || info.lastInsertRowid);
}

export function listQuestions(categoryId: number) {
  const stmt = db.prepare('SELECT * FROM category_questions WHERE categoryId = ? ORDER BY order_index ASC');
  return stmt.all(categoryId) as any[];
}

export function getQuestion(questionId: number) {
  const stmt = db.prepare('SELECT * FROM category_questions WHERE id = ?');
  const row = stmt.get(questionId) as any | undefined;
  return row ?? null;
}

export function updateQuestion(questionId: number, updates: { question?: string; placeholder?: string | null; required?: boolean; order_index?: number }) {
  const keys = Object.keys(updates).filter(k => updates[k as keyof typeof updates] !== undefined);
  if (!keys.length) return;
  const set = keys.map(k => `${k} = @${k}`).join(', ');
  const stmt = db.prepare(`UPDATE category_questions SET ${set} WHERE id = @id`);
  const params: any = { ...updates, id: questionId };
  if (params.required !== undefined) params.required = params.required ? 1 : 0;
  (stmt as any).run(params);
}

export function deleteQuestion(questionId: number) {
  const stmt = db.prepare('DELETE FROM category_questions WHERE id = ?');
  const info = stmt.run(questionId);
  return Number((info as any).changes || 0);
}

export function deleteQuestionsByCategory(categoryId: number) {
  const stmt = db.prepare('DELETE FROM category_questions WHERE categoryId = ?');
  const info = stmt.run(categoryId);
  return Number((info as any).changes || 0);
}
