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
  closeTimeout INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  channelId TEXT NOT NULL,
  userId TEXT NOT NULL,
  status TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  closedAt INTEGER,
  transcriptPath TEXT
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
  displayName TEXT,
  bio TEXT,
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
  creatorId TEXT,
  buttons TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  channelId TEXT,
  messageId TEXT
);
`);

export type GuildSettingsRow = {
  guildId: string;
  staffRoleId?: string | null;
  allowedRoles?: string | null;
  categoryId?: string | null;
  closedCategoryId?: string | null;
  claimEnabled?: number;
  transcriptEnabled?: number;
  transcriptChannelId?: string | null;
  closeTimeout?: number;
};

export function getGuildSettings(guildId: string): GuildSettingsRow | null {
  const stmt = db.prepare('SELECT * FROM guild_settings WHERE guildId = ?');
  const row = stmt.get(guildId) as GuildSettingsRow | undefined;
  return row ?? null;
}

export function upsertGuildSettings(settings: GuildSettingsRow) {
  const stmt = db.prepare(`INSERT INTO guild_settings (
    guildId, staffRoleId, allowedRoles, categoryId, closedCategoryId, claimEnabled, transcriptEnabled, transcriptChannelId, closeTimeout
  ) VALUES (@guildId,@staffRoleId,@allowedRoles,@categoryId,@closedCategoryId,@claimEnabled,@transcriptEnabled,@transcriptChannelId,@closeTimeout)
  ON CONFLICT(guildId) DO UPDATE SET
    staffRoleId=excluded.staffRoleId,
    allowedRoles=excluded.allowedRoles,
    categoryId=excluded.categoryId,
    closedCategoryId=excluded.closedCategoryId,
    claimEnabled=excluded.claimEnabled,
    transcriptEnabled=excluded.transcriptEnabled,
    transcriptChannelId=excluded.transcriptChannelId,
    closeTimeout=excluded.closeTimeout
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

export function createOrUpdateProfile(guildId: string, userId: string, displayName?: string, bio?: string){
  const stmt = db.prepare(`INSERT INTO staff_profiles (guildId,userId,displayName,bio) VALUES (@guildId,@userId,@displayName,@bio)
    ON CONFLICT(guildId,userId) DO UPDATE SET displayName=excluded.displayName, bio=excluded.bio`);
  stmt.run({ guildId, userId, displayName, bio });
}

export function getProfile(guildId: string, userId: string){
  type ProfileRow = { guildId: string; userId: string; displayName?: string | null; bio?: string | null };
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

export function createPanel(guildId: string, title: string | null, creatorId: string | null, buttons: string[]){
  const stmt = db.prepare('INSERT INTO panels (guildId,title,creatorId,buttons,createdAt) VALUES (?,?,?,?,?)');
  const info = stmt.run(guildId, title || null, creatorId || null, JSON.stringify(buttons), Date.now());
  return Number((info as any).lastInsertRowid || info.lastInsertRowid);
}

export function getLatestPanelForGuild(guildId: string){
  type PanelRow = { id: number; guildId: string; title?: string | null; creatorId?: string | null; buttons: string; createdAt: number; channelId?: string | null; messageId?: string | null };
  const stmt = db.prepare('SELECT * FROM panels WHERE guildId = ? ORDER BY createdAt DESC LIMIT 1');
  const row = stmt.get(guildId) as PanelRow | undefined;
  if (!row) return null;
  return { ...row, buttons: JSON.parse(row.buttons) as string[] };
}

export function getPanelById(id: number){
  type PanelRow = { id: number; guildId: string; title?: string | null; creatorId?: string | null; buttons: string; createdAt: number; channelId?: string | null; messageId?: string | null };
  const stmt = db.prepare('SELECT * FROM panels WHERE id = ?');
  const row = stmt.get(id) as PanelRow | undefined;
  if (!row) return null;
  return { ...row, buttons: JSON.parse(row.buttons) as string[] };
}

export function updatePanelMessage(panelId: number, channelId: string, messageId: string){
  const stmt = db.prepare('UPDATE panels SET channelId = @channelId, messageId = @messageId WHERE id = @panelId');
  stmt.run({ channelId, messageId, panelId });
}

export function updateTicketRow(id: number, patch: Partial<TicketRow>) {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const set = keys.map(k => `${k} = @${k}`).join(', ');
  const stmt = db.prepare(`UPDATE tickets SET ${set} WHERE id = @id`);
  (stmt as any).run({ ...patch, id });
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

export default db;
