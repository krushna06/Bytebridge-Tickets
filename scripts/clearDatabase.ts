import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'tickets.sqlite');

const db = new Database(DB_PATH);

const tables = [
  'ticket_feedback',
  'categories',
  'panels',
  'tags',
  'staff_stats',
  'staff_profiles',
  'notes',
  'ticket_meta',
  'tickets',
  'guild_settings'
];

console.log('Clearing database tables...');

for (const table of tables) {
  try {
    db.prepare(`DELETE FROM ${table}`).run();
    console.log(`✓ Cleared ${table}`);
  } catch (error) {
    console.error(`✗ Failed to clear ${table}:`, error);
  }
}

console.log('\n✓ All tables cleared successfully');
db.close();
