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
  logsChannelId TEXT
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
  embedColor TEXT
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
`);

console.log(`✓ Database created successfully at: ${DB_PATH}`);
db.close();
